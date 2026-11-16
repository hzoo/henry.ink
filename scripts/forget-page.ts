// Prints the KV key of a kept page, for removing one copy by hand (a takedown
// or a page captured by mistake):
//   bunx wrangler kv key delete --namespace-id=<PAGES namespace id> --remote "$(bun scripts/forget-page.ts <url>)"
import { storeKey } from '@/src/lib/stored-pages';

const url = process.argv[2];
if (!url) throw new Error('Usage: bun scripts/forget-page.ts <page url>');
console.log(await storeKey(url));
