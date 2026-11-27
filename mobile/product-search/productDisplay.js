// Pure display helpers for DiscoveryProduct (no React Native imports; unit-tested in Node).
// Missing values are shown as missing, never as 0 or a guess.

const MISSING_LABELS = {
  price: '가격', brand: '브랜드', seller: '판매자', packages: '포장 크기', packageCount: '포장 개수',
  'dimensions.widthCm': '가로', 'dimensions.depthCm': '깊이', 'dimensions.heightCm': '높이',
  groundClearanceCm: '바닥 여유 공간', materials: '소재', care: '관리 방법',
  storageCapacityLiters: '수납 용량', 'delivery.options': '배송비·배송 일정',
};
const REASON_LABELS = {
  not_published: '판매처 미기재', not_applicable: '해당 없음', destination_required: '배송지 필요',
  access_blocked: '판매처 접근 불가', conflicting_sources: '판매처 정보가 서로 다름', not_extracted: '읽지 못함',
};

export function dataBadge(product) {
  if (product.dataMode === 'demo') return '샘플';
  if (product.dataMode === 'feed') return '등록 카탈로그';
  if (product.dataMode === 'verified_snapshot') return `검증 스냅샷${product.retrievedAt ? ` · ${product.retrievedAt.slice(0, 10)}` : ''}`;
  return '실시간 검색';
}

export function formatPrice(product) {
  const price = product.price;
  if (!price || !Number.isFinite(price.amount) || !price.currency) {
    return product.dataMode === 'demo' ? '가격 없는 샘플 상품' : '가격 미확인 · 판매처에서 확인';
  }
  const digits = ['KRW', 'JPY'].includes(price.currency) ? 0 : 2;
  const amount = price.amount.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return price.currency === 'KRW' ? `${amount}원` : `${price.currency} ${amount}`;
}

export function formatDimensions(product) {
  const d = product.dimensions;
  if (!d || [d.widthCm, d.depthCm, d.heightCm].every((v) => v === undefined)) return '치수 미제공 · 판매처에서 확인';
  const part = (v, label) => (v === undefined ? `${label} 미제공` : `${v}`);
  return `${part(d.widthCm, '가로')} × ${part(d.depthCm, '깊이')} × ${part(d.heightCm, '높이')} cm (가로 × 깊이 × 높이, 조립 기준)`;
}

/** Shipping packages are listed separately from assembled size. */
export function formatPackages(product) {
  if (!product.packages?.length) return product.missingFields?.some((m) => m.field === 'packages') ? ['포장 크기 미기재'] : [];
  const lines = product.packages.map((p, i) => {
    const size = [p.widthCm, p.heightCm, p.lengthCm].map((v) => (v === undefined ? '?' : v)).join(' × ');
    const weight = p.weightKg === undefined ? '무게 미기재' : `${p.weightKg} kg`;
    return `${i + 1}. ${p.description ?? '패키지'}${p.articleNumber ? ` (${p.articleNumber})` : ''}: ${size} cm, ${weight}${p.quantity > 1 ? ` × ${p.quantity}개` : ''}`;
  });
  if (product.packageCount !== undefined) lines.unshift(`총 ${product.packageCount}개 포장`);
  return lines;
}

export function missingSummary(product) {
  return (product.missingFields ?? [])
    .filter((m) => !/^packages\[\d+\]/.test(m.field))
    .map((m) => `${MISSING_LABELS[m.field] ?? m.field}: ${REASON_LABELS[m.reason] ?? m.reason}`);
}

export function conflictNotes(product) {
  return (product.conflicts ?? []).map((c) => `${MISSING_LABELS[c.field] ?? c.field}: ${c.values.map((v) => v.value).join(' vs ')}`);
}

export function provenanceNote(product) {
  if (product.dataMode !== 'verified_snapshot') return null;
  return `${product.retrievedAt?.slice(0, 10) ?? '날짜 미상'}에 판매처 상품 페이지에서 확인한 정보예요. 판매처가 공개한 값이며 직접 측정한 값이 아니에요. 가격·재고는 바뀔 수 있어요.`;
}
