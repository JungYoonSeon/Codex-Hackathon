// Parses facts from an IKEA product page. Pure function: no network, no normalization decisions.
// Data sources inside the page:
//  1. schema.org Product JSON-LD (name, brand, price, currency, seller, width/depth/height, ships-to country)
//  2. The product's hydration data (measurement table, packaging, materials, care, item type).
// Pages also embed OTHER products (recommendations). Only data whose itemNo equals the URL's product
// number is used; anything else is ignored.
import { ConnectorError } from '../errors.ts';

export interface IkeaMeasurement { code: string; label: string; text: string }
export interface IkeaPackage {
  name?: string; typeName?: string; articleNumber?: string; itemNo?: string; quantity?: number;
  measurements: { type: string; label: string; text: string }[];
}
export interface IkeaPageFacts {
  itemNo: string; itemType?: string;
  jsonLd: {
    name?: string; brand?: string; mpn?: string; color?: string; material?: string;
    width?: string; depth?: string; height?: string; price?: string; currency?: string;
    sellerName?: string; availability?: string; shipsToCountry?: string; offerUrl?: string; image?: string;
  };
  canonicalUrl?: string;
  measurements: IkeaMeasurement[];
  packaging?: { numberOfPackages?: number; packages: IkeaPackage[] };
  materials: { part?: string; material: string }[];
  care: { part?: string; instructions: string[] }[];
  descriptionParagraphs: string[];
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function scripts(html: string, attr: RegExp): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) if (attr.test(m[1])) out.push(m[2]);
  return out;
}
function tryJson(text: string): any { try { return JSON.parse(text); } catch { return undefined; } }

export function parseIkeaProductPage(html: string, retailerProductId: string): IkeaPageFacts {
  const itemNo = retailerProductId.replace(/^s/i, '');
  if (!/^\d{8}$/.test(itemNo)) throw new ConnectorError('parse', 'Unexpected IKEA product number.');

  // --- product hydration entry for THIS item ---
  let pageProps: any;
  for (const body of scripts(html, /type="text\/hydrate"/)) {
    const data = tryJson(body);
    if (!data || typeof data !== 'object') continue;
    for (const entry of Object.values<any>(data)) {
      const props = entry?.loaderData?.pageProps;
      if (props?.product?.itemNo === itemNo) { pageProps = props; break; }
    }
    if (pageProps) break;
  }
  if (!pageProps) throw new ConnectorError('parse', 'The IKEA page did not contain product data for this item; the page format may have changed.');
  const product = pageProps.product;

  // --- JSON-LD for THIS item (matched by URL or article number) ---
  const articleFromItemNo = `${itemNo.slice(0, 3)}.${itemNo.slice(3, 6)}.${itemNo.slice(6)}`;
  let ld: any;
  for (const body of scripts(html, /application\/ld\+json/)) {
    const data = tryJson(body);
    for (const node of [].concat(data ?? [])) {
      const n: any = node;
      if (n?.['@type'] === 'Product' && (String(n.offers?.url ?? '').includes(retailerProductId) || n.mpn === articleFromItemNo || n.sku === articleFromItemNo)) ld = n;
    }
  }
  const offer = ld?.offers && !Array.isArray(ld.offers) ? ld.offers : Array.isArray(ld?.offers) ? ld.offers[0] : undefined;
  const firstImage = Array.isArray(ld?.image) ? ld.image[0] : ld?.image;

  const section = pageProps.productInformationSectionProps ?? {};
  const measurements: IkeaMeasurement[] = (section.measurementsProps?.measurements ?? []).flatMap((m: any) => {
    const code = str(m?.type); const label = str(m?.name); const text = str(m?.measure);
    return code && label && text ? [{ code, label, text }] : [];
  });

  const rawPackaging = product.packaging ?? section.measurementsProps?.packaging?.contentProps;
  const packaging = rawPackaging ? {
    numberOfPackages: num(rawPackaging.numberOfPackages),
    packages: (Array.isArray(rawPackaging.packages) ? rawPackaging.packages : []).map((p: any): IkeaPackage => ({
      name: str(p?.name), typeName: str(p?.typeName), articleNumber: str(p?.articleNumber?.value), itemNo: str(p?.itemNo),
      quantity: num(p?.quantity?.value),
      measurements: (p?.measurementGroups ?? []).flatMap((g: any) => g?.measurements ?? []).flatMap((m: any) => {
        const type = str(m?.type); const text = str(m?.text);
        return type && text ? [{ type, label: str(m?.label) ?? type, text }] : [];
      }),
    })),
  } : undefined;

  const accordion = section.productDetailsProps?.accordionObject ?? {};
  // Combination products group materials per component (productType), e.g. frame vs cover.
  const materials = (accordion.materialsAndCare?.contentProps?.materials ?? [])
    .flatMap((group: any) => (group?.materials ?? []).map((m: any) => ({ m, component: str(group?.productType) })))
    .flatMap(({ m, component }: { m: any; component?: string }) => {
      const material = str(m?.material);
      if (!material) return [];
      const part = [component, str(m?.part)?.replace(/:$/, '')].filter(Boolean).join(' · ');
      return [{ ...(part ? { part } : {}), material }];
    });
  const care = (accordion.materialsAndCare?.contentProps?.careInstructions ?? [])
    .flatMap((c: any) => {
      const instructions = (c?.texts ?? []).map(str).filter(Boolean) as string[];
      return instructions.length ? [{ part: str(c?.header), instructions }] : [];
    });

  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  return {
    itemNo, itemType: str(product.type),
    jsonLd: ld ? {
      name: str(ld.name), brand: str(ld.brand?.name ?? ld.brand), mpn: str(ld.mpn), color: str(ld.color), material: str(ld.material),
      width: str(ld.width), depth: str(ld.depth), height: str(ld.height),
      price: str(String(offer?.price ?? '')), currency: str(offer?.priceCurrency), sellerName: str(offer?.seller?.name),
      availability: str(offer?.availability), shipsToCountry: str(offer?.shippingDetails?.shippingDestination?.addressCountry),
      offerUrl: str(offer?.url), image: str(firstImage?.contentUrl ?? firstImage),
    } : {},
    canonicalUrl: canonical,
    measurements, packaging, materials, care,
    descriptionParagraphs: (section.productDetailsProps?.productDescriptionProps?.paragraphs ?? []).map(str).filter(Boolean) as string[],
  };
}
