import { normaliseNoticeHtml } from './notice-html';

describe('normaliseNoticeHtml (doitac-1410 #078)', () => {
  it('should keep bold, italic, underline and links', () => {
    const html =
      '<p><strong>B</strong> <em>I</em> <u>U</u> <a href="https://esim.vn/ho-tro" target="_blank">link</a></p>';
    expect(normaliseNoticeHtml(html)).toBe(html);
  });

  it('should take out scripts, handlers and javascript: links', () => {
    const out = normaliseNoticeHtml(
      '<p onclick="x()">Hi<script>alert(1)</script> <a href="javascript:alert(1)">x</a></p>',
    );
    expect(out).toBe('<p>Hi <a>x</a></p>');
  });

  it('should clear the note when the editor is left empty', () => {
    expect(normaliseNoticeHtml('<p></p>')).toBeNull();
    expect(normaliseNoticeHtml('<p>&nbsp; </p>')).toBeNull();
    expect(normaliseNoticeHtml('')).toBeNull();
    expect(normaliseNoticeHtml(null)).toBeNull();
  });

  it('should leave the note alone when it is not sent', () => {
    expect(normaliseNoticeHtml(undefined)).toBeUndefined();
  });
});
