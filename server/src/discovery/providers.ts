import type { DiscoveryProduct, ProductCategory, ProductSearch } from '../../../shared/discovery.ts';
import { productCategories } from '../../../shared/discovery.ts';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';

// Runtime retailer data is untrusted. URLs are limited to the source's public pages/CDNs.
function url(value: unknown, hosts: string[]): string | undefined {
  if (typeof value!=='string') return undefined;
  try { const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password && hosts.some(h=>u.hostname===h || u.hostname.endsWith(`.${h}`)) ? u.href : undefined; } catch { return undefined; }
}
function text(value: unknown): string { return typeof value==='string'?value.slice(0,1500):''; }
function categoryFor(title: string, selected: ProductSearch['category']): ProductCategory {
  if (selected!=='all') return selected;
  const t=title.toLowerCase();
  const patterns: [ProductCategory,RegExp][]=[['sofa',/sofa|couch|소파/],['wardrobe',/wardrobe|옷장/],['shelf',/shelf|bookcase|bookshelf|책장|선반/],['desk',/desk|책상/],['bed',/\bbed\b|bedframe|침대/],['chair',/chair|stool|의자/],['table',/table|테이블|식탁/],['lighting',/lamp|lighting|조명/],['rug',/rug|carpet|러그/],['outdoor',/outdoor|garden|야외/],['storage',/cabinet|dresser|수납/]];
  return patterns.find(([,re])=>re.test(t))?.[0]??'other';
}
export function searchTerms(input: ProductSearch): string {
  const category=productCategories.find(c=>c.id===input.category)?.query??'furniture';
  return [input.q,input.brand,input.category==='all'&&input.q?'':category].filter(Boolean).join(' ');
}
async function json(url: string, init: RequestInit, signal: AbortSignal): Promise<any> {
  const res=await fetch(url,{...init,signal});
  if(!res.ok) throw new Error(`Retailer HTTP ${res.status}`);
  const length=Number(res.headers.get('content-length')??0);
  if(length>3_000_000) throw new Error('Retailer response too large');
  const reader=res.body?.getReader();if(!reader)throw new Error('Empty retailer response');
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>3_000_000){await reader.cancel();throw new Error('Retailer response too large');}chunks.push(value);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
let amazonToken={value:'',expires:0};let ebayToken={value:'',expires:0};
export async function searchAmazon(input: ProductSearch, signal: AbortSignal): Promise<{products:DiscoveryProduct[];hasMore:boolean}> {
  const marketplace=process.env.AMAZON_MARKETPLACE||'www.amazon.com';
  if(!['www.amazon.com','www.amazon.co.uk','www.amazon.co.jp'].includes(marketplace))throw new Error('Unsupported configured marketplace');
  if(!amazonToken.value || amazonToken.expires<Date.now()){
    const region=process.env.AMAZON_CREDENTIAL_VERSION||'3.1';
    const host=({'3.1':'api.amazon.com','3.2':'api.amazon.co.uk','3.3':'api.amazon.co.jp'} as Record<string,string>)[region];
    if(!host)throw new Error('Invalid credential version');
    const token=await json(`https://${host}/auth/o2/token`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:process.env.AMAZON_CLIENT_ID,client_secret:process.env.AMAZON_CLIENT_SECRET,scope:'creatorsapi::default'})},signal);
    if(!token.access_token)throw new Error('No Amazon token');
    amazonToken={value:token.access_token,expires:Date.now()+(Number(token.expires_in)||3600)*1000-60000};
  }
  const result=await json('https://creatorsapi.amazon/catalog/v1/searchItems',{method:'POST',headers:{Authorization:`Bearer ${amazonToken.value}`,'Content-Type':'application/json','x-marketplace':marketplace},body:JSON.stringify({marketplace,partnerTag:process.env.AMAZON_PARTNER_TAG,keywords:searchTerms(input),...(input.brand?{brand:input.brand}:{}),itemCount:10,itemPage:input.page,resources:['images.primary.medium','itemInfo.title','itemInfo.byLineInfo','itemInfo.features','offersV2.listings.price']})},signal);
  if(result.errors?.length && !result.searchResult?.items)throw new Error('Amazon search rejected');
  const products:DiscoveryProduct[]=(result.searchResult?.items??[]).flatMap((item:any)=>{
    const name=text(item.itemInfo?.title?.displayValue);const productUrl=url(item.detailPageURL,['amazon.com','amazon.co.uk','amazon.co.jp']);
    if(!name||!productUrl||!item.asin)return [];
    const money=item.offersV2?.listings?.[0]?.price?.money;
    return [{id:`amazon:${text(item.asin)}`,name,brand:text(item.itemInfo?.byLineInfo?.brand?.displayValue)||undefined,
      category:categoryFor(name,input.category),source:'amazon',sourceLabel:'Amazon',dataMode:'live',
      description:(item.itemInfo?.features?.displayValues??[]).filter((v:unknown)=>typeof v==='string').slice(0,3).join(' ').slice(0,1500),tags:[],productUrl,
      imageUrl:url(item.images?.primary?.medium?.url,['media-amazon.com','ssl-images-amazon.com']),
      ...(money&&Number.isFinite(Number(money.amount))&&Number(money.amount)>=0?{price:{amount:Number(money.amount),currency:text(money.currency)}}:{}),
      matchReason:'Amazon 검색 결과 · 판매처에서 상품 정보와 배송을 확인하세요'}];
  });
  return {products,hasMore:input.page<10 && input.page*10<Number(result.searchResult?.totalResultCount??0)};
}
export async function searchEbay(input: ProductSearch, signal: AbortSignal): Promise<{products:DiscoveryProduct[];hasMore:boolean}> {
  if(!ebayToken.value || ebayToken.expires<Date.now()){
    const token=await json('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'https://api.ebay.com/oauth/api_scope'})},signal);
    if(!token.access_token)throw new Error('No eBay token');
    ebayToken={value:token.access_token,expires:Date.now()+(Number(token.expires_in)||7200)*1000-60000};
  }
  const params=new URLSearchParams({q:searchTerms(input),limit:'20',offset:String((input.page-1)*20)});
  if(input.sort!=='relevance')params.set('sort',input.sort==='price-asc'?'price':'-price');
  const data=await json(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,{headers:{Authorization:`Bearer ${ebayToken.value}`,'X-EBAY-C-MARKETPLACE-ID':'EBAY_US'}},signal);
  const products:DiscoveryProduct[]=(data.itemSummaries??[]).flatMap((item:any)=>{
    const productUrl=url(item.itemWebUrl,['ebay.com']);const name=text(item.title);
    if(!productUrl||!name||!item.itemId)return [];
    return [{id:`ebay:${text(item.itemId)}`,name,category:categoryFor(name,input.category),source:'ebay',sourceLabel:'eBay · 미국',dataMode:'live',
      description:text(item.condition),tags:[],productUrl,imageUrl:url(item.image?.imageUrl,['ebayimg.com']),
      ...(item.price&&Number.isFinite(Number(item.price.value))&&Number(item.price.value)>=0?{price:{amount:Number(item.price.value),currency:text(item.price.currency)}}:{}),
      matchReason:input.brand?'브랜드명을 포함한 키워드 검색 · 브랜드는 상품 페이지에서 확인하세요':'eBay 검색 결과 · 판매자와 배송을 확인하세요'}];
  });
  return {products,hasMore:!!data.next};
}
const categoryIds=productCategories.filter(c=>c.id!=='all').map(c=>c.id);
const feedItem=z.object({id:z.string().min(1).max(100),name:z.string().min(1).max(300),category:z.enum(categoryIds as [ProductCategory,...ProductCategory[]]),
  description:z.string().max(1500).default(''),tags:z.array(z.string().max(80)).max(30).default([]),productUrl:z.string().url(),imageUrl:z.string().url().optional(),
  dimensions:z.object({widthCm:z.number().positive().optional(),depthCm:z.number().positive().optional(),heightCm:z.number().positive().optional()}).optional(),
  price:z.object({amount:z.number().nonnegative(),currency:z.string().length(3)}).optional()}).strict();
export async function loadIkeaFeed():Promise<DiscoveryProduct[]> {
  const raw=await readFile(process.env.IKEA_CATALOG_PATH!);if(raw.length>5_000_000)throw new Error('Feed too large');
  const data=z.array(feedItem).max(5000).parse(JSON.parse(raw.toString('utf8')));
  return data.map(p=>{
    const productUrl=url(p.productUrl,['ikea.com']);const imageUrl=url(p.imageUrl,['ikea.com']);
    if(!productUrl)throw new Error('IKEA feed requires official product URLs');
    return {...p,id:`ikea:${p.id}`,brand:'IKEA',source:'ikea',sourceLabel:'IKEA · 등록된 카탈로그',dataMode:'feed',productUrl,imageUrl};
  });
}
