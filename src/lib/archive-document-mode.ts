export type ReaderDocumentMode = 'standards' | 'limited-quirks' | 'quirks';

// Fixed declarations preserve legacy table/image baselines without copying
// untrusted doctype text into the displayed document.
export const READER_DOCTYPES: Record<ReaderDocumentMode, string> = {
  standards: '<!doctype html>',
  'limited-quirks': '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
  quirks: '',
};

export function readerDocumentMode(html: string): ReaderDocumentMode {
  const declaration = html.match(/<!doctype\s+html\b[^>]*>/i)?.[0];
  if (!declaration) return 'quirks';
  if (/XHTML 1\.0 (Transitional|Frameset)/i.test(declaration)) return 'limited-quirks';
  if (/HTML 4\.01 (Transitional|Frameset)/i.test(declaration)) {
    return /["']\s+["'][^"']+["']\s*>$/.test(declaration) ? 'limited-quirks' : 'quirks';
  }
  return 'standards';
}
