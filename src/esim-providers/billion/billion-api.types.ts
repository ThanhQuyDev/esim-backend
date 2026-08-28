/**
 * BILLION (Billion Connect International Flow Operation Platform) API types.
 *
 * Single endpoint: `POST /Flow/saler/2.0/invoke`. Every operation is a
 * `{ tradeType, tradeTime, tradeData }` envelope; the `tradeType` (F001–F054,
 * N001–N012) selects the operation. Requests are signed with
 * `x-sign-value = md5(appSecret + <json body>)`.
 *
 * All responses share the envelope `{ tradeCode, tradeMsg, tradeData }` where
 * `tradeCode === '1000'` means success.
 */

/** Standard response envelope. `tradeCode === '1000'` on success. */
export interface BillionApiResponse<T = unknown> {
  tradeCode: string;
  tradeMsg: string;
  tradeData?: T;
}

/** Country entry inside a product (F002) / usage (F046) record. */
export interface BillionCountry {
  mcc: string;
  name: string;
  apn?: string;
  apnUsername?: string;
  apnPassword?: string;
  apnType?: string;
  authenticationType?: string;
  apnTypeDesc?: string;
  operator?: string;
}

/**
 * A single commodity from F002 (获取商品 / Obtain commodities).
 *
 * `type` codes we care about (eSIM): `230` = eSIM, `3105` = eSIM + self-selected
 * data plan, `3106` = eSIM + fixed data plan. Everything else (physical cards,
 * MIFI…) is ignored during sync.
 */
export interface BillionProduct {
  skuId: string;
  name: string;
  type: string;
  days?: string;
  /** Data plan size in KB (may be empty for unlimited / self-selected). */
  capacity?: string;
  /** High-speed flow size in KB/day. */
  highFlowSize?: string;
  /** Throttled peak speed in kbps. */
  limitFlowSpeed?: string;
  /** '0' not supported / '1' supported. */
  hotspotSupport?: string;
  country?: BillionCountry[];
  apn?: string;
  /** '0' total-type / '1' single-day-type. */
  planType?: string;
  desc?: string;
}

/** Price row within a F003 price array (one per number-of-copies). */
export interface BillionPriceCopy {
  copies: string;
  retailPrice: string;
  settlementPrice: string;
}

/** A single skuId → price mapping from F003 (获取商品价格). */
export interface BillionPrice {
  skuId: string;
  price: BillionPriceCopy[];
}

/** Sub-order echo inside a F040 create-order result. */
export interface BillionCreateOrderSubOrder {
  subOrderId: string;
  channelSubOrderId: string;
}

/** F040 (创建ESIM订单 / Create ESIM order) result. */
export interface BillionCreateOrderResult {
  orderId: string;
  channelOrderId: string;
  subOrderList: BillionCreateOrderSubOrder[];
}

/**
 * F042 (查询ESIM服务状态 / Query ESIM Profile Status) — array element.
 * `status`: 0-not downloaded 1-downloaded 2-installed 3-enabled 4-disabled
 * 5-recycled.
 */
export interface BillionProfileStatus {
  orderId: string;
  iccid: string;
  status: string;
  recordTime: string;
  eid?: string;
}

/** Usage daily breakdown item within a F046 sub-order. */
export interface BillionUsageInfo {
  useDate?: string;
  usedDate?: string;
  usageAmt?: string;
  useageAmt?: string;
}

/** Sub-order inside a F046 usage result. */
export interface BillionUsageSubOrder {
  subOrderId: string;
  channelSubOrderId: string;
  skuId: string;
  skuName: string;
  copies: string;
  /** 0-not used 1-in use 2-used 3-cancelled. */
  planStatus: string;
  planStartTime?: string;
  planEndTime?: string;
  totalDays?: string;
  /** Total flow in KB ('-1' = unlimited). */
  totalTraffic?: string;
  usageInfoList?: BillionUsageInfo[];
  highFlowSize?: string;
  /** 0-total-type 1-single-day-type. */
  planType?: string;
  country?: BillionCountry[];
}

/** F046 (查询套餐使用信息 / Query data plan usage information) result. */
export interface BillionUsageResult {
  orderId: string;
  channelOrderId: string;
  subOrderList: BillionUsageSubOrder[];
}

/** Sub-order inside an N009 ESIM QR-code notification. */
export interface BillionQrSubOrder {
  subOrderId: string;
  channelSubOrderId: string;
  uid?: string;
  iccid: string;
  qrCodeContent: string;
  apn?: string;
  apnUsername?: string;
  apnPassword?: string;
  pin?: string;
  puk?: string;
  msisdn?: string;
  validTime?: string;
}

/** N009 (ESIM二维码通知 / ESIM QR Code Notice) webhook body. */
export interface BillionQrNotification {
  orderId: string;
  channelOrderId: string;
  subOrderList: BillionQrSubOrder[];
}

/** Sub-order inside an N012 ESIM profile-status-change notification. */
export interface BillionProfileStatusSubOrder {
  subOrderId: string;
  channelSubOrderId: string;
  uid?: string;
  iccid: string;
  /** 0-undownload 1-downloaded 2-installed 3-enabled 4-disabled 5-deleted. */
  profileStatus: number;
}

/** N012 (ESIM状态变更通知 / ESIM Profile Status Notice) webhook body. */
export interface BillionProfileStatusNotification {
  orderId: string;
  channelOrderId: string;
  subOrderList: BillionProfileStatusSubOrder[];
}
