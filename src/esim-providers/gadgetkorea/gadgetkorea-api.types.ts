export interface GadgetKoreaOrderRequest {
  orderId: string;
  products: { optionId: string; qty: number }[];
}

export interface GadgetKoreaOrderResponse {
  [key: string]: any;
}
