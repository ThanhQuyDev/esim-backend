import { esimQrPage } from './esim-qr-page';

/** vande-1411 #042 — the downloaded QR carries its ICCID, plan and order. */
describe('Tải mã QR kèm thông tin (vande-1411 #042)', () => {
  const page = esimQrPage({
    imageUrl: '/api/v1/esims/7/qrcode?token=a&b',
    iccid: '8984<x>',
    planName: 'Nhật Bản "5GB" - 7 ngày',
    orderNumber: 'ORD-1',
  });

  it('should hand the values to the download script as escaped data attributes', () => {
    expect(page).toContain('data-iccid="8984&lt;x&gt;"');
    expect(page).toContain('data-plan="Nhật Bản &quot;5GB&quot; - 7 ngày"');
    expect(page).toContain('data-order="ORD-1"');
    // Never inside the script text itself.
    const script = page.slice(
      page.indexOf('<script>'),
      page.indexOf('</script>'),
    );
    expect(script).not.toContain('8984');
    expect(script).toContain("['Tên gói cước',a.dataset.plan]");
    expect(script).toContain('split(/\\s+/)');
  });

  it('should keep the bare image as the link target when script cannot run', () => {
    expect(page).toContain(
      '<a id="dl" href="/api/v1/esims/7/qrcode?token=a&amp;b" download="eSIM-8984&lt;x&gt;.png"',
    );
  });
});
