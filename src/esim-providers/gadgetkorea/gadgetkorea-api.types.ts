export interface GadgetKoreaOrderRequest {
  orderId: string;
  products: { optionId: string; qty: number }[];
}

export interface GadgetKoreaOrderResponseProduct {
  topupId: string;
  optionId: string;
}

export interface GadgetKoreaOrderResponse {
  products: GadgetKoreaOrderResponseProduct[];
  code: string;
  message: string;
}

export interface GadgetKoreaEsimData {
  iccid: string;
  lpa: string;
  smdpAddress?: string;
  activationCode?: string;
  qrCodeUrl?: string;
}

export interface GadgetKoreaQueryEsimResponse {
  code: string;
  message: string;
  data: GadgetKoreaEsimData;
}

export interface GadgetKoreaTopupData {
  topupId: string;
  createTime: string;
  expireTime: string;
  activeTime: string;
  usage: string;
}

export interface GadgetKoreaTopupResponse {
  code: string;
  message: string;
  topup: GadgetKoreaTopupData;
}
