export type SepayConfig = {
  /** Shared secret SePay sends as `Authorization: Apikey <token>`. */
  webhookApiKey: string;
  /** Techcombank account number funds are transferred into. */
  accountNumber: string;
  /** Account holder name (shown on the VietQR). */
  accountName: string;
  /** Bank code for VietQR (Techcombank = "TCB"). */
  bankCode: string;
};
