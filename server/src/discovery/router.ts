import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors.ts';
import { productCategories, discoveryDemoProducts, filterProducts, retailerLinks } from '../../../shared/discovery.ts';
import type { DiscoveryProduct, ProductSearch, SourceStatus, ProductSource } from '../../../shared/discovery.ts';
import { searchAmazon, searchEbay, loadIkeaFeed } from './providers.ts';
const categories=productCategories.map(c=>c.id);
const schema=z.object({q:z.string().trim().max(150).default(''),brand:z.string().trim().max(100).default(''),
  category:z.enum(categories as [ProductSearch['category'],...ProductSearch['category'][]]).default('all'),
  source:z.enum(['all','demo','amazon','ebay','ikea']).default('all'),sort:z.enum(['relevance','price-asc','price-desc']).default('relevance'),
  page:z.coerce.number().int().min(1).max(10).default(1)}).strict();
export function createDiscoveryRouter(){
  const router=Router();let windowStart=Date.now();let attempts=0;let active=0;
  router.get('/',async(req,res)=>{
    const parsed=schema.safeParse(req.query);
    if(!parsed.success)throw new AppError(400,'INVALID_INPUT','검색어는 150자, 브랜드는 100자 이내로 입력하고 지원되는 종류·판매처를 선택해 주세요.');
    const input=parsed.data;
    if(Date.now()-windowStart>60000){windowStart=Date.now();attempts=0;}
    if(attempts>=60||active>=4)throw new AppError(429,'BUSY','상품 검색이 많아요. 잠시 후 다시 검색해 주세요.',true);
    attempts++;active++;
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
    const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
    try{
      const sources:SourceStatus[]=[];let products:DiscoveryProduct[]=[];let hasMore=false;
      const wanted=(source:ProductSource)=>input.source==='all'||input.source===source;
      if(wanted('demo')){
        const local=filterProducts(discoveryDemoProducts,input);
        products.push(...local.slice((input.page-1)*20,input.page*20));hasMore=local.length>input.page*20;
        sources.push({source:'demo',status:'ready',message:'가상 샘플 상품입니다. 실제 판매 상품이 아닙니다.'});
      }
      const jobs:Promise<void>[]=[];
      if(wanted('ikea'))jobs.push((async()=>{
        if(!process.env.IKEA_CATALOG_PATH){sources.push({source:'ikea',status:'not-configured',message:'IKEA 상품 데이터는 아직 연결되지 않았어요. 공식 사이트에서 검색할 수 있어요.'});return;}
        try{const items=filterProducts(await loadIkeaFeed(),input);products.push(...items.slice((input.page-1)*20,input.page*20));hasMore ||= items.length>input.page*20;
          sources.push({source:'ikea',status:'ready',message:'등록된 상품 피드입니다. 최신 가격과 재고는 IKEA에서 확인하세요.'});}
        catch{sources.push({source:'ikea',status:'error',message:'등록된 IKEA 상품 데이터를 읽지 못했어요.'});}
      })());
      for(const source of ['amazon','ebay'] as const){
        if(!wanted(source))continue;
        const configured=source==='amazon' ? !!(process.env.AMAZON_CLIENT_ID&&process.env.AMAZON_CLIENT_SECRET&&process.env.AMAZON_PARTNER_TAG) : !!(process.env.EBAY_CLIENT_ID&&process.env.EBAY_CLIENT_SECRET);
        if(!configured){sources.push({source,status:'not-configured',message:`${source==='amazon'?'Amazon':'eBay'} 상품 검색 연결이 아직 준비되지 않았어요. 판매처에서 직접 검색할 수 있어요.`});continue;}
        jobs.push((async()=>{try{
          const result=await (source==='amazon'?searchAmazon:searchEbay)(input,controller.signal);
          products.push(...result.products);hasMore ||= result.hasMore;
          sources.push({source,status:'ready',message:'실시간 검색 결과입니다. 가격과 배송 조건은 판매처에서 다시 확인하세요.'});
        }catch{sources.push({source,status:'error',message:'판매처 검색에 연결하지 못했어요. 잠시 후 다시 시도하거나 판매처에서 검색해 주세요.'});}})());
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
