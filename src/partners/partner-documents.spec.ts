import {
  documentUploadToken,
  isAllowedPartnerDocument,
  verifyDocumentUploadToken,
} from './partner-documents';
import { PartnersService } from './partners.service';

/** Documents attached to a partner application (doitac-1410 #013). */
describe('partner application documents (doitac-1410 #013)', () => {
  const SECRET = 'test-secret';

  describe('the upload token', () => {
    it('should open the upload for its own application', () => {
      const token = documentUploadToken(42, SECRET, 1_000);
      expect(verifyDocumentUploadToken(token, SECRET, 2_000)).toBe(42);
    });

    it('should not open it an hour later', () => {
      const token = documentUploadToken(42, SECRET, 0);
      expect(verifyDocumentUploadToken(token, SECRET, 3_600_001)).toBeNull();
    });

    it('should refuse a token edited to point at another application', () => {
      const [, expires, signature] = documentUploadToken(42, SECRET).split('.');
      expect(
        verifyDocumentUploadToken(`43.${expires}.${signature}`, SECRET),
      ).toBeNull();
    });

    it('should refuse no token at all', () => {
      expect(verifyDocumentUploadToken(undefined, SECRET)).toBeNull();
    });
  });

  describe('which files', () => {
    it('should take a PDF or a photo up to 5MB', () => {
      expect(
        isAllowedPartnerDocument({
          originalname: 'GPKD.pdf',
          mimetype: 'application/pdf',
          size: 1_000_000,
        }),
      ).toBeNull();
      expect(
        isAllowedPartnerDocument({
          originalname: 'cccd.JPG',
          mimetype: 'image/jpeg',
          size: 1_000,
        }),
      ).toBeNull();
    });

    it('should refuse anything else, or a file renamed to look allowed', () => {
      expect(
        isAllowedPartnerDocument({
          originalname: 'x.exe',
          mimetype: 'application/octet-stream',
          size: 10,
        }),
      ).toMatch(/không đúng định dạng/);
      expect(
        isAllowedPartnerDocument({
          originalname: 'x.pdf',
          mimetype: 'text/html',
          size: 10,
        }),
      ).toMatch(/không đúng định dạng/);
    });

    it('should refuse a file over 5MB', () => {
      expect(
        isAllowedPartnerDocument({
          originalname: 'big.pdf',
          mimetype: 'application/pdf',
          size: 6 * 1024 * 1024,
        }),
      ).toMatch(/5MB/);
    });
  });

  describe('PartnersService.attachApplicationDocuments', () => {
    function build(partner: Record<string, unknown>) {
      const service = Object.create(
        PartnersService.prototype,
      ) as PartnersService;
      const update = jest.fn().mockResolvedValue(undefined);
      Object.assign(service, {
        configService: { getOrThrow: () => SECRET },
        getPartnerOrThrowById: jest.fn().mockResolvedValue(partner),
        partnerRepository: { update },
      });
      return { service, update };
    }
    const pdf = {
      originalname: 'GPKD.pdf',
      mimetype: 'application/pdf',
      size: 10,
      buffer: Buffer.from('%PDF'),
    } as Express.Multer.File;

    it('should refuse without a valid token', async () => {
      const { service, update } = build({ id: 42, status: 'pending' });
      await expect(
        service.attachApplicationDocuments('bad', [pdf]),
      ).rejects.toThrow('hết hạn');
      expect(update).not.toHaveBeenCalled();
    });

    it('should refuse once the application has been decided', async () => {
      const { service } = build({ id: 42, status: 'active', documents: [] });
      await expect(
        service.attachApplicationDocuments(documentUploadToken(42, SECRET), [
          pdf,
        ]),
      ).rejects.toThrow('đã được xử lý');
    });

    it('should never hold more than five files', async () => {
      const five = Array.from({ length: 5 }, (_, i) => ({ id: String(i) }));
      const { service } = build({ id: 42, status: 'pending', documents: five });
      await expect(
        service.attachApplicationDocuments(documentUploadToken(42, SECRET), [
          pdf,
        ]),
      ).rejects.toThrow('Tối đa 5 file');
    });
  });
});
