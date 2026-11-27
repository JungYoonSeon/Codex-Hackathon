import type { Evidence, HomeProfile, MeasuredDimensions } from '../../../shared/home-profile.ts';
import type { EvaluationProduct, ProductComparison } from '../../../shared/product-evaluation.ts';
import { evaluateProduct } from '../product-evaluation/evaluateProduct.ts';
export const formatDimensions=(d:MeasuredDimensions)=>[d.widthCm?.value,d.depthCm?.value,d.heightCm?.value].map(n=>n??'?').join(' × ')+' cm';
export const formatFact=(f?:Evidence<unknown>)=>f?.value===undefined?'확인 필요':typeof f.value==='boolean'?(f.value?'예':'아니오'):Array.isArray(f.value)?f.value.join(', '):String(f.value);
export function compareProducts(a:EvaluationProduct,b:EvaluationProduct,home:HomeProfile):ProductComparison{
  const left=evaluateProduct(a,home),right=evaluateProduct(b,home);
  const cost=(e:typeof left)=>e.totalCost?`${e.totalCost.amount.toLocaleString()} ${e.totalCost.currency}`:'배송비·세금 포함 합계 확인 필요';
  const risk=(e:typeof left)=>{const c=e.checks.filter(c=>c.group==='delivery');return `${c.filter(c=>c.status==='conflict').length}개 충돌 · ${c.filter(c=>c.status==='review').length}개 확인 필요`;};
  return {left,right,rows:[
    {label:'판매처 / 브랜드',left:`${a.retailer??'미제공'} / ${a.brand??'미제공'}`,right:`${b.retailer??'미제공'} / ${b.brand??'미제공'}`},
    {label:'가로 × 깊이 × 높이',left:formatDimensions(a.dimensions),right:formatDimensions(b.dimensions)},
    {label:'선택한 쪽의 직선 여유',left:left.walkwayCm!==undefined?`${Number(left.walkwayCm.toFixed(1))} cm`:'배치·치수 확인 필요',right:right.walkwayCm!==undefined?`${Number(right.walkwayCm.toFixed(1))} cm`:'배치·치수 확인 필요',note:'같은 방의 지정한 위치 기준이며 연속 이동 경로가 아닙니다.'},
    {label:'총구매비용',left:cost(left),right:cost(right),note:'상품 + 배송/작업비 + 세금. 통화가 다르면 환산하지 않습니다.'},
    {label:'소재',left:formatFact(a.materials),right:formatFact(b.materials)},
    {label:'관리 방법',left:formatFact(a.careInstructions),right:formatFact(b.careInstructions)},
    {label:'하부 유효 높이',left:formatFact(a.groundClearanceCm),right:formatFact(b.groundClearanceCm),note:'cm. 로봇 높이 이외에 다리 간격도 확인하세요.'},
    {label:'배송 위험·확인 항목',left:risk(left),right:risk(right)},
    {label:'포장 목록',left:`${a.packages.length}개 · ${a.packagesComplete?.value===true?'전체 목록으로 기재':'전체 여부 미확인'}`,right:`${b.packages.length}개 · ${b.packagesComplete?.value===true?'전체 목록으로 기재':'전체 여부 미확인'}`},
    {label:'생활 선호 불일치',left:left.checks.filter(c=>c.group==='lifestyle'&&c.status==='conflict').map(c=>c.title).join(', ')||'불일치 없음 또는 정보 부족',right:right.checks.filter(c=>c.group==='lifestyle'&&c.status==='conflict').map(c=>c.title).join(', ')||'불일치 없음 또는 정보 부족'},
  ],priceDifference:left.totalCost&&right.totalCost&&left.totalCost.currency===right.totalCost.currency?{amount:right.totalCost.amount-left.totalCost.amount,currency:left.totalCost.currency}:undefined};
}
