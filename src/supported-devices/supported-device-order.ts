import { DeviceType } from './domain/supported-device';

/**
 * Display order of the supported-devices list (#047).
 *
 * A position of 0 means "not set". It used to sort FIRST (plain ascending),
 * so giving Apple position 1 pushed Apple below every brand nobody had
 * numbered. Unset positions now sort after every numbered one, and fall back
 * to A–Z among themselves.
 */

export const DEVICE_TYPE_ORDER: DeviceType[] = [
  DeviceType.SMART_PHONES,
  DeviceType.SMART_WATCHES,
  DeviceType.TABLETS,
  DeviceType.LAPTOPS,
];

/** Numbered positions keep their value; 0 / missing sorts last. */
export function positionRank(position?: number | null): number {
  return position && position > 0 ? position : Number.POSITIVE_INFINITY;
}

function comparePositions(a?: number | null, b?: number | null): number {
  const ra = positionRank(a);
  const rb = positionRank(b);
  if (ra === rb) return 0;
  return ra < rb ? -1 : 1;
}

function compareNames(a: string, b: string): number {
  return (a ?? '').localeCompare(b ?? '', undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

export function typeIndex(type: DeviceType | string): number {
  const index = DEVICE_TYPE_ORDER.indexOf(type as DeviceType);
  return index === -1 ? DEVICE_TYPE_ORDER.length : index;
}

export function compareBrands(
  a: { manufacturer: string; manufacturerOrder?: number | null },
  b: { manufacturer: string; manufacturerOrder?: number | null },
): number {
  return (
    comparePositions(a.manufacturerOrder, b.manufacturerOrder) ||
    compareNames(a.manufacturer, b.manufacturer)
  );
}

export function compareModels(
  a: { device: string; sortOrder?: number | null },
  b: { device: string; sortOrder?: number | null },
): number {
  return (
    comparePositions(a.sortOrder, b.sortOrder) ||
    compareNames(a.device, b.device)
  );
}

/** Type tab, then brand position, then model position — as the site lists them. */
export function compareDisplayOrder(
  a: {
    type: DeviceType | string;
    manufacturer: string;
    manufacturerOrder?: number | null;
    device: string;
    sortOrder?: number | null;
  },
  b: {
    type: DeviceType | string;
    manufacturer: string;
    manufacturerOrder?: number | null;
    device: string;
    sortOrder?: number | null;
  },
): number {
  return (
    typeIndex(a.type) - typeIndex(b.type) ||
    compareBrands(a, b) ||
    compareModels(a, b)
  );
}
