import React, {useState} from 'react';
import {Alert, Text, View} from 'react-native';
import {Button, Header, Notice, Screen, ui} from '../../ui.js';
import {newHomeProfile, profileProblems} from '../../../shared/home-profile';
import {Chip, Field, MeasurementField, Toggle, numericText, s} from './components.js';
const field=e=>({text:e?.value===undefined?'':String(e.value),source:e?.source??'measured'});
const dims=r=>({widthCm:field(r?.widthCm),depthCm:field(r?.depthCm),heightCm:field(r?.heightCm)});
const id=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
const routeKinds=[['door','문·엘리베이터 입구'],['corridor','복도'],['elevator','엘리베이터 내부'],['stairs','계단']];
export function HomeProfileEditor({profile,onSave,onCancel}){
  const [base]=useState(()=>profile??newHomeProfile());const [name,setName]=useState(base.name);const [tab,setTab]=useState('room');
  const [room,setRoom]=useState(()=>dims(base.room));const [zones,setZones]=useState(()=>base.zones.map(z=>({...z,xCm:String(z.xCm),yCm:String(z.yCm),widthCm:String(z.widthCm),depthCm:String(z.depthCm)})));
  const [layoutReviewed,setLayoutReviewed]=useState(base.roomLayoutReviewed);const [routeComplete,setRouteComplete]=useState(base.deliveryRouteComplete);
  const [route,setRoute]=useState(()=>base.deliveryRoute.map(r=>({...r,...dims(r)})));
  const [prefs,setPrefs]=useState({...base.preferences,budgetAmount:base.preferences.budget?.amount?.toString()??'',currency:base.preferences.budget?.currency??'KRW'});
  const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const pref=(key,value)=>setPrefs(p=>({...p,[key]:value}));
  const convert=(f,label)=>{const value=numericText(f.text,label);return value===undefined?undefined:{value,source:f.source,checkedAt:new Date().toISOString()};};
  const save=async()=>{
    setError('');try{
      const amount=numericText(prefs.budgetAmount,'예산',true);
      const next={...base,name:name.trim(),updatedAt:new Date().toISOString(),
        room:Object.fromEntries(Object.entries(room).map(([k,f])=>[k,convert(f,'방 치수')])),roomLayoutReviewed:layoutReviewed,deliveryRouteComplete:routeComplete,
        zones:zones.map(z=>({...z,xCm:numericText(z.xCm,'영역 왼쪽 위치',true),yCm:numericText(z.yCm,'영역 위쪽 위치',true),widthCm:numericText(z.widthCm,'영역 가로'),depthCm:numericText(z.depthCm,'영역 깊이')})),
        deliveryRoute:route.map(r=>({...r,widthCm:convert(r.widthCm,'경로 폭'),heightCm:convert(r.heightCm,'경로 높이'),depthCm:convert(r.depthCm,'내부 깊이')})),
        preferences:{...base.preferences,...prefs,budget:amount===undefined?undefined:{amount,currency:prefs.currency.trim().toUpperCase()},
          robotHeightCm:numericText(prefs.robotHeightCm,'로봇 높이'),robotMarginCm:numericText(prefs.robotMarginCm,'로봇 여유',true),
          minStorageLiters:numericText(prefs.minStorageLiters,'수납량'),maxDeliveryDays:numericText(prefs.maxDeliveryDays,'배송 일수'),
          minWalkwayCm:numericText(prefs.minWalkwayCm,'목표 통로'),handlingMarginCm:numericText(prefs.handlingMarginCm,'운반 여유',true)},
      };
      delete next.preferences.budgetAmount;delete next.preferences.currency;
      const issues=profileProblems(next);if(issues.length)throw new Error(issues.join('\n'));
      setSaving(true);await onSave(next);
    }catch(e){setError(e.message||'저장하지 못했습니다.');}finally{setSaving(false);}
  };
  return <Screen><Header onBack={()=>Alert.alert('편집을 닫을까요?','저장하지 않은 변경은 반영되지 않습니다.',[{text:'계속 편집',style:'cancel'},{text:'닫기',onPress:onCancel}])} label="MY HOME"/>
    <Text style={ui.title}>집 한 번 측정하고, 계속 비교하기</Text><Text style={ui.body}>모르는 값은 비워 두세요. 사진 추정값을 직접 측정한 값으로 표시하지 마세요. 측정 내용은 이 기기에 저장됩니다.</Text>
    <Field label="프로필 이름" value={name} onChange={setName}/><View style={s.row}>{[['room','방·문 열림'],['route','배송 경로'],['life','생활·예산']].map(([key,title])=><Chip key={key} title={title} selected={tab===key} onPress={()=>setTab(key)}/>)}</View>
    {tab==='room'&&<>
      <Notice title="좌표 기준">방을 위에서 봤을 때 왼쪽 위가 (0, 0)입니다. 가로는 오른쪽, 깊이는 아래쪽입니다. 모든 치수는 cm입니다.</Notice>
      {[['widthCm','방 가로 (cm)'],['depthCm','방 깊이 (cm)'],['heightCm','천장 유효 높이 (cm)']].map(([k,label])=><MeasurementField key={k} label={label} value={room[k]} onChange={v=>{setRoom(r=>({...r,[k]:v}));setLayoutReviewed(false);}}/>)}
      <Text style={s.section}>기존 물건과 문 열림 영역</Text><Text style={s.small}>문이 열리며 차지하는 범위를 감싸는 사각형을 표시하세요. 실제 문 회전 곡선을 계산하지 않습니다.</Text>
      {zones.map((z,i)=><View style={s.card} key={z.id}>
        <Field label={`영역 ${i+1} 이름`} value={z.name} onChange={name=>{setZones(a=>a.map(v=>v.id===z.id?{...v,name}:v));setLayoutReviewed(false);}}/>
        <View style={s.row}>{[['obstacle','기존 물건'],['door-swing','문 열림']].map(([kind,title])=><Chip key={kind} title={title} selected={z.kind===kind} onPress={()=>{setZones(a=>a.map(v=>v.id===z.id?{...v,kind}:v));setLayoutReviewed(false);}}/>)}</View>
        {[['xCm','왼쪽 벽에서 거리'],['yCm','위쪽 벽에서 거리'],['widthCm','영역 가로'],['depthCm','영역 깊이']].map(([k,label])=><Field key={k} numeric label={`${label} (cm)`} value={z[k]} onChange={value=>{setZones(a=>a.map(v=>v.id===z.id?{...v,[k]:value}:v));setLayoutReviewed(false);}}/>)}
        <View style={s.row}>{[['measured','직접 측정'],['estimated','추정']].map(([evidence,title])=><Chip key={evidence} title={title} selected={z.evidence===evidence} onPress={()=>{setZones(a=>a.map(v=>v.id===z.id?{...v,evidence}:v));setLayoutReviewed(false);}}/>)}</View>
        <Button secondary small title="이 영역 제거" onPress={()=>{setZones(a=>a.filter(v=>v.id!==z.id));setLayoutReviewed(false);}}/>
      </View>)}
      <Button secondary title="물건·문 열림 영역 추가" onPress={()=>{setZones(a=>[...a,{id:id('zone'),name:'문 열림',kind:'door-swing',xCm:'',yCm:'',widthCm:'',depthCm:'',evidence:'measured'}]);setLayoutReviewed(false);}}/>
      <Toggle title="기존 물건과 문 열림을 모두 확인했어요" value={layoutReviewed} onChange={setLayoutReviewed} hint="아무 영역도 없으면 빈 공간임을 확인하는 뜻입니다. 표시하지 않은 장애물은 검사할 수 없습니다."/>
    </>}
    {tab==='route'&&<>
      <Notice title="배송할 때 지나가는 순서로">현관 → 복도 → 엘리베이터 문 → 내부 → 계단 → 방 문을 필요한 만큼 추가하세요. 문 폭은 실제로 통과할 수 있는 폭을 재세요. 계단과 회전은 배송업체 확인이 필요합니다.</Notice>
      {route.map((r,i)=><View key={r.id} style={s.card}><Text style={s.section}>구간 {i+1}</Text><Field label="구간 이름" value={r.name} onChange={name=>{setRoute(a=>a.map(v=>v.id===r.id?{...v,name}:v));setRouteComplete(false);}}/><View style={s.row}>{routeKinds.map(([kind,title])=><Chip key={kind} title={title} selected={r.kind===kind} onPress={()=>{setRoute(a=>a.map(v=>v.id===r.id?{...v,kind,hasTurn:kind==='stairs'?true:v.hasTurn}:v));setRouteComplete(false);}}/>)}</View>
        {[['widthCm','유효 폭 (cm)'],['heightCm','유효 높이 (cm)'],...(r.kind==='elevator'?[['depthCm','내부 깊이 (cm)']]:[])].map(([k,label])=><MeasurementField key={k} label={label} value={r[k]} onChange={value=>{setRoute(a=>a.map(v=>v.id===r.id?{...v,[k]:value}:v));setRouteComplete(false);}}/>)}
        <Toggle title="이 구간에 회전·꺾임이 있어요" value={r.hasTurn} onChange={hasTurn=>{setRoute(a=>a.map(v=>v.id===r.id?{...v,hasTurn}:v));setRouteComplete(false);}}/>
        <View style={s.row}>{i>0&&<Button secondary small title="위로 이동" onPress={()=>{setRoute(a=>{const b=[...a];[b[i-1],b[i]]=[b[i],b[i-1]];return b;});setRouteComplete(false);}}/>}<Button secondary small title="구간 제거" onPress={()=>{setRoute(a=>a.filter(v=>v.id!==r.id));setRouteComplete(false);}}/></View>
      </View>)}
      <Button secondary title="배송 구간 추가" onPress={()=>{setRoute(a=>[...a,{id:id('route'),name:'현관문',kind:'door',...dims({}),hasTurn:false}]);setRouteComplete(false);}}/>
      <Field numeric label="운반 여유 · 각 면에 추가할 cm" value={prefs.handlingMarginCm} onChange={v=>pref('handlingMarginCm',v)} hint="기본 2 cm는 변경 가능한 개인 목표이며 배송업체 기준이 아닙니다."/>
      <Toggle title="입구부터 방까지 모든 구간을 기록했어요" value={routeComplete} onChange={setRouteComplete}/>
    </>}
    {tab==='life'&&<>
      <Text style={s.section}>예산과 배송</Text><Field numeric label="총예산 · 상품+배송+세금" value={prefs.budgetAmount} onChange={v=>pref('budgetAmount',v)}/><Field label="통화 코드" value={prefs.currency} onChange={v=>pref('currency',v.toUpperCase())} placeholder="KRW / USD / EUR"/>
      <Field label="배송 지역·우편번호" value={prefs.deliveryRegion} onChange={v=>pref('deliveryRegion',v)} hint="판매처 견적에 기재된 지역과 비교합니다. 상세 주소는 입력하지 않아도 됩니다."/>
      <View style={s.row}>{[['any','서비스 조건 없음'],['room','방 안 운반 필요'],['assembly','조립까지 필요']].map(([value,title])=><Chip key={value} title={title} selected={prefs.requiredDelivery===value} onPress={()=>pref('requiredDelivery',value)}/>)}</View>
      <Field numeric label="희망 배송 기간 · 최대 일수" value={prefs.maxDeliveryDays} onChange={v=>pref('maxDeliveryDays',v)}/>
      <Text style={s.section}>생활 조건</Text><Toggle title="반려동물이 있어요" value={prefs.pets} onChange={v=>pref('pets',v)}/>
      <Toggle title="커버 분리 세탁을 원해요" value={prefs.washableCovers} onChange={v=>pref('washableCovers',v)}/><Toggle title="스크래치 저항성 설명을 확인하고 싶어요" value={prefs.scratchResistance} onChange={v=>pref('scratchResistance',v)}/>
      <Toggle title="어린이가 함께 생활해요" value={prefs.children} onChange={v=>pref('children',v)}/>{prefs.children&&<><Text style={s.label}>집에서 벽 고정이 가능한가요?</Text><View style={s.row}>{[[undefined,'모름'],[true,'가능'],[false,'불가능']].map(([value,title])=><Chip key={title} title={title} selected={prefs.wallAnchoringAllowed===value} onPress={()=>pref('wallAnchoringAllowed',value)}/>)}</View><Notice>어린이 안전 판정이 아닙니다. 고정·끼임·전도 위험과 설치 방법은 제조사에 확인해야 합니다.</Notice></>}
      <Toggle title="둥근 모서리를 선호해요" value={prefs.roundedEdges} onChange={v=>pref('roundedEdges',v)}/>
      <Toggle title="청소 로봇이 가구 아래로 들어가야 해요" value={prefs.robotVacuum} onChange={v=>pref('robotVacuum',v)}/>{prefs.robotVacuum&&<><Field numeric label="로봇 전체 높이 (cm)" value={prefs.robotHeightCm} onChange={v=>pref('robotHeightCm',v)}/><Field numeric label="로봇 높이 여유 (cm)" value={prefs.robotMarginCm} onChange={v=>pref('robotMarginCm',v)}/></>}
      <Field numeric label="필요한 수납량 (L, 선택)" value={prefs.minStorageLiters} onChange={v=>pref('minStorageLiters',v)}/><Toggle title="관리하기 쉬운 제품을 원해요" value={prefs.lowMaintenance} onChange={v=>pref('lowMaintenance',v)}/>
      <Field numeric label="원하는 직선 통로 폭 (cm)" value={prefs.minWalkwayCm} onChange={v=>pref('minWalkwayCm',v)} hint="기본 60 cm는 개인 목표 예시이며 건축·접근성 기준이 아닙니다."/>
    </>}
    {error?<Text style={[ui.errorText,{marginVertical:12}]} accessibilityLiveRegion="polite">{error}</Text>:null}
    <Button title={saving?'저장 중…':'측정·생활 조건 저장'} disabled={saving} onPress={save}/>
  </Screen>;
}
