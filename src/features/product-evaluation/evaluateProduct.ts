import { profileProblems } from '../../../shared/home-profile.ts';
import type { Evidence, HomeProfile, Placement, RoomZone } from '../../../shared/home-profile.ts';
import type { EvaluationProduct, ProductCheck, ProductEvaluation, EvidenceRow, Money, RankedProduct } from '../../../shared/product-evaluation.ts';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numeric = (fact?: Evidence<number>) => finite(fact?.value) && fact!.value! > 0 ? fact!.value : undefined;
const nonnegative = (fact?: Evidence<number>) => finite(fact?.value) && fact!.value! >= 0 ? fact!.value : undefined;
const trusted = (fact?: Evidence<unknown>) => fact?.value !== undefined && ['measured','supplier','demo'].includes(fact.source);
const validMoney = (fact?: Evidence<Money>) => fact?.value && finite(fact.value.amount) && fact.value.amount >= 0 && /^[A-Z]{3}$/.test(fact.value.currency) ? fact.value : undefined;
const fmt = (n: number) => Number(n.toFixed(1));
const ev = (label: string, fact?: Evidence<unknown>): EvidenceRow => ({ label, fact });
const perms = (a: number,b: number,c: number) => [[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]];
const overlap = (a: {x:number;y:number;w:number;d:number},b: {x:number;y:number;w:number;d:number}) => Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1e-6 && Math.min(a.y+a.d,b.y+b.d)-Math.max(a.y,b.y)>1e-6;
const zoneRect = (z: RoomZone) => ({x:z.xCm,y:z.yCm,w:z.widthCm,d:z.depthCm});
function freeStrip(rect: {x:number;y:number;w:number;d:number}, side: Placement['walkingSide'], width:number,depth:number,zones:RoomZone[]):number {
  let gap=side==='left'?rect.x:side==='right'?width-rect.x-rect.w:side==='top'?rect.y:depth-rect.y-rect.d;
  for(const zone of zones){const z=zoneRect(zone);
    const vertical=Math.min(rect.y+rect.d,z.y+z.d)>Math.max(rect.y,z.y);
    const horizontal=Math.min(rect.x+rect.w,z.x+z.w)>Math.max(rect.x,z.x);
    if(side==='right'&&vertical&&z.x>=rect.x+rect.w)gap=Math.min(gap,z.x-rect.x-rect.w);
    if(side==='left'&&vertical&&z.x+z.w<=rect.x)gap=Math.min(gap,rect.x-z.x-z.w);
    if(side==='bottom'&&horizontal&&z.y>=rect.y+rect.d)gap=Math.min(gap,z.y-rect.y-rect.d);
    if(side==='top'&&horizontal&&z.y+z.d<=rect.y)gap=Math.min(gap,rect.y-z.y-z.d);
  }
  return Math.max(0,gap);
}

export function evaluateProduct(product: EvaluationProduct, home: HomeProfile): ProductEvaluation {
  const p=product, pref=home?.preferences;
  const checks: ProductCheck[]=[];
  let walkwayCm: number|undefined, totalCost: Money|undefined;
  const add=(id:string,group:ProductCheck['group'],status:ProductCheck['status'],title:string,detail:string,evidence:EvidenceRow[]=[],action?:string,priority:ProductCheck['priority']='required')=>{
    // A value without trustworthy provenance cannot produce a definitive measurement verdict.
    const qualified=evidence.length && evidence.some(e=>!trusted(e.fact));
    checks.push({id,group,status:qualified?'review':status,priority,title,detail:qualified?`${detail} 입력 중 추정·미확인 값이 있어 재확인이 필요합니다.`:detail,evidence,action});
  };
  const problems=profileProblems(home);
  if(problems.length){add('invalid-profile','room','review','프로필 확인 필요',problems.join(' '));return finish();}
  if(pref.category && p.category!==pref.category)add('category','room','conflict','원하는 종류와 다름',`선택한 종류는 ${pref.category}, 상품 종류는 ${p.category}입니다.`);
  const w=numeric(p.dimensions.widthCm),d=numeric(p.dimensions.depthCm),h=numeric(p.dimensions.heightCm);
  const rw=numeric(home.room.widthCm),rd=numeric(home.room.depthCm),rh=numeric(home.room.heightCm);
  const roomEvidence=[ev('방 가로',home.room.widthCm),ev('방 깊이',home.room.depthCm),ev('상품 가로',p.dimensions.widthCm),ev('상품 깊이',p.dimensions.depthCm)];
  const placement=home.placements[p.id];
  let shape: {x:number;y:number;w:number;d:number}|undefined;
  if(w&&d&&rw&&rd){
    const fits=(w<=rw&&d<=rd)||(d<=rw&&w<=rd);
    add('footprint','room',fits?'pass':'conflict',fits?'입력한 직사각형 안에 배치 가능':'0°/90° 배치에서 공간 초과',fits?'가로·깊이 기준입니다. 실제 위치와 기존 물건은 별도로 확인합니다.':'가로·깊이를 바꿔도 맞지 않습니다. 대각 배치나 방 모양은 계산하지 않습니다.',roomEvidence);
    if(placement){
      shape={x:placement.xCm,y:placement.yCm,w:placement.rotation===90?d:w,d:placement.rotation===90?w:d};
      const inside=shape.x+shape.w<=rw&&shape.y+shape.d<=rd;
      add('placement','room',inside?'pass':'conflict',inside?'지정 위치가 방 경계 안에 있음':'지정 위치가 방 경계를 벗어남',`왼쪽 ${fmt(shape.x)} cm, 위쪽 ${fmt(shape.y)} cm에서 ${placement.rotation}° 배치 기준.`,roomEvidence);
      let collides=false;
      for(const zone of home.zones){
        if(overlap(shape,zoneRect(zone))){collides=true;add(`zone-${zone.id}`,'room','conflict',zone.kind==='door-swing'?'문 열림 영역과 겹침':'기존 물건과 겹침',`${zone.name} 영역을 침범합니다. 가구 위치를 바꾸세요.`,[...roomEvidence,ev(zone.name,{value:zoneRect(zone),source:zone.evidence})]);}
      }
      if(!collides&&home.roomLayoutReviewed)add('zones','room','pass','표시한 장애물·문 열림 영역과 겹치지 않음','사용자가 표시한 직사각형 영역에 한정한 결과입니다.',[...roomEvidence,...home.zones.map(z=>ev(z.name,{value:zoneRect(z),source:z.evidence}))]);
      if(inside&&!collides){
        walkwayCm=freeStrip(shape,placement.walkingSide,rw,rd,home.zones);
        add('walkway','walkway',home.roomLayoutReviewed?(walkwayCm>=pref.minWalkwayCm?'pass':'conflict'):'review',`선택한 쪽의 직선 여유: ${fmt(walkwayCm)} cm`,
          `사용자 목표 ${pref.minWalkwayCm} cm와 비교합니다. ${home.roomLayoutReviewed?'연속된 이동 경로·휠체어 회전은 계산하지 않습니다.':'기존 물건과 문 열림 영역 표시가 끝나지 않았습니다.'}`,
          [...roomEvidence,...home.zones.map(z=>ev(z.name,{value:zoneRect(z),source:z.evidence}))],'실제 이동 경로 전체를 걸어 보며 확인하세요.');
      }else add('walkway','walkway','review','통로 계산 보류','방 경계 또는 겹침 문제를 먼저 해결하세요.');
    }else add('placement','walkway','review','배치 위치를 지정해 주세요','상품별 위치와 통로를 볼 방향을 지정하면 직선 여유 폭을 계산합니다.');
  }else add('footprint','room','review','방·상품 치수 확인 필요','가로와 깊이가 모두 있어야 크기를 비교할 수 있습니다.',roomEvidence);
  if(h&&rh)add('height','room',h<=rh?'pass':'conflict',h<=rh?'입력 높이 안에 들어감':'천장 높이 초과',`${h} cm 상품 / ${rh} cm 천장. 세워 조립하는 공간은 별도입니다.`,[ev('상품 높이',p.dimensions.heightCm),ev('천장 높이',home.room.heightCm)]);
  else add('height','room','review','높이 확인 필요','상품 높이와 설치 공간의 유효 높이를 확인하세요.',[ev('상품 높이',p.dimensions.heightCm),ev('천장 높이',home.room.heightCm)]);
  if(!home.roomLayoutReviewed)add('layout-review','room','review','기존 물건·문 열림 표시 미완료','표시하지 않은 물건과 문 열림은 검사하지 않았습니다.');

  // Shipping package dimensions, never assembled furniture dimensions, drive route checks.
  if(!p.packages.length)add('packages','delivery','review','배송 포장 치수가 없음','조립 후 치수로 배송 가능 여부를 판단하지 않습니다. 모든 포장 상자의 크기를 판매처에 요청하세요.',[ev('전체 포장 정보',p.packagesComplete)]);
  if(p.packagesComplete?.value!==true || !trusted(p.packagesComplete))add('packages-complete','delivery','review','전체 포장 목록 확인 필요','빠진 상자가 없는지 확인하세요.',[ev('전체 포장 목록 확인',p.packagesComplete)]);
  if(!home.deliveryRoute.length)add('route-empty','delivery','review','배송 경로를 입력해 주세요','현관, 복도, 엘리베이터 입구/내부, 계단을 필요한 순서대로 추가하세요.');
  if(!home.deliveryRouteComplete)add('route-complete','delivery','review','배송 경로 전체 확인 미완료','입구부터 설치 위치까지 빠진 구간, 문턱, 손잡이, 회전과 장애물을 확인하세요.');
  for(const box of p.packages){
    const bw=numeric(box.widthCm),bd=numeric(box.depthCm),bh=numeric(box.heightCm);
    const be=[ev(`${box.name} 가로`,box.widthCm),ev(`${box.name} 깊이`,box.depthCm),ev(`${box.name} 높이`,box.heightCm)];
    if(!bw||!bd||!bh){add(`package-${box.id}`,'delivery','review',`${box.name}: 포장 치수 부족`,'세 방향 치수가 모두 필요합니다.',be);continue;}
    for(const segment of home.deliveryRoute){
      const sw=numeric(segment.widthCm),sh=numeric(segment.heightCm),sd=numeric(segment.depthCm);
      const facts=[...be,ev(`${segment.name} 폭`,segment.widthCm),ev(`${segment.name} 높이`,segment.heightCm)];
      if(segment.kind==='elevator')facts.push(ev(`${segment.name} 내부 깊이`,segment.depthCm));
      const id=`route-${segment.id}-${box.id}`,title=`${segment.name} · ${box.name}`;
      if(!sw||!sh||(segment.kind==='elevator'&&!sd)){add(id,'delivery','review',`${title}: 경로 치수 부족`,'유효 폭·높이를 입력하고 엘리베이터는 내부 깊이도 입력하세요.',facts);continue;}
      const usableW=sw-2*pref.handlingMarginCm,usableH=sh-2*pref.handlingMarginCm,usableD=(sd??0)-2*pref.handlingMarginCm;
      const options=perms(bw,bd,bh);
      const aligned=options.some(([a,b,c])=>a<=usableW&&b<=usableH&&(segment.kind!=='elevator'||c<=usableD));
      const minEdge=Math.min(bw,bd,bh);
      const impossible=minEdge>sw||minEdge>sh||(segment.kind==='elevator'&&sd!==undefined&&bw*bd*bh>sw*sh*sd);
      const complex=segment.hasTurn||segment.kind==='stairs';
      const status=impossible?'conflict':(!aligned||complex?'review':'pass');
      add(id,'delivery',status,`${title}: ${impossible?'치수 충돌':aligned&&!complex?'직각 방향 치수 조건 충족':'배송업체 확인 필요'}`,
        impossible?'단단한 직육면체 포장과 입력한 빈 공간 기준으로 통과/수용이 불가능한 치수입니다. 포장 변경이나 다른 경로를 문의하세요.':
        !aligned?`양쪽 ${pref.handlingMarginCm} cm 여유를 포함한 직각 방향으로는 맞지 않습니다. 대각 이동 가능성은 계산하지 않습니다.`:
        complex?'폭·높이 조건은 맞지만 회전·계단 이동은 자동 판정할 수 없습니다.':
        `양쪽 ${pref.handlingMarginCm} cm 여유를 적용한 구간별 단순 비교입니다. ${segment.kind==='elevator'?'엘리베이터 문과 회전은 별도 구간으로 확인하세요.':'앞뒤 공간, 연속 회전, 운반 인력 공간은 별도입니다.'}`,facts,'주문 전에 배송업체에 전체 경로를 확인하세요.');
    }
  }

  const price=validMoney(p.price),fee=validMoney(p.deliveryFee),tax=validMoney(p.tax);
  const moneyEvidence=[ev('상품 가격',p.price),ev('배송·추가 작업비',p.deliveryFee),ev('세금·기타 비용',p.tax)];
  if(price&&fee&&tax&&price.currency===fee.currency&&price.currency===tax.currency&&moneyEvidence.every(e=>trusted(e.fact)))totalCost={amount:price.amount+fee.amount+tax.amount,currency:price.currency};
  if(pref.budget){
    const known=[price,fee,tax].filter((m):m is Money=>!!m&&m.currency===pref.budget!.currency);
    const minimum=known.reduce((n,m)=>n+m.amount,0);
    const matching=totalCost?.currency===pref.budget.currency;
    const exceeds=minimum>pref.budget.amount;
    add('budget','budget',matching?(totalCost!.amount<=pref.budget.amount?'pass':'conflict'):exceeds?'conflict':'review',
      matching?`합계 ${fmt(totalCost!.amount)} ${totalCost!.currency}`:exceeds?'확인된 비용만으로 예산 초과':'총구매비용 확인 필요',
      `예산 ${pref.budget.amount} ${pref.budget.currency}. ${matching?'상품·배송·세금 합계입니다.':'미확인 배송비·세금 또는 다른 통화는 임의로 0으로 보거나 환산하지 않습니다.'}`,
      exceeds&&!matching?moneyEvidence.filter(e=>{const m=validMoney(e.fact as Evidence<Money>);return m?.currency===pref.budget!.currency;}):moneyEvidence);
  }else add('budget','budget','review','예산 미설정','같은 통화로 예산을 입력하면 상품·배송·세금을 포함해 비교합니다.',[],undefined,'preference');
  if(pref.deliveryRegion){
    const matches=p.deliveryRegion?.value?.trim().toLocaleLowerCase()===pref.deliveryRegion.trim().toLocaleLowerCase();
    add('delivery-region','delivery',matches?(p.deliveryAvailable?.value===true?'pass':p.deliveryAvailable?.value===false?'conflict':'review'):'review',
      matches&&p.deliveryAvailable?.value===true?'입력한 지역 배송 가능으로 기재':'배송 지역 확인 필요',
      `요청 지역: ${pref.deliveryRegion}. 주소별 견적과 배송 가능 여부를 확인하세요.`,[ev('견적 대상 지역',p.deliveryRegion),ev('지역 배송 가능 여부',p.deliveryAvailable)]);
  }else add('delivery-region','delivery','review','배송 지역 미입력','지역별 배송비와 서비스 가능 여부는 아직 확인하지 않았습니다.');
  if(pref.requiredDelivery!=='any'){
    const level=p.deliveryService?.value;
    const satisfies=pref.requiredDelivery==='assembly'?level==='assembly':level==='room'||level==='assembly';
    add('delivery-service','delivery',level?(satisfies?'pass':'conflict'):'review',pref.requiredDelivery==='assembly'?'조립 서비스 조건':'방 안 운반 조건',`판매처 기재: ${level??'확인 필요'}. 층수·계단 추가요금이 견적에 포함되는지도 확인하세요.`,[ev('배송 서비스',p.deliveryService)]);
  }
  if(pref.maxDeliveryDays){const days=nonnegative(p.deliveryDays);add('delivery-days','delivery',days!==undefined?(days<=pref.maxDeliveryDays?'pass':'conflict'):'review','희망 배송 기간',`사용자 목표 ${pref.maxDeliveryDays}일 / 기재 ${days??'미확인'}일. 주문 시 다시 확인하세요.`,[ev('배송 소요 일수',p.deliveryDays)]);}
  const booleanPreference=(id:string,title:string,fact:Evidence<boolean>|undefined,detail:string)=>add(id,'lifestyle',fact?.value===true?'pass':fact?.value===false?'conflict':'review',title,detail,[ev(title,fact)],'판매처 설명과 실제 사용 조건을 확인하세요.','preference');
  if(pref.washableCovers)booleanPreference('washable','세탁 가능한 커버',p.washableCovers,'분리 세탁 여부를 비교합니다. 소재명만으로 세탁 가능하다고 추정하지 않습니다.');
  if(pref.scratchResistance)booleanPreference('scratch','스크래치 저항성 설명',p.scratchResistant,'판매처의 명시적 설명만 비교합니다. 반려동물 사용 내구성 보증은 아닙니다.');
  if(pref.pets&&!pref.washableCovers&&!pref.scratchResistance)add('pets','lifestyle','review','반려동물 생활 조건 선택 필요','세탁 커버·스크래치 저항성 중 원하는 조건을 선택하세요.',[],undefined,'preference');
  if(pref.children){
    const anchor=p.requiresAnchoring;
    if(anchor?.value===true)add('anchoring','lifestyle',pref.wallAnchoringAllowed===false?'conflict':pref.wallAnchoringAllowed===true?'pass':'review','벽 고정 요구사항',pref.wallAnchoringAllowed===false?'벽 고정이 필요한 상품인데 집에서 고정을 허용하지 않았습니다.':'벽 고정 가능 여부와 실제 설치를 확인하세요. 고정 가능하다는 입력은 설치 완료를 뜻하지 않습니다.',[ev('벽 고정 필요',anchor)]);
    else add('anchoring','lifestyle','review','어린이 사용 환경 확인 필요','고정 필요 여부만으로 어린이에게 안전하다고 판단하지 않습니다. 전도·끼임·설치 조건을 제조사에 확인하세요.',[ev('벽 고정 필요',anchor)],undefined,'preference');
  }
  if(pref.roundedEdges)booleanPreference('rounded','둥근 모서리 선호',p.roundedEdges,'모서리 형태만 비교하며 어린이 안전을 보증하지 않습니다.');
  if(pref.robotVacuum){const clearance=nonnegative(p.groundClearanceCm);const need=pref.robotHeightCm===undefined?undefined:pref.robotHeightCm+pref.robotMarginCm;
    add('robot','lifestyle',clearance!==undefined&&need!==undefined?(clearance>=need?'pass':'conflict'):'review','청소 로봇 높이 조건',`가구 하부 ${clearance??'미확인'} cm / 로봇+여유 ${need??'미입력'} cm. 가구 다리 사이 폭과 센서·바닥 상태는 별도입니다.`,[ev('가구 하부 유효 높이',p.groundClearanceCm)],undefined,'preference');}
  if(pref.minStorageLiters){const capacity=nonnegative(p.storageCapacityLiters);add('storage','lifestyle',capacity!==undefined?(capacity>=pref.minStorageLiters?'pass':'conflict'):'review','필요 수납량',`목표 ${pref.minStorageLiters} L / 기재 ${capacity??'미확인'} L. 외형 치수로 수납 용량을 계산하지 않습니다.`,[ev('수납 용량',p.storageCapacityLiters)],undefined,'preference');}
  if(pref.lowMaintenance)add('care','lifestyle',p.careDifficulty?.value?(p.careDifficulty.value==='low'?'pass':'conflict'):'review','관리 난이도',`기재 난이도: ${p.careDifficulty?.value??'미확인'}. ${p.careInstructions?.value??'관리 방법을 판매처에서 확인하세요.'}`,[ev('관리 난이도',p.careDifficulty),ev('관리 방법',p.careInstructions)],undefined,'preference');
  return finish();

  function finish():ProductEvaluation {
    const evidence=[...new Map(checks.flatMap(c=>c.evidence).map(e=>[e.label,e])).values()];
    const counts={measured:0,supplier:0,estimated:0,unknown:0,demo:0,userReported:0};
    for(const e of evidence){const source=e.fact?.value===undefined?'unknown':e.fact.source;counts[source==='user-reported'?'userReported':source]++;}
    const required=checks.filter(c=>c.priority==='required');
    return {productId:p.id,checks,verdict:required.some(c=>c.status==='conflict')?'conflicts':required.some(c=>c.status==='review')?'needs-confirmation':'meets-entered-conditions',
      reasons:checks.filter(c=>c.status==='pass').map(c=>c.title),tradeoffs:checks.filter(c=>c.status==='conflict').map(c=>`${c.title}: ${c.detail}`),
      missingInformation:checks.filter(c=>c.status==='review').map(c=>`${c.title}: ${c.detail}`),evidence,evidenceCounts:counts,
      certainty:p.demo||counts.demo?'demo':counts.estimated||counts.userReported?'estimated':counts.unknown||checks.some(c=>c.status==='review')?'incomplete':'documented-inputs',
      walkwayCm,totalCost,limitations:[
        '입력한 치수·사각형 모델·판매처 설명에 근거한 비교이며 실제 설치·배송·안전 보증이 아닙니다.',
        '통로는 선택한 한쪽의 직선 여유입니다. 출입구까지 연결된 경로, 대각 운반, 회전, 계단 이동은 자동 검증하지 않습니다.',
        '배송 포장별 방향을 독립 비교하므로 한 방향으로 전체 경로를 운반할 수 있다는 뜻이 아닙니다.',
        '사진에서 치수를 자동 추출하지 않습니다. 사진 추정값을 넣은 경우 직접 재측정하세요.',
        '여유 폭·높이는 사용자가 정한 목표이며 건축·접근성·안전 기준으로 제시하지 않습니다.',
      ]};
  }
}

/** No commissions/brand weights: documented fit and needs come before cost. */
export function rankProducts(products:EvaluationProduct[],home:HomeProfile):RankedProduct[]{
  if(!home.preferences.category && new Set(products.map(p=>p.category)).size>1)return [];
  const real=products.some(p=>!p.demo);
  const items=products.filter(p=>(!real||!p.demo)&&(!home.preferences.category||p.category===home.preferences.category))
    .map(product=>({product,evaluation:evaluateProduct(product,home),rank:0}));
  const currencies=new Set(items.flatMap(i=>i.evaluation.totalCost?[i.evaluation.totalCost.currency]:[]));
  const currency=home.preferences.budget?.currency??(currencies.size===1?[...currencies][0]:undefined);
  const key=(r:RankedProduct)=>{
    const cs=r.evaluation.checks;
    return [cs.filter(c=>c.priority==='required'&&c.status==='conflict').length,
      cs.filter(c=>c.priority==='required'&&c.status==='review').length,
      cs.filter(c=>c.priority==='preference'&&c.status==='conflict').length,
      cs.filter(c=>c.priority==='preference'&&c.status==='review').length,
      r.evaluation.totalCost?.currency===currency?r.evaluation.totalCost!.amount:Infinity];
  };
  items.sort((a,b)=>{const ak=key(a),bk=key(b);for(let i=0;i<ak.length;i++)if(ak[i]!==bk[i])return ak[i]<bk[i]?-1:1;return a.product.id.localeCompare(b.product.id);});
  return items.map((i,n)=>({...i,rank:n+1}));
}
export const RANKING_EXPLANATION='브랜드·판매처·수수료 가중치 없음: 필수조건 충돌 수 → 필수 확인 필요 수 → 생활 선호 불일치 수 → 생활 선호 확인 필요 수 → 비교 가능한 통화의 확인된 총비용 순으로 정렬합니다. 실제 상품이 있으면 가상 예시는 추천 순위에서 제외합니다.';
