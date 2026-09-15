export type OnepayConfig = {
  merchantId: string;
  accessCode: string;
  hashSecret: string;
  payUrl: string;
  returnUrl: string;
  ipnUrl: string;
  // `vpc_CardList` sent for admin custom payment links, so the buyer lands
  // straight on one method (e.g. INTERNATIONAL = credit card form). Empty = the
  // full method list.
  customLinkCardList: string;
};
