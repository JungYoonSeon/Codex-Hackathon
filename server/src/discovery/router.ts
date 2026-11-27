import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors.ts';
import { productCategories, discoveryDemoProducts, filterProducts, retailerLinks } from '../../../shared/discovery.ts';
import type { DiscoveryProduct, ProductSearch, SourceStatus, ProductSource } from '../../../shared/discovery.ts';
import { searchAmazon, searchEbay, loadIkeaFeed } from './providers.ts';
import { loadVerifiedRecords } from './verifiedRecords.ts';
import { readCoupangConfig, isCoupangConfigured, searchCoupang } from './coupang.ts';
import { toConnectorError, userMessageFor } from './errors.ts';

const categories=productCategories.map(c=>c.id);
const schema=z.object({q:z.string().trim().max(150).default(''),brand:z.string().trim().max(100).default(''),
  category:z.enum(categories as [ProductSearch['category'],...ProductSearch['category'][]]).default('all'),
  source:z.enum(['all','demo','amazon','ebay','ikea','coupang']).default('all'),sort:z.enum(['relevance','price-asc','price-desc']).default('relevance'),
  page:z.coerce.number().int().min(1).max(10).default(1)}).strict();

type Search = (input: ProductSearch, signal: AbortSignal) => Promise<{ products: DiscoveryProduct[]; hasMore: boolean }>;
/** Injectable for tests; defaults are the real connectors and process.env. */
export interface DiscoveryDeps {
  env: NodeJS.ProcessEnv;
  searchAmazon: Search; searchEbay: Search;
  loadIkeaFeed: () => Promise<DiscoveryProduct[]>;
  loadVerifiedRecords: () => DiscoveryProduct[];
  searchCoupang: typeof searchCoupang;
  providerTimeoutMs: number;
}

export function createDiscoveryRouter(overrides: Partial<DiscoveryDeps> = {}){
  const deps: DiscoveryDeps = { env: process.env, searchAmazon, searchEbay, loadIkeaFeed, loadVerifiedRecords, searchCoupang, providerTimeoutMs: 12000, ...overrides };
  const router=Router();let windowStart=Date.now();let attempts=0;let active=0;
  router.get('/',async(req,res)=>{
    const parsed=schema.safeParse(req.query);
    if(!parsed.success)throw new AppError(400,'INVALID_INPUT','검색어는 150자, 브랜드는 100자 이내로 입력하고 지원되는 종류·판매처를 선택해 주세요.');
    const input=parsed.data as ProductSearch;
    if(Date.now()-windowStart>60000){windowStart=Date.now();attempts=0;}
    if(attempts>=60||active>=4)throw new AppError(429,'BUSY','상품 검색이 많아요. 잠시 후 다시 검색해 주세요.',true);
    attempts++;active++;
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),deps.providerTimeoutMs);
    const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
    try{
      const sources:SourceStatus[]=[];let products:DiscoveryProduct[]=[];let hasMore=false;
      const wanted=(source:ProductSource)=>input.source==='all'||input.source===source;
      const page=<T,>(items:T[])=>{hasMore ||= items.length>input.page*20;return items.slice((input.page-1)*20,input.page*20);};
      if(wanted('demo')){
        products.push(...page(filterProducts(discoveryDemoProducts,input)));
        sources.push({source:'demo',status:'ready',message:'가상 샘플 상품입니다. 실제 판매 상품이 아닙니다.'});
      }
      const jobs:Promise<void>[]=[];
      if(wanted('ikea'))jobs.push((async()=>{
        // Reviewed snapshots are always available and always labelled as snapshots (dataMode 'verified_snapshot').
        let snapshots:DiscoveryProduct[]=[];let snapshotNote='';
        try{
          const all=deps.loadVerifiedRecords();snapshots=filterProducts(all,input);
          const dates=[...new Set(all.map(p=>p.retrievedAt?.slice(0,10)).filter(Boolean))].join(', ');
          snapshotNote=`검증된 IKEA 한국 상품 스냅샷 ${all.length}개(${dates} 기준)를 보여줘요. 실시간 연결이 아니므로 가격·재고는 IKEA에서 확인하세요.`;
        }catch{snapshotNote='검증된 IKEA 스냅샷 데이터를 읽지 못했어요.';}
        if(!deps.env.IKEA_CATALOG_PATH){
          products.push(...page(snapshots));
          sources.push({source:'ikea',status:'not-configured',reason:'snapshot',message:`IKEA 실시간 상품 API는 공개되어 있지 않아요. ${snapshotNote}`});return;
        }
        try{
          const feed=await deps.loadIkeaFeed();
          products.push(...page([...snapshots,...filterProducts(feed,input)]));
          sources.push({source:'ikea',status:'ready',message:`등록된 상품 피드입니다. 최신 가격과 재고는 IKEA에서 확인하세요. ${snapshotNote}`});
        }catch(error){
          products.push(...page(snapshots));
          const e=toConnectorError(error);
          sources.push({source:'ikea',status:'error',reason:e.kind,message:`등록된 IKEA 상품 피드를 읽지 못했어요. ${snapshotNote}`});
        }
      })());
      for(const source of ['amazon','ebay'] as const){
        if(!wanted(source))continue;
        const configured=source==='amazon' ? !!(deps.env.AMAZON_CLIENT_ID&&deps.env.AMAZON_CLIENT_SECRET&&deps.env.AMAZON_PARTNER_TAG) : !!(deps.env.EBAY_CLIENT_ID&&deps.env.EBAY_CLIENT_SECRET);
        if(!configured){sources.push({source,status:'not-configured',message:source==='amazon'
          ?'Amazon 상품 검색 연결이 아직 준비되지 않았어요(Creators API 승인 필요). Amazon에는 한국 마켓플레이스가 없어 해외 가격·배송 기준이에요.'
          :'eBay 상품 검색 연결이 아직 준비되지 않았어요. 판매처에서 직접 검색할 수 있어요.'});continue;}
        jobs.push((async()=>{try{
          const result=await (source==='amazon'?deps.searchAmazon:deps.searchEbay)(input,controller.signal);
          products.push(...result.products);hasMore ||= result.hasMore;
          sources.push({source,status:'ready',message:'실시간 검색 결과입니다. 가격과 배송 조건은 판매처에서 다시 확인하세요.'});
        }catch(error){const e=toConnectorError(error,controller.signal);sources.push({source,status:'error',reason:e.kind,message:userMessageFor(e.kind)});}})());
      }
      if(wanted('coupang')){
        const config=readCoupangConfig(deps.env);
        if(!isCoupangConfigured(config)){
          sources.push({source:'coupang',status:'not-configured',message:'쿠팡 상품 데이터는 아직 연결되지 않았어요(쿠팡 파트너스 API 승인·키 필요). 쿠팡에서 직접 검색할 수 있어요.'});
        }else jobs.push((async()=>{try{await deps.searchCoupang(config);}catch(error){
          const e=toConnectorError(error);
          sources.push({source:'coupang',status:'error',reason:e.kind,message:'쿠팡 API 키는 있지만 공식 API 규격 확인 전이라 요청을 보내지 않았어요.'});
        }})());
      }
      await Promise.all(jobs);
      products=[...new Map(products.map(p=>[p.id,p])).values()];
      if(input.sort!=='relevance')products.sort((a,b)=>{
        if(!a.price&&!b.price)return a.id.localeCompare(b.id);if(!a.price)return 1;if(!b.price)return -1;
        return a.price.currency.localeCompare(b.price.currency)||(a.price.amount-b.price.amount)*(input.sort==='price-asc'?1:-1);
      });
      else products.sort((a,b)=>Number(a.dataMode==='demo')-Number(b.dataMode==='demo'));
      if(!res.destroyed)res.json({products,sources:sources.sort((a,b)=>a.source.localeCompare(b.source)),page:input.page,hasMore,links:retailerLinks(input)});
    }finally{clearTimeout(timeout);res.off('close',close);active--;}
  });
  return router;
}
