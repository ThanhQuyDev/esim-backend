import { isAllowedOrigin } from './cors-origins';

/** Security 15/11/2026 — only esim sites may call the API from a browser. */
describe('isAllowedOrigin', () => {
  const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;

  it.each([
    undefined,
    'https://esim.vn',
    'https://www.esim.vn',
    'https://admin.esim.vn',
    'https://doitac.esim.vn',
    'http://travelesim.vn',
    'https://www.esimvietnam.com',
    'https://esim-frontend-theta.vercel.app',
    'https://esim-doitac.vercel.app',
    'https://beta-esim-bcnakgicc-truong-thanh-quys-projects.vercel.app',
  ])('should allow %s', (origin) =>
    expect(isAllowedOrigin(origin, prod)).toBe(true),
  );

  it.each([
    'https://evil.com',
    'https://esim.vn.evil.com',
    'https://evilesim.vn',
    'https://fakeesim-vn.vercel.app',
    'http://localhost:3000',
    'null',
  ])('should refuse %s', (origin) =>
    expect(isAllowedOrigin(origin, prod)).toBe(false),
  );

  it('should allow localhost off production, or when asked', () => {
    expect(
      isAllowedOrigin('http://localhost:3000', {} as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isAllowedOrigin('http://localhost:3000', {
        ...prod,
        CORS_ALLOW_LOCALHOST: 'true',
      }),
    ).toBe(true);
  });

  it('should allow an origin listed in CORS_ORIGINS', () => {
    const env = { ...prod, CORS_ORIGINS: 'https://partner.example.com/' };
    expect(isAllowedOrigin('https://partner.example.com', env)).toBe(true);
  });
});
