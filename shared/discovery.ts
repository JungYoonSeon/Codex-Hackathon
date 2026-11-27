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
export type ProductSource = 'demo' | 'amazon' | 'ebay' | 'ikea';
export interface DiscoveryProduct {
  id: string; name: string; brand?: string; category: ProductCategory;
  source: ProductSource; sourceLabel: string; dataMode: 'demo' | 'live' | 'feed';
  description: string; tags: string[]; imageUrl?: string; productUrl?: string;
  price?: { amount: number; currency: string };
  dimensions?: { widthCm?: number; depthCm?: number; heightCm?: number };
  /** Only existing, server-owned references can use the current preview endpoint. */
  previewOptionId?: string;
  matchReason?: string;
}
export interface ProductSearch {
  q: string; brand: string; category: 'all' | ProductCategory;
  source: 'all' | ProductSource; sort: 'relevance' | 'price-asc' | 'price-desc'; page: number;
}
export interface SourceStatus { source: ProductSource; status: 'ready' | 'not-configured' | 'error'; message: string }
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
