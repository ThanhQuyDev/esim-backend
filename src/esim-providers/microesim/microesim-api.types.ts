/**
 * MicroEsim (MicroDrive Tech) API types.
 *
 * Base path: `/allesim/v1/...`
 * All responses share the envelope `{ code: number; msg: string; result?: T }`
 * where `code === 1` means success.
 */

/** Standard response envelope. `code === 1` on success. */
export interface MicroEsimApiResponse<T = unknown> {
  code: number;
  msg: string;
  result?: T;
}

/** A single data plan item from the catalogue. */
export interface MicroEsimDataplan {
  channel_dataplan_id: string;
  channel_dataplan_name: string;
  price: string;
  currency: string;
  /** '1' = active. */
  status: string;
  day: number;
  /** e.g. 'unlimited', 'Unlimited', '1GB', '500MB'. */
  data: string;
  apn?: string;
  active_type?: string;
  /** ISO country code(s); comma-separated for region packages, e.g. 'CN,HK,MO'. */
  code: string;
  /** e.g. 'JP:Docomo(IIJ)[4G;LTE]|'. */
  networks?: string;
  ip?: string;
  rule_desc?: string;
  validity_period?: string;
  special_desc?: string;
  date_reset?: string;
  usage_reset?: string;
}

/** Paginated catalogue response: `/allesim/v1/esimDataplanListPage`. */
export interface MicroEsimDataplanListPage {
  pageNo: number;
  pageSize: number;
  total: number;
  totalPages: number;
  list: MicroEsimDataplan[];
}

/** Subscribe (place order) response result: `/allesim/v1/esimSubscribe`. */
export interface MicroEsimSubscribeResult {
  topup_id: string;
}

/**
 * Order detail result: `/allesim/v1/topupDetail`.
 * Provider returns parallel arrays — index N across arrays describes eSIM N.
 */
export interface MicroEsimTopupDetailResult {
  topup_id: string;
  number: number;
  channel_dataplan_id: string;
  channel_dataplan_name: string;
  success_number: number;
  /** e.g. 'completed' once eSIMs are provisioned. */
  status?: string;
  create_time: string;
  type: string;
  device_ids: string[];
  lpa_str: string[];
  qrcode: string[];
  ios_esim_install_link: string[];
  android_esim_install_link: string[];
  msisdn?: string[];
  cf_code?: string[];
}

/**
 * Async callback body pushed to `notify_url` — one eSIM per callback (scalar fields).
 */
export interface MicroEsimCallbackPayload {
  topup_id: string;
  number?: string;
  create_time?: string;
  device_id: string;
  lpa_str?: string;
  qrcode?: string;
  ios_esim_install_link?: string;
  android_esim_install_link?: string;
  msisdn?: string;
  cf_code?: string;
}

/** Daily usage breakdown item within device detail. */
export interface MicroEsimDailyUsage {
  date: string;
  total_usage: string;
  mcc?: string;
  mnc?: string;
  total_usage_kb?: string;
}

/** Device (eSIM) detail result: `/allesim/v1/deviceDetail`. */
export interface MicroEsimDeviceDetailResult {
  topup_id: string;
  device_id: string;
  /** The real ICCID assigned to this eSIM (only present in deviceDetail). */
  operator_iccid?: string;
  type: string;
  channel_dataplan_id: string;
  channel_dataplan_name: string;
  status: string;
  active_time?: string;
  pause_time?: string;
  expire_time?: string;
  terminate_time?: string;
  create_time?: string;
  /** Total usage in MB (string). */
  data_usage?: string;
  data_usage_daily?: MicroEsimDailyUsage[];
  is_daily?: string;
  daily_reset_time?: string;
}
