// IKEA public product-page transport.
// IKEA publishes no public product-data API. This fetches ONE public product page (/p/ path, allowed by
// ikea.com/robots.txt; search URLs are disallowed there and are never requested). It is a low-volume
// detail lookup used to refresh reviewed snapshots, not a search connector. It does not bypass any
// access control: a 401/403/429 or bot challenge is reported, never worked around.
// Check IKEA's terms of use before running it at any scale or in production.
import { ConnectorError, errorFromHttpStatus, toConnectorError } from '../errors.ts';

const PRODUCT_PAGE = /^https:\/\/www\.ikea\.com\/([a-z]{2})\/([a-z]{2})\/p\/[a-z0-9-]+-(s?\d{8})\/$/;
export const MAX_PAGE_BYTES = 4_000_000;

export interface IkeaPageRef { url: string; country: string; language: string; retailerProductId: string }

/** Accepts only canonical IKEA product-page URLs; rejects search, other hosts, credentials and query strings. */
export function parseIkeaProductUrl(raw: string): IkeaPageRef {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ConnectorError('parse', 'Not a valid URL.'); }
  if (url.username || url.password || url.search || url.hash) throw new ConnectorError('parse', 'Use the canonical IKEA product URL without query or fragment.');
  const href = url.href.endsWith('/') ? url.href : `${url.href}/`;
  const match = PRODUCT_PAGE.exec(href);
  if (!match) throw new ConnectorError('parse', 'Only https://www.ikea.com/<country>/<language>/p/<product>/ pages are supported.');
  return { url: href, country: match[1].toUpperCase(), language: match[2], retailerProductId: match[3] };
}

export interface FetchedPage { html: string; finalUrl: string; retrievedAt: string; ref: IkeaPageRef }

export async function fetchIkeaProductPage(rawUrl: string, options: {
  timeoutMs?: number; signal?: AbortSignal; fetchImpl?: typeof fetch; now?: () => Date;
} = {}): Promise<FetchedPage> {
  const ref = parseIkeaProductUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);
  try {
    const response = await (options.fetchImpl ?? fetch)(ref.url, {
      redirect: 'follow', signal: controller.signal,
      headers: { 'Accept': 'text/html', 'Accept-Language': `${ref.language}-${ref.country}`, 'User-Agent': 'RoomReady-product-verification/0.1 (low-volume manual snapshot)' },
    });
    if (!response.ok) throw errorFromHttpStatus(response.status);
    const finalUrl = response.url || ref.url;
    if (finalUrl && finalUrl !== ref.url) {
      // A redirect away from the product page (e.g. to a challenge or search page) is not product data.
      try { parseIkeaProductUrl(finalUrl); } catch { throw new ConnectorError('access-denied', 'IKEA redirected away from the product page.'); }
    }
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > MAX_PAGE_BYTES) throw new ConnectorError('parse', 'IKEA page is larger than expected.');
    const html = await response.text();
    if (html.length > MAX_PAGE_BYTES) throw new ConnectorError('parse', 'IKEA page is larger than expected.');
    return { html, finalUrl, retrievedAt: (options.now?.() ?? new Date()).toISOString(), ref };
  } catch (error) {
    throw toConnectorError(error, controller.signal);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}
