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
]);

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
): unknown {
  if (depth > 12) return value;
  if (Array.isArray(value)) {
    return value.map((v) => scrubBusinessData(v, tiers, depth + 1));
  }
  if (!isPlainObject(value)) return value;
  const base = isPlan(value) ? scrubPlan(value, tiers) : value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(base)) {
    if (ALWAYS_STRIP.has(key)) continue;
    out[key] =
      IMAGE_KEYS.has(key) && typeof v === 'string'
        ? ownImage(key, v, base)
        : scrubBusinessData(v, tiers, depth + 1);
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
  ) {}

  private isAdmin(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<{
      headers?: Record<string, string | undefined>;
      user?: { role?: { id?: number } };
    }>();
    if (Number(req.user?.role?.id) === RoleEnum.admin) return true;
    const header = req.headers?.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return false;
    try {
      const payload = this.jwt.verify<{ role?: { id?: number } }>(token, {
        secret: this.authSecret,
      });
      return Number(payload?.role?.id) === RoleEnum.admin;
    } catch {
      return false;
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.isAdmin(context)) return next.handle();
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
            return scrubBusinessData(body, tiers);
          })(),
        ),
      ),
    );
  }
}
