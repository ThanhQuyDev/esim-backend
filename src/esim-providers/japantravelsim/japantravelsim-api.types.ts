// ─── PLAN API ───────────────────────────────────────────────────────────────

export interface JapanTravelSimPlanRequest {
  mb_id: string;
  apikey: string;
  apitoken: string;
  group: string; // plan, planb, planc, pland
  update_day?: string; // 0 = all, -1 = yesterday, etc.
  view?: string; // "" = all, 0 = stop, 1 = only sellable
}

export interface JapanTravelSimPlanItem {
  deviceskuid: string;
  subject: string;
  operator: string;
  plan_days: string;
  plan_price: string;
  low_speed: string;
  activation: string;
  apn: string;
  apnusername: string;
  apnpassword: string;
  apntype: string;
  package: string; // "Data" or "Day"
  update_datetime: string;
  view: number; // 0 = stop selling
}

export interface JapanTravelSimPlanResponse {
  tradeCode: string;
  tradeMsg: string;
  data?: JapanTravelSimPlanItem[];
}

// ─── INSERT (ORDER) API ─────────────────────────────────────────────────────

export interface JapanTravelSimInsertDataItem {
  OrderId: string;
  wr_group: string;
  deviceSkuId: string;
  days: string;
  start_date: string;
  Name?: string;
  email: string;
  ICCID?: string;
  language?: string; // ja_JP, en_US, zh_CN, zh_TW
}

export interface JapanTravelSimInsertRequest {
  mb_id: string;
  apikey: string;
  apitoken: string;
  data: JapanTravelSimInsertDataItem[];
}

export interface JapanTravelSimInsertResponseItem {
  OrderId: string;
  channelOrderId: string;
}

export interface JapanTravelSimInsertResponse {
  tradeCode: string;
  tradeMsg: string;
  data?: JapanTravelSimInsertResponseItem[];
}

// ─── CALLBACK API ───────────────────────────────────────────────────────────

export interface JapanTravelSimCallbackDataItem {
  channelOrderId: string;
}

export interface JapanTravelSimCallbackRequest {
  mb_id: string;
  apikey: string;
  apitoken: string;
  data: JapanTravelSimCallbackDataItem[];
}

export interface JapanTravelSimCallbackResponseItem {
  OrderId: string;
  channelOrderId: string;
  OrderNo: string;
  uid: string;
  iccid: string;
  qrcodecontent: string;
  apn: string;
  apnusername: string;
  apnpassword: string;
  datetime: string;
  status: number; // 0 = complete, 2 = cancel
}

export interface JapanTravelSimCallbackResponse {
  tradeCode: string;
  tradeMsg: string;
  data?: JapanTravelSimCallbackResponseItem[];
}
