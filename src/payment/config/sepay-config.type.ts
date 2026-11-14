export type SepayConfig = {
  /** Shared secret SePay sends as `Authorization: Apikey <token>`. */
  webhookApiKey: string;
  /** Account number funds are transferred into. */
  accountNumber: string;
  /** Account holder name (shown on the VietQR). */
  accountName: string;
  /**
   * Bank for VietQR, e.g. "VietinBank". VietQR accepts the short name, the code
   * ("ICB") or the napas BIN ("970415") alike; the short name is used because
   * the buyer is shown this value as the bank label.
   */
  bankCode: string;
  /**
   * Word put before our code in the transfer memo. SePay only picks up a
   * transfer into a personal VietinBank account when its memo contains
   * "SEVQR"; without it the money lands but SePay never sees it, so no webhook.
   */
  memoPrefix: string;
  /**
   * The company account also linked on SePay (vande-1411 #046), chosen per
   * partner. Empty until `SEPAY_COMPANY_ACCOUNT_NUMBER` is set; until then
   * "company" falls back to the personal account above.
   */
  company: {
    accountNumber: string;
    accountName: string;
    bankCode: string;
    memoPrefix: string;
  };
};
