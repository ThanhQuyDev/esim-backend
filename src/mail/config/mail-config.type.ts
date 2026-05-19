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
};
