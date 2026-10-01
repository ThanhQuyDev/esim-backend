export type MailConfig = {
  port: number;
  host?: string;
  user?: string;
  password?: string;
  defaultEmail?: string;
  defaultName?: string;
  ignoreTLS: boolean;
  secure: boolean;
  requireTLS: boolean;

  /**
   * Infrastructure 2.5 — Dedicated SMTP credentials for the OTP outbound flow.
   * When `otp.host` is present we instantiate a second nodemailer transport
   * tagged "otp" and route `sendOtp(...)` through it. When the OTP block is
   * left empty we silently fall back to the primary transport so existing
   * deployments keep working.
   */
  otp: {
    host?: string;
    port: number;
    user?: string;
    password?: string;
    defaultEmail?: string;
    defaultName?: string;
    secure: boolean;
    ignoreTLS: boolean;
    requireTLS: boolean;
  };

  /**
   * #059 — the IMAP mailbox support replies arrive in.
   *
   * The poller reads unseen messages, matches the `HT-000123` in the subject back
   * to its ticket and appends the reply to that thread. Everything is optional and
   * the poller stays off unless `inbound.host` is set, so an environment that has
   * not been given the mailbox simply keeps the outbound-only behaviour.
   */
  inbound: {
    host?: string;
    port: number;
    user?: string;
    password?: string;
    secure: boolean;
    /** Mailbox to read; almost always INBOX. */
    mailbox: string;
  };

  /**
   * #062 — SMTP for the support mailbox, so ticket mail is sent AS
   * `support@esim.com.vn` rather than merely replying to it.
   *
   * `user` doubles as the From address: the authenticated account and the visible
   * sender have to agree or most servers reject the message. Optional; without
   * `host`, support mail goes out on the transport it used before.
   */
  support: {
    host?: string;
    port: number;
    user?: string;
    password?: string;
    secure: boolean;
    defaultName?: string;
  };
};
