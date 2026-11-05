import { notificationBodyHtml, withHttpsLinks } from './notification-html';

/** Links in an announcement email (vande-0411 #059). */
describe('withHttpsLinks', () => {
  it.each([
    ['<a href="esim.vn">x</a>', '<a href="https://esim.vn">x</a>'],
    [
      '<a href="www.example.com/a">x</a>',
      '<a href="https://www.example.com/a">x</a>',
    ],
    ['<a href="http://esim.vn/a">x</a>', '<a href="https://esim.vn/a">x</a>'],
    [
      '<p>Xem esim.vn nhé</p>',
      '<p>Xem <a href="https://esim.vn">esim.vn</a> nhé</p>',
    ],
    [
      '<p>esim.vn/blog.</p>',
      '<p><a href="https://esim.vn/blog.">esim.vn/blog.</a></p>',
    ],
  ])('should turn %s into https', (input, output) => {
    expect(withHttpsLinks(input)).toBe(output);
  });

  it.each([
    '<a href="https://esim.vn">esim.vn</a>',
    '<a href="mailto:a@esim.vn">a@esim.vn</a>',
    '<a href="#top">x</a>',
    '<a href="http://example.com">x</a>',
    '<p>Mail a@esim.vn</p>',
    '<p>esim.com.vn</p>',
    '<img src="https://esim.vn/a.png" alt="esim.vn">',
  ])('should leave %s alone', (input) => {
    expect(withHttpsLinks(input)).toBe(input);
  });

  it('should link the bare word in an old plain-text body too', () => {
    expect(notificationBodyHtml('Xem esim.vn')).toBe(
      'Xem <a href="https://esim.vn">esim.vn</a>',
    );
  });
});
