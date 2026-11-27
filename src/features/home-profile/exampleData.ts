import { adaptDiscoveryProduct } from '../product-evaluation/adaptProduct.ts';
import type { HomeProfile } from '../../../shared/home-profile.ts';
/** Entirely fictional examples, not retailer claims or real measurements. */
export const exampleProducts=[
  adaptDiscoveryProduct({id:'fit-demo-compact',name:'예시 A · 세탁 커버 소파',category:'sofa',brand:'가상 브랜드 A',sourceLabel:'가상 판매처 A',dataMode:'demo',
    dimensions:{widthCm:160,depthCm:80,heightCm:82},packages:[{id:'box-a',name:'포장 1',widthCm:150,depthCm:80,heightCm:50}],packagesComplete:true,
    price:{amount:390000,currency:'KRW'},delivery:{fee:{amount:30000,currency:'KRW'},tax:{amount:0,currency:'KRW'},available:true,region:'서울',service:'room',days:7},
    materials:['가상 패브릭','가상 원목 다리'],careInstructions:'예시: 커버 분리 세탁 가능, 제품별 세탁 라벨 확인',careDifficulty:'low',
    washableCovers:true,scratchResistant:undefined,roundedEdges:true,requiresAnchoring:false,groundClearanceCm:12}),
  adaptDiscoveryProduct({id:'fit-demo-wide',name:'예시 B · 넓은 수납 소파',category:'sofa',brand:'가상 브랜드 B',sourceLabel:'가상 판매처 B',dataMode:'demo',
    dimensions:{widthCm:210,depthCm:100,heightCm:90},packages:[{id:'box-b',name:'포장 1',widthCm:215,depthCm:100,heightCm:85}],packagesComplete:true,
    price:{amount:690000,currency:'KRW'},delivery:{fee:{amount:80000,currency:'KRW'},tax:{amount:0,currency:'KRW'},available:true,region:'서울',service:'doorstep',days:14},
    materials:['가상 고정 패브릭'],careInstructions:'예시: 커버 분리 불가, 전문 세척 필요',careDifficulty:'high',washableCovers:false,roundedEdges:false,
    groundClearanceCm:6,storageCapacityLiters:90}),
];
const cm=(value:number)=>({value,source:'demo' as const,note:'가상 측정 예시'});
export const exampleHome:HomeProfile={schemaVersion:1,id:'example-home',name:'가상 예시 · 4×3m 방',updatedAt:'2026-11-27T00:00:00.000Z',
  room:{widthCm:cm(400),depthCm:cm(300),heightCm:cm(260)},roomLayoutReviewed:true,
  zones:[{id:'demo-door',name:'방 문 열림 예시',kind:'door-swing',xCm:0,yCm:210,widthCm:80,depthCm:90,evidence:'demo'}],
  deliveryRoute:[{id:'entrance',name:'현관문 예시',kind:'door',widthCm:cm(80),heightCm:cm(200),hasTurn:false},
    {id:'elevator-door',name:'엘리베이터 문 예시',kind:'door',widthCm:cm(80),heightCm:cm(200),hasTurn:false},
    {id:'elevator',name:'엘리베이터 내부 예시',kind:'elevator',widthCm:cm(140),heightCm:cm(220),depthCm:cm(120),hasTurn:true}],deliveryRouteComplete:true,
  placements:{'fit-demo-compact':{xCm:100,yCm:80,rotation:0,walkingSide:'bottom'},'fit-demo-wide':{xCm:100,yCm:80,rotation:0,walkingSide:'bottom'}},
  preferences:{category:'sofa',budget:{amount:600000,currency:'KRW'},deliveryRegion:'서울',requiredDelivery:'room',maxDeliveryDays:10,pets:true,washableCovers:true,scratchResistance:false,
    children:false,roundedEdges:false,robotVacuum:true,robotHeightCm:9,robotMarginCm:1,minStorageLiters:undefined,lowMaintenance:true,minWalkwayCm:80,handlingMarginCm:2}};
