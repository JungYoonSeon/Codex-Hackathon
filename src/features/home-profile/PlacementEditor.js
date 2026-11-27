import React,{useState} from 'react';
import {Text,View} from 'react-native';
import {Button,Header,Notice,Screen,ui} from '../../ui.js';
import {Chip,Field,numericText,s} from './components.js';
export function PlacementEditor({product,home,onSave,onBack}){
  const existing=home.placements[product.id];
  const [x,setX]=useState(existing?.xCm?.toString()??'');const [y,setY]=useState(existing?.yCm?.toString()??'');
  const [rotation,setRotation]=useState(existing?.rotation??0);const [side,setSide]=useState(existing?.walkingSide??'bottom');
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const save=async()=>{try{setError('');const xCm=numericText(x,'왼쪽 위치',true),yCm=numericText(y,'위쪽 위치',true);if(xCm===undefined||yCm===undefined)throw new Error('두 위치를 모두 입력하세요. 벽에 붙이면 0입니다.');setBusy(true);await onSave({...home,placements:{...home.placements,[product.id]:{xCm,yCm,rotation,walkingSide:side}}});}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <Screen><Header onBack={onBack} label="PLACEMENT"/><Text style={ui.title}>{product.name}</Text><Notice title="실측 평면 배치">사진 위의 픽셀 위치가 아닙니다. 방의 왼쪽 위를 (0, 0)으로 두고, 회전 후 가구 사각형의 왼쪽 위 위치를 입력하세요.</Notice>
    <Field numeric label="왼쪽 벽에서 거리 (cm)" value={x} onChange={setX}/><Field numeric label="위쪽 벽에서 거리 (cm)" value={y} onChange={setY}/>
    <Text style={s.section}>가구 회전</Text><View style={s.row}>{[0,90].map(v=><Chip key={v} title={`${v}°`} selected={rotation===v} onPress={()=>setRotation(v)}/>)}</View>
    <Text style={s.section}>통로를 확인할 방향</Text><Text style={s.small}>방을 위에서 봤을 때의 방향이며 상품 회전과 독립적입니다.</Text><View style={s.row}>{[['top','위'],['right','오른쪽'],['bottom','아래'],['left','왼쪽']].map(([v,title])=><Chip key={v} title={title} selected={side===v} onPress={()=>setSide(v)}/>)}</View>
    {error?<Text style={ui.errorText}>{error}</Text>:null}<Button title={busy?'저장 중…':'배치 저장하고 다시 계산'} disabled={busy} onPress={save}/>
  </Screen>;
}
