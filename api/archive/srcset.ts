type RewriteUrl = (url: string) => string | null | undefined;

const ASCII_WHITESPACE = /[\t\n\f\r ]/;
const FLOAT = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function validDescriptors(descriptors: string[]): boolean {
  let width = false;
  let density = false;
  let height = false;
  for (const descriptor of descriptors) {
    const value = descriptor.slice(0, -1);
    const suffix = descriptor.at(-1);
    const number = Number(value);
    if (!Number.isFinite(number)) return false;
    if (suffix === "w" && /^\d+$/.test(value) && number > 0 && !width && !density) width = true;
    else if (suffix === "x" && FLOAT.test(value) && number >= 0 && !width && !density && !height) density = true;
    else if (suffix === "h" && /^\d+$/.test(value) && number > 0 && !height && !density) height = true;
    else return false;
  }
  return !height || width;
}

// HTML srcset tokenization, not comma splitting: URLs may contain commas.
// https://html.spec.whatwg.org/multipage/images.html#parse-a-srcset-attribute
export function rewriteSrcset(input: string, rewriteUrl: RewriteUrl): string {
  const candidates: string[] = [];
  let position = 0;
  while (position < input.length) {
    while (position < input.length && (ASCII_WHITESPACE.test(input[position]) || input[position] === ",")) position++;
    const start = position;
    while (position < input.length && !ASCII_WHITESPACE.test(input[position])) position++;
    let url = input.slice(start, position);
    if (!url) break;
    const descriptors: string[] = [];
    if (url.endsWith(",")) url = url.replace(/,+$/, "");
    else {
      let descriptor = "";
      let inParens = false;
      while (position < input.length) {
        const character = input[position++];
        if (inParens) {
          descriptor += character;
          if (character === ")") inParens = false;
        } else if (character === ",") break;
        else if (ASCII_WHITESPACE.test(character)) {
          if (descriptor) descriptors.push(descriptor);
          descriptor = "";
        } else {
          descriptor += character;
          if (character === "(") inParens = true;
        }
      }
      if (descriptor) descriptors.push(descriptor);
    }
    if (!url || /^data:/i.test(url) || !validDescriptors(descriptors)) continue;
    const rewritten = rewriteUrl(url);
    // The callback owns URL policy. Reject outputs that alter srcset structure;
    // the caller must separately escape the resulting HTML attribute.
    if (!rewritten || /[\u0000-\u0020\u007f]/.test(rewritten) || rewritten.startsWith(",") || rewritten.endsWith(",") || /^data:/i.test(rewritten)) continue;
    candidates.push([rewritten, ...descriptors].join(" "));
  }
  return candidates.join(", ");
}
