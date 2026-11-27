// Produce a reviewed-snapshot record for ONE IKEA product page.
//   Live (one request):   node src/discovery/ikea/snapshot.ts <productUrl> <category>
//   Offline (saved HTML): node src/discovery/ikea/snapshot.ts <productUrl> <category> --html <file> --retrieved-at <ISO>
// Prints the normalized DiscoveryProduct JSON. A person must review it before adding it to records/.
// Saved HTML is a local working copy only; never commit retailer page copies.
import { readFile } from 'node:fs/promises';
import { productCategories, type ProductCategory } from '../../../../shared/discovery.ts';
import { fetchIkeaProductPage, parseIkeaProductUrl } from './pageTransport.ts';
import { parseIkeaProductPage } from './pageParser.ts';
import { normalizeIkeaProduct } from './normalize.ts';

export async function snapshotIkeaProduct(url: string, category: ProductCategory, offline?: { html: string; retrievedAt: string }) {
  const ref = parseIkeaProductUrl(url);
  const page = offline ? { html: offline.html, retrievedAt: offline.retrievedAt, ref } : await fetchIkeaProductPage(url);
  const facts = parseIkeaProductPage(page.html, ref.retailerProductId);
  return normalizeIkeaProduct(facts, { sourceUrl: ref.url, retrievedAt: page.retrievedAt, category });
}

if (import.meta.main) {
  const [url, category, ...rest] = process.argv.slice(2);
  const flag = (name: string) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  if (!url || !productCategories.some((c) => c.id === category && c.id !== 'all')) {
    console.error('Usage: node src/discovery/ikea/snapshot.ts <ikea product url> <category> [--html file --retrieved-at ISO]');
    process.exit(2);
  }
  const htmlFile = flag('--html');
  try {
    const offline = htmlFile ? { html: await readFile(htmlFile, 'utf8'), retrievedAt: flag('--retrieved-at') ?? '' } : undefined;
    if (offline && !/^\d{4}-\d{2}-\d{2}T/.test(offline.retrievedAt)) throw new Error('--retrieved-at <ISO time of the original fetch> is required with --html');
    console.log(JSON.stringify(await snapshotIkeaProduct(url, category as ProductCategory, offline), null, 2));
  } catch (error) {
    const e = error as { kind?: string; message?: string };
    console.error(`Snapshot failed${e.kind ? ` (${e.kind})` : ''}: ${e.message ?? 'unknown error'}`);
    process.exit(1);
  }
}
