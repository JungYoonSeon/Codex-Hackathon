import { evidenceLabels } from '../../../shared/home-profile.ts';
import type { Evidence } from '../../../shared/home-profile.ts';
import type { EvaluationProduct, Money } from '../../../shared/product-evaluation.ts';
/** Reads existing DiscoveryProduct plus optional enrichment; never edits that contract. */
export function adaptDiscoveryProduct(raw: any): EvaluationProduct {
  if(!raw||typeof raw.id!=='string'||typeof raw.name!=='string')throw new Error('상품 ID와 이름이 필요합니다.');
  const demo=raw.dataMode==='demo'||raw.dimensionSource==='fictional-demo';
  const provenance=raw.evidence && typeof raw.evidence==='object'?raw.evidence:{};
  function fact<T>(value:T|undefined,path:string):Evidence<T>|undefined{
    if(value===undefined||value===null)return undefined;
    const supplied=provenance[path];
    const source=demo?'demo':supplied&&Object.hasOwn(evidenceLabels,supplied.source)?supplied.source:'user-reported';
    return {value,source,sourceUrl:typeof supplied?.sourceUrl==='string'?supplied.sourceUrl:undefined,
      checkedAt:typeof supplied?.checkedAt==='string'?supplied.checkedAt:undefined,
      note:source==='user-reported'?'카탈로그 값 · 필드별 출처 미확인':typeof supplied?.note==='string'?supplied.note:undefined};
  }
  const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0?v:undefined;
  const nonnegative=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:undefined;
  const boolean=(v:unknown)=>typeof v==='boolean'?v:undefined;
  const text=(v:unknown)=>typeof v==='string'&&v.trim()?v.slice(0,3000):undefined;
  const money=(v:any):Money|undefined=>v&&typeof v.amount==='number'&&Number.isFinite(v.amount)&&v.amount>=0&&typeof v.currency==='string'&&/^[A-Z]{3}$/.test(v.currency)?{amount:v.amount,currency:v.currency}:undefined;
  const dims=(v:any,path:string)=>({widthCm:fact(number(v?.widthCm),`${path}.widthCm`),depthCm:fact(number(v?.depthCm),`${path}.depthCm`),heightCm:fact(number(v?.heightCm),`${path}.heightCm`)});
  const delivery=raw.delivery??{};
  const result:EvaluationProduct={id:raw.id,name:raw.name,category:text(raw.category)??'other',brand:text(raw.brand),retailer:text(raw.sourceLabel)??text(raw.source),productUrl:text(raw.productUrl),imageUrl:text(raw.imageUrl),demo,
    dimensions:dims(raw.dimensions??raw,'dimensions'),
    packages:Array.isArray(raw.packages)?raw.packages.slice(0,50).map((p:any,i:number)=>({id:typeof p.id==='string'?p.id:`package-${i+1}`,name:text(p.name)??`포장 ${i+1}`,...dims(p,`packages.${i}`)})):[],
    packagesComplete:fact(boolean(raw.packagesComplete),'packagesComplete'),price:fact(money(raw.price),'price'),
    deliveryFee:fact(money(delivery.fee),'delivery.fee'),tax:fact(money(delivery.tax),'delivery.tax'),
    deliveryAvailable:fact(boolean(delivery.available),'delivery.available'),deliveryRegion:fact(text(delivery.region),'delivery.region'),
    deliveryService:fact(['doorstep','room','assembly'].includes(delivery.service)?delivery.service:undefined,'delivery.service'),
    deliveryDays:fact(nonnegative(delivery.days),'delivery.days'),
    materials:fact(Array.isArray(raw.materials)?raw.materials.filter((v:unknown)=>typeof v==='string').slice(0,20):undefined,'materials'),
    careInstructions:fact(text(raw.careInstructions),'careInstructions'),
    careDifficulty:fact(['low','moderate','high'].includes(raw.careDifficulty)?raw.careDifficulty:undefined,'careDifficulty'),
    washableCovers:fact(boolean(raw.washableCovers),'washableCovers'),scratchResistant:fact(boolean(raw.scratchResistant),'scratchResistant'),
    roundedEdges:fact(boolean(raw.roundedEdges),'roundedEdges'),requiresAnchoring:fact(boolean(raw.requiresAnchoring),'requiresAnchoring'),
    groundClearanceCm:fact(nonnegative(raw.groundClearanceCm),'groundClearanceCm'),storageCapacityLiters:fact(nonnegative(raw.storageCapacityLiters),'storageCapacityLiters')};
  return result;
}
