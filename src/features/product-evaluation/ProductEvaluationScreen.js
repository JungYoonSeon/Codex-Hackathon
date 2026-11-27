import React,{useState} from 'react';
import {Linking,Text,View} from 'react-native';
import {Button,Header,Notice,Screen,ui} from '../../ui.js';
import {evidenceLabels} from '../../../shared/home-profile';
import {evaluateProduct} from './evaluateProduct';
import {formatDimensions} from '../comparison/compareProducts';
import {Chip,s} from '../home-profile/components.js';
export const statusLabels={pass:'입력 조건 충족',conflict:'충돌',review:'확인 필요'};
export const certaintyLabels={demo:'가상 예시 데이터',estimated:'추정·미확인 입력 포함',incomplete:'추가 확인 필요', 'documented-inputs':'측정·기재 정보 기반'};
export const verdictLabels={conflicts:'충돌을 먼저 해결하세요','needs-confirmation':'구매 전 추가 확인이 필요해요','meets-entered-conditions':'입력한 필수조건을 충족해요'};
export function evidenceText(fact){
  if(fact?.value===undefined)return '확인 필요';
  const value=typeof fact.value==='object'?Array.isArray(fact.value)?fact.value.join(', '):'세부 입력값':String(fact.value);
  return `${value} · ${evidenceLabels[fact.source]??'출처 확인 필요'}`;
}
export function ProductEvaluationScreen({product,home,onBack,onEditPlacement}){
  const [filter,setFilter]=useState('all');const [showEvidence,setShowEvidence]=useState(false);
  const result=evaluateProduct(product,home);
  return <Screen><Header onBack={onBack} label="CHECK BEFORE BUY"/><Text style={ui.title}>{product.name}</Text><Text style={ui.body}>{product.retailer??'판매처 미제공'} · {formatDimensions(product.dimensions)}</Text>
    <Notice title={verdictLabels[result.verdict]} tone={result.verdict==='meets-entered-conditions'?'info':'warn'}>{certaintyLabels[result.certainty]}. 실제 배송·설치·안전을 보증하지 않습니다.</Notice>
    <Button secondary title="이 상품의 배치 위치·통로 방향 설정" onPress={onEditPlacement}/>
    <View style={s.row}>{[['all','전체'],['conflict','충돌'],['review','확인 필요'],['pass','조건 충족']].map(([key,title])=><Chip key={key} title={`${title} ${key==='all'?result.checks.length:result.checks.filter(c=>c.status===key).length}`} selected={filter===key} onPress={()=>setFilter(key)}/>)}</View>
    {result.checks.filter(c=>filter==='all'||c.status===filter).map(check=><View key={check.id} style={s.card}><Text style={[s.status,check.status!=='pass'&&s.warn]}>{statusLabels[check.status]} · {check.priority==='required'?'필수조건':'생활 선호'}</Text><Text style={ui.sectionTitle}>{check.title}</Text><Text style={[ui.body,{marginBottom:8}]}>{check.detail}</Text>{check.action?<Text style={s.small}>{check.action}</Text>:null}{check.evidence.map(e=><Text key={e.label} style={s.small}>{e.label}: {evidenceText(e.fact)}</Text>)}</View>)}
    <Text style={s.section}>추천 근거와 정보 상태</Text><Text style={ui.body}>직접 측정 {result.evidenceCounts.measured} · 판매처 기재 {result.evidenceCounts.supplier} · 추정 {result.evidenceCounts.estimated} · 미측정 참고값 {result.evidenceCounts.userReported} · 미확인 {result.evidenceCounts.unknown} · 예시 {result.evidenceCounts.demo}</Text>
    <Text style={s.small}>확률이나 정확도 점수가 아닙니다. 판매처 기재도 실측 검증을 뜻하지 않습니다.</Text><Button secondary small title={showEvidence?'출처 접기':'항목별 출처 보기'} onPress={()=>setShowEvidence(!showEvidence)}/>
    {showEvidence&&result.evidence.map(e=><View key={e.label} style={s.card}><Text style={s.label}>{e.label}</Text><Text style={s.small}>{evidenceText(e.fact)}</Text>{e.fact?.checkedAt?<Text style={s.small}>기록: {e.fact.checkedAt}</Text>:null}{e.fact?.note?<Text style={s.small}>{e.fact.note}</Text>:null}{/^https:\/\//.test(e.fact?.sourceUrl??'')?<Button small secondary title="출처 열기" onPress={()=>Linking.openURL(e.fact.sourceUrl).catch(()=>{})}/>:null}</View>)}
    <Notice title="계산 범위">{result.limitations.join('\n\n')}</Notice>
  </Screen>;
}
