import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Text,View} from 'react-native';
import {Button,Header,Notice,Screen,ui} from '../../ui.js';
import {homeProfileStore} from '../../storage/homeProfiles.js';
import {newHomeProfile} from '../../../shared/home-profile';
import {HomeProfileEditor} from './HomeProfileEditor.js';
import {PlacementEditor} from './PlacementEditor.js';
import {ProductEvaluationScreen,verdictLabels,certaintyLabels} from '../product-evaluation/ProductEvaluationScreen.js';
import {ComparisonScreen} from '../comparison/ComparisonScreen.js';
import {rankProducts,RANKING_EXPLANATION} from '../product-evaluation/evaluateProduct';
import {formatDimensions} from '../comparison/compareProducts';
import {Chip,s} from './components.js';
const categories={chair:'의자',sofa:'소파',desk:'책상',table:'테이블',bed:'침대',storage:'수납장',shelf:'선반·책장',wardrobe:'옷장',lighting:'조명',rug:'러그',outdoor:'야외',other:'기타'};
/** Integrator mounts this screen; root App/navigation and retailer files remain untouched. */
export default function HomeFitWorkspace({products=[],roomPhoto,previewImages={},onBack,store=homeProfileStore,exampleProfile}){
  const [data,setData]=useState({profiles:[],comparisons:[]});const [activeId,setActiveId]=useState(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [view,setView]=useState('home');const [editing,setEditing]=useState(null);const [productId,setProductId]=useState(null);const [evaluationReturn,setEvaluationReturn]=useState('home');const [placementReturn,setPlacementReturn]=useState('home');
  const [selected,setSelected]=useState([]);const [saving,setSaving]=useState(false);
  const home=data.profiles.find(p=>p.id===activeId);const product=products.find(p=>p.id===productId);const pair=selected.map(id=>products.find(p=>p.id===id)).filter(Boolean);
  useEffect(()=>{let alive=true;store.load().then(next=>{if(alive){setData(next);setActiveId(next.profiles.at(-1)?.id??null);setLoading(false);}}).catch(e=>{if(alive){setError(e.message);setLoading(false);}});return()=>{alive=false;};},[store]);
  const saveProfile=async(profile)=>{const next=await store.save(profile);setData(next);setActiveId(profile.id);return next;};
  const navigateProduct=(id,to,back='home')=>{setProductId(id);if(to==='evaluate')setEvaluationReturn(back);if(to==='placement')setPlacementReturn(back);setView(to);};
  const updateCategory=async(category)=>{try{setSaving(true);setError('');await saveProfile({...home,preferences:{...home.preferences,category:category||undefined}});setSelected([]);}catch(e){setError(e.message);}finally{setSaving(false);}};
  if(view==='edit')return <HomeProfileEditor key={editing?.id??'new'} profile={editing} onCancel={()=>setView('home')} onSave={async p=>{await saveProfile(p);setView('home');}}/>;
  if(view==='placement'&&home&&product)return <PlacementEditor key={product.id} product={product} home={home} onBack={()=>setView(placementReturn)} onSave={async p=>{await saveProfile(p);setView(placementReturn);}}/>;
  if(view==='evaluate'&&home&&product)return <ProductEvaluationScreen key={product.id} product={product} home={home} onBack={()=>setView(evaluationReturn)} onEditPlacement={()=>navigateProduct(product.id,'placement','evaluate')}/>;
  if(view==='compare'&&home&&pair.length===2)return <ComparisonScreen key={`${home.id}-${pair.map(p=>p.id).join('-')}`} left={pair[0]} right={pair[1]} home={home} roomPhoto={roomPhoto} previewImages={previewImages} onBack={()=>setView('home')} onEvaluate={id=>navigateProduct(id,'evaluate','compare')} onEditPlacement={id=>navigateProduct(id,'placement','compare')} onSaveComparison={async()=>setData(await store.saveComparison(home.id,selected))}/>;
  const items=home?rankProducts(products,home):[];
  const choose=id=>{setSelected(ids=>ids.includes(id)?ids.filter(v=>v!==id):ids.length<2?[...ids,id]:[ids[0],id]);};
  return <Screen><Header onBack={onBack} label="HOME FIT & COMPARE"/><Text style={ui.title}>우리 집 조건으로 고르기</Text><Text style={ui.body}>방과 배송 경로를 저장하고, 가격보다 먼저 실제 생활 조건을 비교하세요.</Text>
    {loading?<ActivityIndicator/>:null}{error?<Notice tone="warn" title="저장소 확인 필요">{error}</Notice>:null}
    {data.recovered?<Notice tone="warn" title="백업에서 복구했어요">마지막 정상 저장본을 읽었습니다. 측정값을 확인하고 다시 저장해 주세요.</Notice>:null}
    <View style={s.row}>{data.profiles.map(p=><Chip key={p.id} title={p.name} selected={p.id===activeId} onPress={()=>{setActiveId(p.id);setSelected([]);}}/>)}</View>
    <Button secondary title="새 집·방 프로필 만들기" disabled={loading||!!error&&data.profiles.length===0} onPress={()=>{setEditing(null);setView('edit');}}/>
    {exampleProfile&&<View style={{marginTop:10}}><Button secondary title="가상 예시 측정값으로 둘러보기" disabled={loading} onPress={async()=>{try{setError('');const profile={...JSON.parse(JSON.stringify(exampleProfile)),id:newHomeProfile().id};await saveProfile(profile);}catch(e){setError(e.message);}}}/></View>}
    {home&&<>
      <View style={[s.card,{marginTop:18}]}><Text style={ui.sectionTitle}>{home.name}</Text><Text style={ui.body}>방 {home.room.widthCm?.value??'?'} × {home.room.depthCm?.value??'?'} cm · 배송 {home.deliveryRoute.length}구간 · 영역 {home.zones.length}개</Text><Text style={s.small}>마지막 저장 {home.updatedAt}</Text><View style={s.row}><Button small secondary title="측정·생활 조건 수정" onPress={()=>{setEditing(home);setView('edit');}}/><Button small secondary title="복사" onPress={async()=>{try{await saveProfile({...JSON.parse(JSON.stringify(home)),id:newHomeProfile().id,name:`${home.name} 복사`});}catch(e){setError(e.message);}}}/><Button small secondary title="삭제" onPress={()=>Alert.alert('프로필을 삭제할까요?','이 프로필의 저장된 비교 목록도 삭제합니다.',[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:async()=>{try{const next=await store.remove(home.id);setData(next);setActiveId(next.profiles.at(-1)?.id??null);setSelected([]);}catch(e){setError(e.message);}}}])}/></View></View>
      <Text style={s.section}>원하는 상품 종류</Text><View style={s.row}>{[...new Set(products.map(p=>p.category))].map(category=><Chip key={category} title={categories[category]??category} selected={home.preferences.category===category} onPress={()=>{if(!saving)updateCategory(category);}}/>)}</View>
      <Text style={s.small}>{RANKING_EXPLANATION}</Text>
      {!products.length?<Notice title="비교할 상품이 아직 없어요">판매처 검색에서 선택한 상품 목록을 이 화면에 전달하면 같은 집 조건으로 비교합니다.</Notice>:null}
      {!home.preferences.category&&new Set(products.map(p=>p.category)).size>1?<Notice>용도가 다른 상품을 섞어 추천하지 않도록 먼저 종류를 선택하세요.</Notice>:null}
      {items.map(({product:p,evaluation:e,rank})=><View key={p.id} style={[s.card,{marginTop:12}]}><Text style={s.status}>조건 비교 순서 {rank} · {p.demo?'가상 예시':p.retailer??'판매처 미제공'}</Text><Text style={ui.sectionTitle}>{p.name}</Text><Text style={ui.body}>{formatDimensions(p.dimensions)}</Text><Text style={[s.status,e.verdict!=='meets-entered-conditions'&&s.warn]}>{verdictLabels[e.verdict]}</Text><Text style={s.small}>{certaintyLabels[e.certainty]}</Text>{e.reasons.slice(0,2).map(reason=><Text key={reason} style={s.small}>✓ {reason}</Text>)}{e.tradeoffs.slice(0,2).map(reason=><Text key={reason} style={[s.small,s.warn]}>! {reason}</Text>)}<View style={s.row}><Button small secondary title="이유·확인할 항목" onPress={()=>navigateProduct(p.id,'evaluate')}/><Button small secondary title={selected.includes(p.id)?'✓ 비교 선택됨':'두 후보 비교에 추가'} onPress={()=>choose(p.id)}/></View></View>)}
      <Button title={`선택한 두 후보 비교 (${selected.length}/2)`} disabled={pair.length!==2||pair[0]?.id===pair[1]?.id} onPress={()=>setView('compare')}/>
      <Text style={s.small}>세 번째 후보를 선택하면 두 번째 후보가 교체됩니다. 확인 필요 항목이 적다고 안전 인증이나 실제 배송 보장을 뜻하지 않습니다.</Text>
      <Text style={s.section}>저장한 비교</Text>{data.comparisons.filter(c=>c.profileId===home.id).map(c=>{const available=c.productIds.every(id=>products.some(p=>p.id===id));return <View key={c.id} style={s.card}><Text style={s.label}>{c.productIds.map(id=>products.find(p=>p.id===id)?.name??`${id} (현재 목록에 없음)`).join(' / ')}</Text><Text style={s.small}>현재 프로필 측정값과 현재 상품 정보로 다시 계산합니다. 과거 가격을 저장한 견적이 아닙니다.</Text><View style={s.row}><Button small secondary disabled={!available} title="다시 비교" onPress={()=>{setSelected(c.productIds);setView('compare');}}/><Button small secondary title="비교 기록 제거" onPress={async()=>{try{setData(await store.removeComparison(c.id));}catch(e){setError(e.message);}}}/></View></View>;})}
    </>}
    <Notice title="측정값은 이 기기에만">프로필과 비교할 상품 ID를 로컬에 저장합니다. 사진·API 키·상품 이미지·가격 이력은 저장하지 않습니다. 앱 삭제 시 데이터도 사라질 수 있습니다.</Notice>
  </Screen>;
}
