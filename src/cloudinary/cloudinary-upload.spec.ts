import {
  cloudinaryFormFields,
  cloudinaryUploadTicket,
  signCloudinaryParams,
} from './cloudinary-upload';

/** Security 15/11/2026 — no more public Cloudinary preset. */
describe('Cloudinary upload tickets', () => {
  it("should sign like Cloudinary's documented example", () => {
    expect(
      signCloudinaryParams(
        {
          timestamp: 1315060510,
          public_id: 'sample_image',
          eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
        },
        'abcd',
      ),
    ).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });

  it('should hand out a signed ticket for one folder when the secret is set', () => {
    const ticket = cloudinaryUploadTicket(
      'ticket',
      {
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'k',
        CLOUDINARY_API_SECRET: 's',
        CLOUDINARY_UPLOAD_PRESET: 'public',
      } as NodeJS.ProcessEnv,
      new Date(1_700_000_000_000),
    );
    expect(ticket).toEqual({
      mode: 'signed',
      cloudName: 'demo',
      apiKey: 'k',
      timestamp: 1_700_000_000,
      folder: 'tickets',
      signature: signCloudinaryParams(
        { folder: 'tickets', timestamp: 1_700_000_000 },
        's',
      ),
    });
    const fields = cloudinaryFormFields(ticket!);
    expect(fields.upload_preset).toBeUndefined();
    expect(fields.folder).toBe('tickets');
  });

  it('should fall back to the server preset until the secret is set', () => {
    const ticket = cloudinaryUploadTicket('cms', {
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_UPLOAD_PRESET: 'p',
    } as NodeJS.ProcessEnv);
    expect(ticket).toEqual({
      mode: 'unsigned',
      cloudName: 'demo',
      uploadPreset: 'p',
    });
  });

  it('should give nothing when Cloudinary is not configured', () => {
    expect(cloudinaryUploadTicket('chat', {} as NodeJS.ProcessEnv)).toBeNull();
  });
});
