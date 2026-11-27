import React,{useEffect,useState} from 'react';
import {Image,ScrollView,Text,View} from 'react-native';
import {Button,Header,Notice,Screen,ui,COLORS} from '../../ui.js';
import {compareProducts} from './compareProducts';
import {Chip,s} from '../home-profile/components.js';
import {certaintyLabels,verdictLabels} from '../product-evaluation/ProductEvaluationScreen.js';
function Layout({product,home}){
  const rw=home.room.widthCm?.value,rd=home.room.depthCm?.value,p=home.placements[product.id];
  const pw=product.dimensions.widthCm?.value,pd=product.dimensions.depthCm?.value;
  if(!rw||!rd||!p||!pw||!pd)return <Text style={s.small}>방·상품 치수와 배치를 입력하면 평면도를 표시합니다.</Text>;
  const scale=Math.min(230/rw,230/rd);const w=p.rotation===90?pd:pw,d=p.rotation===90?pw:pd;
  return <><View accessibilityLabel={`${product.name}의 실측 입력 기반 배치도`} style={{width:rw*scale,height:rd*scale,borderWidth:1,borderColor:COLORS.ink,backgroundColor:'#F7F5F0',overflow:'hidden',marginVertical:12}}>
    {home.zones.map(z=><View key={z.id} style={{position:'absolute',left:z.xCm*scale,top:z.yCm*scale,width:z.widthCm*scale,height:z.depthCm*scale,backgroundColor:z.kind==='door-swing'?'#E9AA89':'#B3B9B5',opacity:.8}}/>)}
    <View style={{position:'absolute',left:p.xCm*scale,top:p.yCm*scale,width:w*scale,height:d*scale,borderWidth:2,borderColor:COLORS.green,backgroundColor:'#94B39D'}}/>
  </View><Text style={s.small}>초록: 후보 · 회색: 기존 물건 · 주황: 문 열림</Text></>;
}
/** roomPhoto={photoId,source}; previewImages[id]={photoId,source,mode}. Mismatched rooms are never shown. */
export function ComparisonScreen({left,right,home,roomPhoto,previewImages={},onBack,onEvaluate,onEditPlacement,onSaveComparison}){
  const result=compareProducts(left,right,home);const [image,setImage]=useState('original');const [imageError,setImageError]=useState(false);
  useEffect(()=>{setImage('original');setImageError(false);},[roomPhoto?.photoId,left.id,right.id]);
  const [saved,setSaved]=useState(false);const [saveError,setSaveError]=useState('');
  const usable=p=>roomPhoto?.photoId&&previewImages[p.id]?.photoId===roomPhoto.photoId&&previewImages[p.id]?.source&&['live','saved_demo'].includes(previewImages[p.id]?.mode);
  const shown=image==='original'?roomPhoto?.source:usable(image===left.id?left:right)?previewImages[image].source:roomPhoto?.source;
  return <Screen><Header onBack={onBack} label="COMPARE TWO"/><Text style={ui.title}>같은 집, 두 후보 비교</Text><Text style={ui.body}>{home.name}에 저장된 동일한 측정값과 생활 조건을 적용했어요.</Text>
    {left.demo||right.demo?<Notice title="가상 상품 예시">가격·배송·소재를 포함한 예시 값은 실제 판매 정보가 아닙니다.</Notice>:null}
    {roomPhoto?.source?<>
      <View style={s.row}><Chip title="원본 방 사진" selected={image==='original'} onPress={()=>{setImage('original');setImageError(false);}}/>{[left,right].filter(usable).map((p,i)=><Chip key={p.id} title={`${p.name} · ${previewImages[p.id].mode==='saved_demo'?'저장 예시':'AI 결과'}`} selected={image===p.id} onPress={()=>{setImage(p.id);setImageError(false);}}/>)}</View>
      {shown&&!imageError?<Image source={shown} resizeMode="contain" onError={()=>setImageError(true)} accessibilityLabel={image==='original'?'두 후보에 공통인 원본 방 사진':'선택한 후보의 같은 방 미리보기'} style={{width:'100%',height:230,borderRadius:14}}/>:<Text style={ui.errorText}>이미지를 표시할 수 없습니다.</Text>}
      <Text style={s.small}>사진은 시각 참고용입니다. 통로·배송 수치는 아래의 측정 데이터로 별도 계산합니다. 같은 원본 사진 ID의 미리보기만 표시합니다.</Text>
    </>:<Notice>원본 방 사진을 전달하면 이곳에 표시합니다. 이 기능은 이미지를 생성하거나 사진에서 치수를 추출하지 않습니다.</Notice>}
    {(!usable(left)||!usable(right))&&<Text style={s.small}>후보별 방 합성 이미지가 아직 없거나 원본 사진이 다릅니다. 측정·상품 정보 비교는 계속할 수 있어요.</Text>}
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{gap:12,paddingVertical:14}}>
      {[{p:left,e:result.left},{p:right,e:result.right}].map(({p,e})=><View key={p.id} style={[s.card,{width:260}]}><Text style={ui.sectionTitle}>{p.name}</Text><Text style={s.small}>{p.retailer??'판매처 미제공'}</Text><Text style={[s.status,{marginTop:8},e.verdict!=='meets-entered-conditions'&&s.warn]}>{verdictLabels[e.verdict]}</Text><Text style={s.small}>{certaintyLabels[e.certainty]}</Text><Layout product={p} home={home}/><Button small secondary title="배치·통로 방향 수정" onPress={()=>onEditPlacement(p.id)}/><View style={{height:8}}/><Button small secondary title="판정 이유·출처 보기" onPress={()=>onEvaluate(p.id)}/></View>)}
    </ScrollView>
    {result.rows.map(row=><View key={row.label} style={s.card}><Text style={s.label}>{row.label}</Text><View style={{flexDirection:'row',gap:14}}><View style={{flex:1}}><Text style={s.small}>{left.name}</Text><Text style={ui.noticeText}>{row.left}</Text></View><View style={{flex:1}}><Text style={s.small}>{right.name}</Text><Text style={ui.noticeText}>{row.right}</Text></View></View>{row.note?<Text style={[s.small,{marginTop:8}]}>{row.note}</Text>:null}</View>)}
    {result.priceDifference?<Notice>같은 통화의 확인된 총비용 기준, {result.priceDifference.amount>=0?right.name:left.name}이 {Math.abs(result.priceDifference.amount).toLocaleString()} {result.priceDifference.currency} 더 높습니다.</Notice>:null}
    <Button title={saved?'비교 목록에 저장됨':'이 두 후보 비교 저장'} disabled={saved} onPress={async()=>{try{setSaveError('');await onSaveComparison();setSaved(true);}catch(e){setSaveError(e.message);}}}/>{saveError?<Text style={ui.errorText}>{saveError}</Text>:null}
    <Notice title="최종 구매 전 확인">대각 운반, 계단 회전, 출입구까지 연결된 통로, 제조사 설치 조건은 별도로 확인하세요. 조건 충족은 실제 배송·안전 보장이 아닙니다.</Notice>
  </Screen>;
}
