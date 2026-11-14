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

/**
 * "Tải mã QR" saves the code WITH its ICCID, plan and order drawn under it
 * (vande-1411 #042), so a downloaded picture still says which eSIM it is.
 *
 * Drawn in the browser: the image is on this same origin, so the canvas may
 * be saved, and the browser's own fonts carry the Vietnamese text (the API's
 * Alpine image has none). The values come from the link's data attributes,
 * never from the script text. Without script, or if drawing fails, the link
 * still saves the bare code as before.
 */
const DOWNLOAD_SCRIPT = `(function(){
var a=document.getElementById('dl');if(!a)return;
a.addEventListener('click',function(ev){
  var c=document.createElement('canvas');if(!c.getContext||!c.toBlob)return;
  ev.preventDefault();
  var img=new Image();
  img.onload=function(){
    try{
      var W=560,P=40,Q=W-2*P,F='system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
      var rows=[['ICCID',a.dataset.iccid],['Tên gói cước',a.dataset.plan],['Mã đơn hàng',a.dataset.order]];
      var x=c.getContext('2d');x.font='600 22px '+F;
      var lines=[];
      rows.forEach(function(r){
        var words=String(r[1]||'—').split(/\\s+/),cur='',out=[];
        words.forEach(function(w){var t=cur?cur+' '+w:w;if(x.measureText(t).width>Q&&cur){out.push(cur);cur=w;}else cur=t;});
        out.push(cur);lines.push([r[0],out]);
      });
      var H=P+Q+16;lines.forEach(function(l){H+=26+l[1].length*30+10;});H+=P-10;
      c.width=W;c.height=H;x=c.getContext('2d');
      x.fillStyle='#fff';x.fillRect(0,0,W,H);
      x.drawImage(img,P,P,Q,Q);
      var y=P+Q+16;x.textBaseline='top';
      lines.forEach(function(l){
        x.fillStyle='#666';x.font='500 18px '+F;x.fillText(l[0],P,y);y+=26;
        x.fillStyle='#111';x.font='600 22px '+F;
        l[1].forEach(function(t){x.fillText(t,P,y);y+=30;});y+=10;
      });
      c.toBlob(function(b){
        if(!b){location.href=a.href;return;}
        var u=URL.createObjectURL(b),d=document.createElement('a');
        d.href=u;d.download=a.getAttribute('download')||'eSIM.png';
        document.body.appendChild(d);d.click();d.remove();
        setTimeout(function(){URL.revokeObjectURL(u);},4000);
      },'image/png');
    }catch(e){location.href=a.href;}
  };
  img.onerror=function(){location.href=a.href;};
  img.src=a.href;
});
})();`;

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
<a id="dl" href="${image}" download="eSIM-${escapeHtml(input.iccid)}.png"
 data-iccid="${escapeHtml(input.iccid)}" data-plan="${escapeHtml(input.planName)}"
 data-order="${escapeHtml(input.orderNumber)}">Tải mã QR</a>
<script>${DOWNLOAD_SCRIPT}</script>
</main></body></html>`;
}
