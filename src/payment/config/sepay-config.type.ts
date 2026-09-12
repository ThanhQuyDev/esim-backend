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
};
