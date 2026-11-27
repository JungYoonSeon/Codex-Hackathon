/** Product discovery is broader than the four preview-enabled sample products. */
export const productCategories = [
  { id: 'all', label: '전체', query: 'furniture', icon: '🏠' },
  { id: 'sofa', label: '소파', query: 'sofa', icon: '🛋️' },
  { id: 'chair', label: '의자', query: 'chair', icon: '🪑' },
  { id: 'desk', label: '책상', query: 'desk', icon: '🖥️' },
  { id: 'table', label: '테이블', query: 'table', icon: '☕' },
  { id: 'bed', label: '침대', query: 'bed', icon: '🛏️' },
  { id: 'storage', label: '수납장', query: 'storage cabinet', icon: '🗄️' },
  { id: 'shelf', label: '선반·책장', query: 'bookshelf', icon: '📚' },
  { id: 'wardrobe', label: '옷장', query: 'wardrobe', icon: '🚪' },
  { id: 'lighting', label: '조명', query: 'floor lamp', icon: '💡' },
  { id: 'rug', label: '러그', query: 'rug', icon: '🧶' },
  { id: 'outdoor', label: '야외 가구', query: 'outdoor furniture', icon: '🌿' },
  { id: 'other', label: '기타', query: 'home furniture', icon: '✨' },
] as const;
export type ProductCategory = Exclude<typeof productCategories[number]['id'], 'all'>;
export type ProductSource = 'demo' | 'amazon' | 'ebay' | 'ikea' | 'coupang';
/**
 * 'verified_snapshot': a retailer record captured once from a public product page and reviewed by a person.
 * It is NOT a live connector result; check `retrievedAt` for staleness.
 */
export type DataMode = 'demo' | 'live' | 'feed' | 'verified_snapshot';
export interface DiscoveryProduct {
  /** Stable identity. Existing formats are unchanged; new retailer records use `<retailer>:<market>:<retailerProductId>`. */
  id: string; name: string; brand?: string; category: ProductCategory;
  source: ProductSource; sourceLabel: string; dataMode: DataMode;
  description: string; tags: string[]; imageUrl?: string; productUrl?: string;
  price?: Money;
  /** Assembled product size, normalized to centimetres. Never shipping-package size. */
  dimensions?: { widthCm?: number; depthCm?: number; heightCm?: number };
  /** Only existing, server-owned references can use the current preview endpoint. */
  previewOptionId?: string;
  matchReason?: string;

  // ---- DRAFT additive fields (retailer data v0.1). Pending agreement with 윤선's evaluator. ----
  // Missing-value convention: a value that is unknown is OMITTED (never 0, '' or a guess) and is listed
  // in `missingFields` with a reason. Unknown never means false. Consumers must treat absence as "needs confirmation".
  identity?: RetailerIdentity;
  /** Who sells the offer, when it can differ from the product brand (marketplaces). */
  seller?: { name: string; isBrandOwner?: boolean };
  /** Additional assembled measurements as published (cm). */
  detailedDimensions?: DetailedDimensions;
  /** Shipping packages exactly as published. Separate from assembled `dimensions`. */
  packages?: ShippingPackage[];
  /** Number of physical packages the retailer states for one unit, when published. */
  packageCount?: number;
  delivery?: DeliveryInfo;
  materials?: ProductMaterial[];
  care?: ProductCare[];
  /** Clear space under the furniture (cm), as published. */
  groundClearanceCm?: number;
  storageCapacityLiters?: number;
  /** Field-level provenance. Every important value above should have at least one entry. */
  evidence?: FieldEvidence[];
  /** Sources disagree. Both values are kept; nothing is silently chosen. */
  conflicts?: FieldConflict[];
  missingFields?: MissingField[];
  /** When the underlying source data was retrieved (ISO-8601 UTC). */
  retrievedAt?: string;
}

export interface Money { amount: number; currency: string }

export interface RetailerIdentity {
  retailer: Exclude<ProductSource, 'demo'>;
  /** ISO 3166-1 alpha-2 market, e.g. 'KR'. Prices, delivery and IDs are only valid in this market. */
  market: string;
  /** Retailer's stable product/variant identifier as used in its URLs, e.g. IKEA '10489009' or 's49010615'. */
  retailerProductId: string;
  /** Human-facing article/SKU number, e.g. '104.890.09'. */
  articleNumber?: string;
  /** Retailer item type, e.g. IKEA 'ART' (single article) or 'SPR' (combination of articles). */
  itemType?: string;
  /** Variant attributes that distinguish this record from siblings (colour, cover, size). */
  variant?: Record<string, string>;
}

export interface DetailedDimensions {
  seatWidthCm?: number; seatDepthCm?: number; seatHeightCm?: number;
  armrestHeightCm?: number; armrestWidthCm?: number; backrestHeightCm?: number;
}

export interface ShippingPackage {
  /** Article contained in this package, when published. */
  articleNumber?: string;
  description?: string;
  /** Number of identical packages of this kind per purchased unit. */
  quantity: number;
  widthCm?: number; heightCm?: number; lengthCm?: number; weightKg?: number;
}

export interface DeliveryInfo {
  /**
   * 'not_checked': nothing about delivery was verified.
   * 'destination_required': the retailer needs an address/postcode before quoting.
   * 'quoted': a quote was obtained for `destination` at `checkedAt` (valid only for that place/time).
   */
  status: 'not_checked' | 'destination_required' | 'quoted';
  /** Country the offer states it ships to, when published. */
  shipsToCountry?: string;
  destination?: { country: string; postalCode?: string };
  checkedAt?: string;
  options?: { method: string; price?: Money; estimate?: string }[];
}

export interface ProductMaterial { part?: string; material: string }
export interface ProductCare { part?: string; instructions: string[] }

export type VerificationStatus =
  | 'retailer_reported'      // published by the retailer; not physically measured by us
  | 'independently_checked'  // confirmed against a second independent source or measurement
  | 'derived'                // computed from other fields (see derivedFrom)
  | 'unverified';            // captured but not reviewed
export type ExtractionMethod =
  | 'official_api' | 'authorized_feed' | 'public_page_structured_data' | 'manual_entry' | 'derived';

export interface FieldEvidence {
  /** Dotted path in this record, e.g. 'packages[1].weightKg' or 'groundClearanceCm'. */
  field: string;
  status: VerificationStatus;
  method: ExtractionMethod;
  sourceUrl: string;
  retrievedAt: string;
  market?: string;
  /** Retailer variant the value belongs to (e.g. article number). */
  variantId?: string;
  /** Label as published, e.g. '가구 밑 여유공간'. */
  sourceLabel?: string;
  /** Value exactly as published, including the original unit, e.g. '23 cm'. */
  originalValue?: string;
  /** For derived values: the fields they were computed from. */
  derivedFrom?: string[];
  note?: string;
}

export interface FieldConflict {
  field: string;
  values: { value: string; sourceLabel: string; sourceUrl: string }[];
  note?: string;
}

export type MissingReason =
  | 'not_published'        // the source does not state it
  | 'not_applicable'       // the source states it does not apply
  | 'destination_required' // depends on an address/time we did not supply
  | 'access_blocked'       // the source could not be accessed
  | 'conflicting_sources'  // sources disagree; see `conflicts` (no value is chosen)
  | 'not_extracted';       // published but not captured by this version
export interface MissingField { field: string; reason: MissingReason; note?: string }
export interface ProductSearch {
  q: string; brand: string; category: 'all' | ProductCategory;
  source: 'all' | ProductSource; sort: 'relevance' | 'price-asc' | 'price-desc'; page: number;
}
export type SourceProblem = 'access-denied' | 'rate-limited' | 'timeout' | 'network' | 'parse' | 'no-results' | 'unavailable';
export interface SourceStatus {
  source: ProductSource; status: 'ready' | 'not-configured' | 'error'; message: string;
  /** DRAFT: machine-readable cause for non-ready states, and 'snapshot' when only verified snapshots are served. */
  reason?: SourceProblem | 'snapshot';
}
export interface ProductSearchResult {
  products: DiscoveryProduct[]; sources: SourceStatus[]; page: number; hasMore: boolean;
  links: { source: ProductSource; label: string; url: string }[];
}
const demo = (id: string, name: string, category: ProductCategory, width: number, depth: number, height: number, tags: string[], previewOptionId?: string): DiscoveryProduct => ({
  id: `demo:${id}`, name, category, brand: 'RoomReady Demo', source: 'demo', sourceLabel: 'RoomReady 샘플',
  dataMode: 'demo', description: '검색과 공간 계획을 위한 가상 상품입니다. 실제 판매 상품이나 가격이 아닙니다.',
  tags, dimensions: { widthCm: width, depthCm: depth, heightCm: height }, previewOptionId,
});
export const discoveryDemoProducts: DiscoveryProduct[] = [
  demo('sofa-linen','Compact Linen Sofa · 베이지 소파','sofa',160,85,82,['베이지','beige','compact','패브릭','미니멀'],'sofa-linen'),
  demo('sofa-sage','Sage Sofa · 세이지 소파','sofa',200,95,86,['green','초록','sage','modern','패브릭'],'sofa-sage'),
  demo('chair-oak','Oak Chair · 원목 의자','chair',50,55,82,['wood','oak','원목','natural','내추럴'],'chair-oak'),
  demo('chair-blue','Blue Lounge Chair · 라운지 의자','chair',78,80,88,['blue','파랑','modern','패브릭'],'chair-blue'),
  demo('desk-oak','Oak Work Desk · 원목 책상','desk',120,60,75,['wood','원목','compact','작은방','미니멀']),
  demo('desk-wide','Wide Work Desk · 와이드 책상','desk',160,75,75,['white','화이트','넓은','modern']),
  demo('table-round','Round Dining Table · 원형 식탁','table',100,100,74,['dining','식탁','round','원형','wood']),
  demo('table-coffee','Low Coffee Table · 낮은 테이블','table',90,50,40,['coffee','커피','compact','작은방']),
  demo('bed-single','Single Bed · 싱글 침대','bed',105,205,90,['single','싱글','wood','원목']),
  demo('bed-queen','Queen Bed · 퀸 침대','bed',160,210,100,['queen','퀸','패브릭','beige']),
  demo('cabinet-low','Low Cabinet · 낮은 수납장','storage',80,40,90,['수납','storage','white','화이트']),
  demo('shelf-tall','Tall Bookshelf · 키 큰 책장','shelf',80,30,180,['책장','선반','bookshelf','wood']),
  demo('wardrobe','Double Wardrobe · 두 칸 옷장','wardrobe',100,60,200,['옷장','수납','white','화이트']),
  demo('lamp-floor','Arc Floor Lamp · 플로어 조명','lighting',45,45,160,['조명','램프','lamp','black','검정']),
  demo('rug-woven','Woven Rug · 우븐 러그','rug',160,230,1,['러그','카펫','rug','beige','베이지']),
  demo('outdoor-bench','Garden Bench · 정원 벤치','outdoor',120,55,85,['벤치','야외','garden','wood']),
];
export function retailerLinks(input: Pick<ProductSearch, 'q' | 'brand' | 'category'>): ProductSearchResult['links'] {
  const category = productCategories.find(c => c.id === input.category)?.query ?? 'furniture';
  const query = [input.brand, input.q, input.category === 'all' && input.q ? '' : category].filter(Boolean).join(' ');
  return [
    { source: 'ikea', label: 'IKEA 공식 사이트에서 검색', url: `https://www.ikea.com/kr/ko/search/?q=${encodeURIComponent(query)}` },
    // Outbound search link only; this is not a Coupang data connector.
    { source: 'coupang', label: '쿠팡에서 검색', url: `https://www.coupang.com/np/search?q=${encodeURIComponent(query)}` },
    { source: 'amazon', label: 'Amazon에서 검색', url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}` },
    { source: 'ebay', label: 'eBay에서 검색', url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}` },
  ];
}
export function filterProducts(products: DiscoveryProduct[], input: ProductSearch): DiscoveryProduct[] {
  const terms = input.q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const brand = input.brand.toLocaleLowerCase();
  const ranked = products.filter(p => (input.category === 'all' || p.category === input.category) &&
    (!brand || p.brand?.toLocaleLowerCase().includes(brand)))
    .map((p,index) => {
      const category = productCategories.find(c=>c.id===p.category);
      const text = `${p.name} ${p.brand ?? ''} ${p.description} ${p.tags.join(' ')} ${category?.label} ${category?.query}`.toLocaleLowerCase();
      return {p,index, matches: terms.filter(t=>text.includes(t)), score: terms.reduce((s,t)=>s+(p.name.toLocaleLowerCase().includes(t)?3:text.includes(t)?1:0),0)};
    }).filter(r=>r.matches.length === terms.length);
  ranked.sort((a,b)=>{
    if (input.sort !== 'relevance') {
      if (a.p.price && b.p.price) return a.p.price.currency.localeCompare(b.p.price.currency) || (a.p.price.amount-b.p.price.amount)*(input.sort==='price-asc'?1:-1) || a.index-b.index;
      if (a.p.price) return -1;
      if (b.p.price) return 1;
    }
    return b.score-a.score || a.index-b.index;
  });
  return ranked.map(({p,matches})=>({...p,matchReason: matches.length ? `검색어 일치: ${matches.join(', ')}` : input.category==='all' ? '다양한 종류를 둘러보세요' : `${productCategories.find(c=>c.id===input.category)?.label} 종류로 선택했어요`}));
}
