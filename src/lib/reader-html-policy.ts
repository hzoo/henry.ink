import type { Config } from 'dompurify';

/**
 * The one allowlist for article markup shown in the reader frame. The API
 * applies it when it cleans a page, so the kept copy is already allowlisted;
 * the browser applies it again with its own parser before rendering.
 */
export const readerHtmlPolicy: Config = {
  USE_PROFILES: { html: true, svg: true },
  CUSTOM_ELEMENT_HANDLING: {
    // Preserve passive layout containers, never their implementation or "is".
    tagNameCheck: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/,
    allowCustomizedBuiltInElements: false,
  },
  FORBID_TAGS: ['script', 'style', 'iframe', 'embed', 'object', 'applet', 'base', 'meta', 'link',
    'form', 'noscript', 'template', 'math', 'foreignObject', 'animate', 'animateTransform',
    'animateMotion', 'set', 'use', 'feImage'],
  FORBID_ATTR: ['formaction', 'xlink:href', 'autofocus', 'contenteditable', 'srcdoc',
    'data-channel-slug'],
};

/** Root attributes that carry layout or language; everything else on <html> and <body> is dropped. */
export const READER_ROOT_ATTRIBUTES = ['id', 'class', 'style', 'lang', 'dir', 'bgcolor', 'text', 'link', 'vlink', 'alink',
  'marginwidth', 'marginheight', 'topmargin', 'leftmargin', 'rightmargin', 'bottommargin'];
