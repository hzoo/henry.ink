import { expect, test } from 'bun:test';
import { validateAsset } from '@/api/archive/asset-validation';

const validate = (declared: string, body: Buffer) => validateAsset({
  url: 'https://example.com/mislabeled.png', status: 200,
  headers: new Headers({ 'content-type': declared }), body,
});

test('recognized raster bytes determine MIME despite an incorrect image label', () => {
  // Moxie's nft-removed.png is served as image/png but contains JPEG bytes.
  expect(validate('image/png', Buffer.from('ffd8ffe10000', 'hex'))).toBe('image/jpeg');
  expect(validate('image/jpeg', Buffer.from('89504e470d0a1a0a', 'hex'))).toBe('image/png');
});

test('raster normalization never broadens to HTML, SVG, or fonts', () => {
  for (const body of [Buffer.from('<html>Not an image</html>'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), Buffer.from('wOF2')]) {
    expect(() => validate('image/png', body)).toThrow();
  }
  const jpeg = Buffer.from('ffd8ffe10000', 'hex');
  for (const type of ['text/html', 'image/svg+xml', 'font/woff2']) expect(() => validate(type, jpeg)).toThrow();
});
