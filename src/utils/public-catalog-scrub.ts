import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { RoleEnum } from '../roles/roles.enum';
import { MarginTier, multidayRetailVnd } from '../plans/multiday-price';

/**
 * Business data out of everything a customer, a visitor or a partner receives
 * (vande-2011 #041, row 56 "lộ bí mật kinh doanh").
 *
 * Plans, regions and destinations came back from the public API exactly as
 * stored, so "xem nguồn trang" on esim.vn, or one request to
 * /api/v1/plans/by-region/…, gave anybody each plan's cost, supplier, supplier
 * plan code, units sold and margin tiers. Only an admin's request now gets
 * those. It is one place, on every response, so a new endpoint cannot leak them
 * again by forgetting a DTO.
 *
 * - Removed everywhere: costs, the supplier's own retail, units sold, sync
 *   times, supplier activation codes, region/destination supplier lists and
 *   external codes.
 * - On a plan: the supplier name (a domestic carrier — Viettel, iTel… — is the
 *   product itself and stays), the supplier's plan code (kept for domestic
 *   stock, whose package code is its name), the APN and egress country.
 * - A day pass instead carries its price for 1–365 days (`multidayK`, in
 *   thousands of đồng), which the storefront used to work out from the cost
 *   and the margin tiers.
 * - A supplier retail below our price is not shown (it was only ever used for
 *   a struck-out price, and only when higher).
 * - Pictures served from a supplier's CDN are replaced (see {@link ownImage}).
 */
const ALWAYS_STRIP = new Set([
  'costPrice',
  'usdCostPrice',
  'vndCostPrice',
  'vndCostExact',
  'usdRetailPrice',
  'vndRetailPrice',
  'supplierActiveType',
  'supplierActivationPolicy',
  'lastSyncedAt',
  'soldCount',
  'externalCode',
  'providers',
  'refundableOverride',
  'ipExport',
  'providerPackageId',
]);

/**
 * A customer — signed in or not — is not told which supplier is behind an
 * eSIM, a topup or an order either (vande-2011 #042): these keys lose a value
 * that names one. A domestic carrier (Viettel, iTel…) is the product and stays.
 * A partner still gets them: the partner portal works with its eSIMs'
 * suppliers.
 */
const SUPPLIER_KEYS = new Set(['provider', 'topupProvider']);
const SUPPLIERS = new Set([
  'airalo',
  'esimaccess',
  'gadgetkorea',
  'billion',
  'billionconnect',
  'microesim',
  'japantravelsim',
]);

export function isSupplierName(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    SUPPLIERS.has(value.toLowerCase().replace(/[^a-z]/g, ''))
  );
}

export type ScrubOptions = {
  hideSupplier?: boolean;
  /**
   * A plan with no discount of its own gets a struck-out price set so the
   * badge reads this percent (vande-2011 #012, admin setting; 0 = off).
   */
  autoStrikePercent?: number;
};

/** The struck-out price that makes `price` read `percent` off. */
export function autoStrikeRetail(price: number, percent: number): string {
  return (price / (1 - percent / 100)).toFixed(2);
}

/**
 * Pictures hot-linked from a supplier's CDN (Airalo's flags) name the supplier
 * in the page source. A flag becomes the storefront's own (`/flags/<CC>.svg`),
 * any other such picture is dropped.
 */
const SUPPLIER_CDN =
  /^https?:\/\/[^/]*(airalo|esimaccess|gadgetkorea|billionconnect|microesim)/i;
const IMAGE_KEYS = new Set(['flagUrl', 'avatarUrl', 'iconUrl', 'imageUrl']);

function ownImage(
  key: string,
  value: string,
  holder: Record<string, unknown>,
): string | null {
  if (!SUPPLIER_CDN.test(value)) return value;
  const cc = String(holder.countryCode ?? holder.code ?? '');
  return key === 'flagUrl' && /^[A-Za-z]{2}$/.test(cc)
    ? `/flags/${cc.toUpperCase()}.svg`
    : null;
}

/** Fields only a plan has: the shape tells a plan from anything else. */
function isPlan(o: Record<string, unknown>): boolean {
  return 'providerPlanId' in o && 'isAbleMultidate' in o && 'price' in o;
}

export const MULTIDAY_MAX_DAYS = 365;

/** A day pass's price for each of 1–365 days, in thousands of đồng. */
export function multidayTable(
  plan: Record<string, unknown>,
  tiers: MarginTier[],
): number[] {
  const out: number[] = [];
  for (let d = 1; d <= MULTIDAY_MAX_DAYS; d++) {
    out.push(Math.round(multidayRetailVnd(plan as never, d, tiers) / 1000));
  }
  return out;
}

function scrubPlan(
  plan: Record<string, unknown>,
  tiers: MarginTier[] | null,
  opts: ScrubOptions = {},
): Record<string, unknown> {
  const domestic = Boolean(plan.isLocalInventory || plan.isDomesticEsim);
  const out: Record<string, unknown> = { ...plan };
  if (plan.isAbleMultidate && tiers?.length) {
    out.multidayK = multidayTable(plan, tiers);
  }
  if (!domestic) {
    out.provider = null;
    delete out.providerPlanId;
    const retail = Number(plan.retailPrice);
    const price = Number(plan.price);
    if (!(retail > price)) out.retailPrice = plan.price;
  }
  delete out.apn;
  // No discount of its own: the struck-out price the admin setting asks for
  // (vande-2011 #012), or the real list price when that is higher still. A
  // plan with its own discount keeps its real figures.
  const percent = Number(opts.autoStrikePercent) || 0;
  const price = Number(plan.price);
  if (
    percent > 0 &&
    percent < 100 &&
    price > 0 &&
    !(Number(plan.discount) > 0)
  ) {
    const auto = autoStrikeRetail(price, percent);
    if (!(Number(out.retailPrice) > Number(auto))) out.retailPrice = auto;
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** A copy of `value` without the business fields; never changes the input. */
export function scrubBusinessData(
  value: unknown,
  tiers: MarginTier[] | null,
  depth = 0,
  opts: ScrubOptions = {},
): unknown {
  if (depth > 12) return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubBusinessData(v, tiers, depth + 1, opts));
  }
  if (!isPlainObject(value)) return value;
  const base = isPlan(value) ? scrubPlan(value, tiers, opts) : value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(base)) {
    if (ALWAYS_STRIP.has(key)) continue;
    if (opts.hideSupplier && SUPPLIER_KEYS.has(key) && isSupplierName(v)) {
      out[key] = null;
      continue;
    }
    out[key] =
      IMAGE_KEYS.has(key) && typeof v === 'string'
        ? ownImage(key, v, base)
        : scrubBusinessData(v, tiers, depth + 1, opts);
  }
  return out;
}

/**
 * Registered first in main.ts, so it sees the response last — after the class
 * serializer has turned entities into plain objects (and dropped what they
 * exclude), so nothing it copies can bring an excluded field back.
 */
@Injectable()
export class PublicCatalogScrubInterceptor implements NestInterceptor {
  private readonly jwt = new JwtService();

  constructor(
    private readonly authSecret: string,
    private readonly tiers: () => Promise<MarginTier[]>,
    /** Admin setting for plans without a discount (vande-2011 #012). */
    private readonly autoStrikePercent: () => Promise<number> = () =>
      Promise.resolve(0),
  ) {}

  /** The caller's role id; null for a visitor or a token that does not verify. */
  private roleOf(context: ExecutionContext): number | null {
    const req = context.switchToHttp().getRequest<{
      headers?: Record<string, string | undefined>;
      user?: { role?: { id?: number } };
    }>();
    const known = Number(req.user?.role?.id);
    if (known) return known;
    const header = req.headers?.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return null;
    try {
      const payload = this.jwt.verify<{ role?: { id?: number } }>(token, {
        secret: this.authSecret,
      });
      return Number(payload?.role?.id) || null;
    } catch {
      return null;
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const role = this.roleOf(context);
    if (role === RoleEnum.admin) return next.handle();
    const opts: ScrubOptions = { hideSupplier: role !== RoleEnum.partner };
    return next.handle().pipe(
      mergeMap((body) =>
        from(
          (async () => {
            if (!body || typeof body !== 'object') return body;
            let tiers: MarginTier[] | null = null;
            try {
              tiers = await this.tiers();
            } catch {
              tiers = null;
            }
            let autoStrikePercent = 0;
            try {
              autoStrikePercent = await this.autoStrikePercent();
            } catch {
              autoStrikePercent = 0;
            }
            return scrubBusinessData(body, tiers, 0, {
              ...opts,
              autoStrikePercent,
            });
          })(),
        ),
      ),
    );
  }
}
