export type BillionConfig = {
  channelId: string;
  appSecret: string;
  baseUrl: string;
  /** Where BILLION sends its own eSIM emails — ours, never the customer's. */
  orderEmail: string;
};
