/** Owned by home-fit/comparison. No retailer, navigation or network dependencies. */
export type EvidenceSource = 'measured' | 'supplier' | 'estimated' | 'unknown' | 'demo' | 'user-reported';
export interface Evidence<T> {
  value?: T;
  source: EvidenceSource;
  sourceUrl?: string;
  checkedAt?: string;
  note?: string;
}
export const evidenceLabels: Record<EvidenceSource, string> = {
  measured: '직접 측정', supplier: '판매처 기재', estimated: '추정 · 재확인 필요',
  unknown: '확인 필요', demo: '가상 예시', 'user-reported': '사용자 입력 · 미측정',
};
export interface MeasuredDimensions { widthCm?: Evidence<number>; depthCm?: Evidence<number>; heightCm?: Evidence<number> }
export interface RoomZone {
  id: string; name: string; kind: 'obstacle' | 'door-swing';
  xCm: number; yCm: number; widthCm: number; depthCm: number;
  evidence: EvidenceSource;
}
export interface DeliverySegment {
  id: string; name: string; kind: 'door' | 'corridor' | 'elevator' | 'stairs';
  widthCm?: Evidence<number>; heightCm?: Evidence<number>; depthCm?: Evidence<number>;
  hasTurn: boolean;
}
export interface Placement {
  xCm: number; yCm: number; rotation: 0 | 90;
  walkingSide: 'top' | 'right' | 'bottom' | 'left';
}
export interface LifestylePreferences {
  category?: string;
  budget?: { amount: number; currency: string };
  deliveryRegion?: string;
  requiredDelivery: 'any' | 'room' | 'assembly';
  maxDeliveryDays?: number;
  pets: boolean;
  washableCovers: boolean;
  scratchResistance: boolean;
  children: boolean;
  wallAnchoringAllowed?: boolean;
  roundedEdges: boolean;
  robotVacuum: boolean;
  robotHeightCm?: number;
  robotMarginCm: number;
  minStorageLiters?: number;
  lowMaintenance: boolean;
  minWalkwayCm: number;
  handlingMarginCm: number;
}
export interface HomeProfile {
  schemaVersion: 1;
  id: string; name: string; updatedAt: string;
  room: MeasuredDimensions;
  zones: RoomZone[];
  roomLayoutReviewed: boolean;
  deliveryRoute: DeliverySegment[];
  deliveryRouteComplete: boolean;
  placements: Record<string, Placement>;
  preferences: LifestylePreferences;
}
export const defaultPreferences: LifestylePreferences = {
  requiredDelivery: 'any', pets: false, washableCovers: false, scratchResistance: false,
  children: false, roundedEdges: false, robotVacuum: false, robotMarginCm: 1,
  lowMaintenance: false, minWalkwayCm: 60, handlingMarginCm: 2,
};
export function newHomeProfile(): HomeProfile {
  return { schemaVersion: 1, id: `home-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    name: '우리 집', updatedAt: new Date().toISOString(), room: {}, zones: [],
    roomLayoutReviewed: false, deliveryRoute: [], deliveryRouteComplete: false,
    placements: {}, preferences: { ...defaultPreferences } };
}
export function measured(value: number, source: EvidenceSource = 'measured'): Evidence<number> {
  return { value, source, checkedAt: new Date().toISOString() };
}
/** Structural validation for saved/imported profiles. No coercion of missing values to zero. */
export function profileProblems(profile: HomeProfile): string[] {
  const errors: string[] = [];
  if (!profile || profile.schemaVersion !== 1 || !profile.id || !profile.name?.trim()) return ['프로필 이름과 형식을 확인하세요.'];
  const positive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100_000;
  const nonnegative = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100_000;
  const dimension = (e: Evidence<number> | undefined) => !e || (Object.hasOwn(evidenceLabels, e.source) && (e.value === undefined || positive(e.value)));
  if (!profile.room || !['widthCm','depthCm','heightCm'].every(k=>dimension(profile.room[k as keyof MeasuredDimensions]))) errors.push('방 치수는 0보다 큰 cm 값이어야 합니다.');
  if (!Array.isArray(profile.zones) || !Array.isArray(profile.deliveryRoute) || !profile.placements || typeof profile.placements !== 'object') return [...errors,'저장된 측정 목록 형식을 확인하세요.'];
  const ids = new Set<string>();
  for (const zone of profile.zones) {
    if (!zone.id || ids.has(zone.id) || !zone.name || !['obstacle','door-swing'].includes(zone.kind) || !Object.hasOwn(evidenceLabels,zone.evidence) ||
      !nonnegative(zone.xCm) || !nonnegative(zone.yCm) || !positive(zone.widthCm) || !positive(zone.depthCm)) errors.push('장애물·문 열림 영역의 이름, 위치와 크기를 확인하세요.');
    ids.add(zone.id);
    const w=profile.room?.widthCm?.value,d=profile.room?.depthCm?.value;
    if (w && zone.xCm+zone.widthCm>w || d && zone.yCm+zone.depthCm>d) errors.push(`${zone.name}: 영역이 입력한 방 경계를 벗어납니다.`);
  }
  for (const segment of profile.deliveryRoute) {
    if (!segment.id || ids.has(segment.id) || !segment.name || !['door','corridor','elevator','stairs'].includes(segment.kind) ||
      ![segment.widthCm,segment.heightCm,segment.depthCm].every(dimension) || typeof segment.hasTurn!=='boolean') errors.push('배송 경로의 이름과 치수를 확인하세요.');
    ids.add(segment.id);
  }
  for (const p of Object.values(profile.placements)) if(!p || !nonnegative(p.xCm)||!nonnegative(p.yCm)||![0,90].includes(p.rotation)||!['top','right','bottom','left'].includes(p.walkingSide))errors.push('가구 배치 위치를 확인하세요.');
  const p=profile.preferences;
  if (!p || !['any','room','assembly'].includes(p.requiredDelivery)) return [...errors,'생활 조건 형식을 확인하세요.'];
  for(const key of ['pets','washableCovers','scratchResistance','children','roundedEdges','robotVacuum','lowMaintenance'] as const)if(typeof p[key]!=='boolean')errors.push('생활 조건 선택을 확인하세요.');
  if(typeof profile.roomLayoutReviewed!=='boolean'||typeof profile.deliveryRouteComplete!=='boolean')errors.push('측정 확인 상태를 확인하세요.');
  if(!positive(p.minWalkwayCm)||!nonnegative(p.handlingMarginCm)||!nonnegative(p.robotMarginCm))errors.push('통로·배송·로봇 여유 치수를 확인하세요.');
  if(p.robotHeightCm!==undefined&&!positive(p.robotHeightCm)||p.minStorageLiters!==undefined&&!positive(p.minStorageLiters)||p.maxDeliveryDays!==undefined&&!positive(p.maxDeliveryDays))errors.push('로봇 높이, 수납량, 배송일은 양수여야 합니다.');
  if(p.budget && (!Number.isFinite(p.budget.amount)||p.budget.amount<0||!/^[A-Z]{3}$/.test(p.budget.currency)))errors.push('예산과 3자리 통화 코드를 확인하세요.');
  return [...new Set(errors)];
}
