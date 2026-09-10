import * as QRCode from 'qrcode';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

/**
 * The eSIM QR code, with the brand logo across the middle (#080).
 *
 * The email delivers the eSIM as a bare black-and-white square that looks like
 * any other QR — nothing said who sent it, which matters when a customer is
 * asked to scan something on their phone. The logo is the horizontal wordmark,
 * so it is placed as a band and never squashed into a square: the previous
 * attempt resized a 700×144 logo to 70×70, which would have cropped the
 * wordmark away — and pointed at `logo-esimvn.png`, a file that does not
 * exist (the asset is `logo_esimvn.png`), so no logo was ever drawn at all.
 *
 * Coverage is deliberately small. QR codes are generated at error-correction
 * level H, which tolerates ~30% loss; the logo plate below takes about 5% of
 * the image, so every scanner still reads it.
 */

/** Rendered QR size, in pixels. */
export const QR_SIZE = 400;

/**
 * Logo band width as a share of the QR width. Same figure the storefront uses
 * for the QR codes it draws in the browser (`lib/esim-qr.ts`), so the code in
 * the email and the code in the account page look like the same product.
 */
const LOGO_WIDTH_RATIO = 0.58;

/** White padding around the logo, so it reads as a plate rather than noise. */
const LOGO_PADDING = 8;

let cachedLogoBuffer: Buffer | null = null;

/** The horizontal brand logo shipped in `src/assets` (copied into `dist`). */
export function getLogoBuffer(): Buffer | null {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  try {
    const logoPath = path.join(__dirname, '..', 'assets', 'logo_esimvn.png');
    cachedLogoBuffer = fs.readFileSync(logoPath);
    return cachedLogoBuffer;
  } catch {
    return null;
  }
}

/** Test seam: drop the cached asset between cases. */
export function resetLogoCache(): void {
  cachedLogoBuffer = null;
}

/**
 * Lay the logo across the centre of a QR image.
 *
 * The aspect ratio is preserved (`fit: 'inside'`) and the logo is flattened
 * onto white first, so its transparent background does not let QR modules show
 * through the wordmark and confuse a scanner.
 */
export async function compositeLogo(
  qrBuffer: Buffer,
  logoBuffer: Buffer,
  size = QR_SIZE,
): Promise<Buffer> {
  const logoWidth = Math.round(size * LOGO_WIDTH_RATIO);

  const plate = await sharp(logoBuffer)
    .resize({ width: logoWidth, fit: 'inside', withoutEnlargement: false })
    .flatten({ background: '#ffffff' })
    .extend({
      top: LOGO_PADDING,
      bottom: LOGO_PADDING,
      left: LOGO_PADDING,
      right: LOGO_PADDING,
      background: '#ffffff',
    })
    .png()
    .toBuffer();

  return sharp(qrBuffer)
    .composite([{ input: plate, gravity: 'centre' }])
    .png()
    .toBuffer();
}

/**
 * Render the QR for an LPA string, branded when the logo asset is available.
 *
 * A missing or unreadable logo must never cost the customer their eSIM, so
 * anything that goes wrong falls back to the plain QR.
 */
export async function renderEsimQrCode(
  lpa: string,
  size = QR_SIZE,
): Promise<Buffer> {
  const qrBuffer = await QRCode.toBuffer(lpa, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H',
  });

  const logoBuffer = getLogoBuffer();
  if (!logoBuffer) return qrBuffer;

  try {
    return await compositeLogo(qrBuffer, logoBuffer, size);
  } catch {
    return qrBuffer;
  }
}
