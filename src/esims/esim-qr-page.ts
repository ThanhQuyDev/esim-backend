/**
 * The page a bulk list links to (vande-0411 #011): the QR code with what tells
 * one eSIM from another under it. A bare image from a list of 50 is easy to send
 * to the wrong traveller. Everything shown is escaped: the page is public, by
 * its token.
 */
const escapeHtml = (text: string | null | undefined) =>
  String(text ?? '').replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        ch
      ]!,
  );

export function esimQrPage(input: {
  imageUrl: string;
  iccid: string | null;
  planName: string | null;
  orderNumber: string | null;
}): string {
  const image = escapeHtml(input.imageUrl);
  const row = (label: string, value: string | null) =>
    `<tr><th>${label}</th><td>${escapeHtml(value) || '—'}</td></tr>`;
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Mã QR eSIM ${escapeHtml(input.iccid)}</title>
<style>
body{margin:0;background:#f4f5f7;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#111}
main{max-width:440px;margin:24px auto;padding:20px;background:#fff;border-radius:12px;text-align:center}
img{width:100%;max-width:360px;height:auto}
table{width:100%;margin:12px 0;border-collapse:collapse;text-align:left}
th{width:112px;padding:6px 8px 6px 0;color:#555;font-weight:500;vertical-align:top}
td{padding:6px 0;word-break:break-word;font-weight:600}
a{display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:999px;text-decoration:none}
</style></head><body><main>
<img src="${image}" alt="Mã QR eSIM">
<table>
${row('ICCID', input.iccid)}
${row('Tên gói cước', input.planName)}
${row('Mã đơn hàng', input.orderNumber)}
</table>
<a href="${image}" download="eSIM-${escapeHtml(input.iccid)}.png">Tải mã QR</a>
</main></body></html>`;
}
