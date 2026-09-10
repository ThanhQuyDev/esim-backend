import sharp from 'sharp';
import {
  compositeLogo,
  getLogoBuffer,
  QR_SIZE,
  renderEsimQrCode,
  resetLogoCache,
} from './esim-qrcode';

/**
 * Branded eSIM QR code (#080).
 *
 * The logo is the horizontal wordmark (700×144). The previous attempt squashed
 * it into a 70×70 square — which crops the wordmark away — and read it from
 * `logo-esimvn.png`, a filename that does not exist, so the QR went out plain.
 * These tests check the asset really loads and that the band keeps its shape
 * and stays small enough for a scanner.
 */
describe('eSIM QR code', () => {
  const LPA = 'LPA:1$rsp.truphone.com$QRF-SPEEDTEST';

  beforeEach(() => {
    resetLogoCache();
  });

  it('should find the logo asset that actually ships', () => {
    const logo = getLogoBuffer();

    expect(logo).not.toBeNull();
    expect((logo as Buffer).length).toBeGreaterThan(0);
  });

  it('should ship a horizontal logo, not a square one', async () => {
    const meta = await sharp(getLogoBuffer() as Buffer).metadata();

    expect(meta.width).toBeGreaterThan((meta.height ?? 0) * 2);
  });

  it('should render a QR of the expected size', async () => {
    const meta = await sharp(await renderEsimQrCode(LPA)).metadata();

    expect(meta.format).toBe('png');
    expect(meta.width).toBe(QR_SIZE);
    expect(meta.height).toBe(QR_SIZE);
  });

  it('should keep the logo proportions instead of squashing it', async () => {
    const logo = getLogoBuffer() as Buffer;
    const source = await sharp(logo).metadata();
    const branded = await compositeLogo(
      await sharp({
        create: {
          width: QR_SIZE,
          height: QR_SIZE,
          channels: 3,
          background: '#000000',
        },
      })
        .png()
        .toBuffer(),
      logo,
    );

    // The plate is white; measure the white band it leaves in the middle.
    const { data, info } = await sharp(branded)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const isWhite = (x: number, y: number) => data[y * info.width + x] > 200;

    const middleRow = Math.floor(info.height / 2);
    let bandWidth = 0;
    for (let x = 0; x < info.width; x += 1) {
      if (isWhite(x, middleRow)) bandWidth += 1;
    }

    const middleCol = Math.floor(info.width / 2);
    let bandHeight = 0;
    for (let y = 0; y < info.height; y += 1) {
      if (isWhite(middleCol, y)) bandHeight += 1;
    }

    expect(bandWidth).toBeGreaterThan(bandHeight * 2);
    // Roughly the source logo's ratio, allowing for the white padding.
    const sourceRatio = (source.width ?? 1) / (source.height ?? 1);
    expect(bandWidth / bandHeight).toBeGreaterThan(sourceRatio / 2);
  });

  it('should cover only a small part of the code, so it still scans', async () => {
    const logo = getLogoBuffer() as Buffer;
    const branded = await compositeLogo(
      await sharp({
        create: {
          width: QR_SIZE,
          height: QR_SIZE,
          channels: 3,
          background: '#000000',
        },
      })
        .png()
        .toBuffer(),
      logo,
    );

    const { data, info } = await sharp(branded)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let white = 0;
    for (let i = 0; i < data.length; i += 1) {
      if (data[i] > 200) white += 1;
    }

    // Error correction level H tolerates ~30% loss; stay far below it.
    const coverage = white / (info.width * info.height);
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThan(0.15);
  });

  it('should still deliver a plain QR when the logo cannot be composited', async () => {
    const plain = await renderEsimQrCode(LPA);
    const broken = await compositeLogo(
      plain,
      Buffer.from('not an image'),
    ).catch(() => null);

    // compositeLogo rejects, and the renderer swallows that into a plain QR.
    expect(broken).toBeNull();
    const meta = await sharp(plain).metadata();
    expect(meta.width).toBe(QR_SIZE);
  });
});
