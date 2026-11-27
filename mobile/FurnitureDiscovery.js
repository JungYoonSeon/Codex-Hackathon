import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { discoveryDemoProducts, filterProducts, productCategories, retailerLinks } from '../shared/discovery';
import { conflictNotes, dataBadge, formatDimensions, formatPackages, formatPrice, missingSummary, provenanceNote } from './product-search/productDisplay.js';

const sources = [{id:'all',label:'전체 판매처'},{id:'demo',label:'샘플'},{id:'ikea',label:'IKEA'},{id:'coupang',label:'쿠팡'},{id:'amazon',label:'Amazon'},{id:'ebay',label:'eBay'}];
const sorts=[{id:'relevance',label:'관련도순'},{id:'price-asc',label:'낮은 가격순'},{id:'price-desc',label:'높은 가격순'}];
const colors={ink:'#24332E',green:'#386B55',muted:'#68756F',cream:'#F7F5F0',line:'#E4E7E1'};
const categoryOf=(p)=>productCategories.find(c=>c.id===p.category)||productCategories[0];
const dimensions=formatDimensions;
const price=formatPrice;
const badge=dataBadge;
// Retailer detail sections (verified snapshots and connectors that supply them). Absent data is listed, not hidden.
function RetailerDetails({product}){
  const packages=formatPackages(product);const missing=missingSummary(product);const conflicts=conflictNotes(product);const provenance=provenanceNote(product);
  const has=packages.length||product.groundClearanceCm!==undefined||product.materials?.length||missing.length||conflicts.length||provenance;
  if(!has)return null;
  return <View>
    {packages.length>0&&<><Text style={styles.section}>포장 (배송 기준)</Text>{packages.map(l=><Text key={l} style={styles.subtitle}>{l}</Text>)}<Text style={styles.caption}>조립된 제품 크기와 다른 배송 상자 크기예요.</Text></>}
    {product.groundClearanceCm!==undefined&&<><Text style={styles.section}>바닥 여유 공간</Text><Text style={styles.subtitle}>{product.groundClearanceCm} cm</Text></>}
    {product.materials?.length>0&&<><Text style={styles.section}>소재</Text>{product.materials.map((m,i)=><Text key={i} style={styles.caption}>{m.part?`${m.part}: `:''}{m.material}</Text>)}</>}
    {conflicts.length>0&&<><Text style={styles.section}>판매처 정보 불일치</Text>{conflicts.map(c=><Text key={c} style={styles.sourceNote}>{c}</Text>)}</>}
    {missing.length>0&&<><Text style={styles.section}>확인이 필요한 정보</Text>{missing.map(m=><Text key={m} style={styles.caption}>• {m}</Text>)}</>}
    {provenance&&<Text style={styles.sourceNote}>{provenance}</Text>}
  </View>;
}
async function openUrl(url){try{await Linking.openURL(url);}catch{Alert.alert('링크를 열지 못했어요','잠시 후 다시 시도해 주세요.');}}
function Chip({label,selected,onPress}){return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={[styles.chip,selected&&styles.chipActive]}><Text style={[styles.chipText,selected&&styles.chipTextActive]}>{label}</Text></Pressable>;}
function ProductImage({product,large=false}){
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[product.imageUrl]);
  return <View style={[styles.picture,large&&styles.pictureLarge]}>{product.imageUrl&&!failed?<Image source={{uri:product.imageUrl}} resizeMode="contain" style={styles.image} onError={()=>setFailed(true)}/>:<Text style={{fontSize:large?70:42}}>{categoryOf(product).icon}</Text>}</View>;
}
export default function FurnitureDiscovery({onBack,onSave,onTry,savedIds=[],connection}){
  const [q,setQ]=useState('');const [brand,setBrand]=useState('');const [category,setCategory]=useState('all');const [source,setSource]=useState('all');
  const [sort,setSort]=useState('relevance');const [page,setPage]=useState(1);const [revision,setRevision]=useState(0);
  const [result,setResult]=useState({products:[],sources:[],links:[],hasMore:false});const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const [detail,setDetail]=useState(null);
  const run=useRef(0);
  useEffect(()=>{
    const id=++run.current;const controller=new AbortController();let deadline;
    setLoading(true);setError('');setResult({products:[],sources:[],links:[],hasMore:false});
    const timer=setTimeout(async()=>{
      const input={q:q.trim(),brand:brand.trim(),category,source,sort,page};
      if(!connection.origin||!connection.token){
        const products=(source==='all'||source==='demo')?filterProducts(discoveryDemoProducts,input):[];
        const localSources=source==='demo'?[{source:'demo',status:'ready',message:'가상 샘플 상품입니다. 실제 판매 상품이 아닙니다.'}]:sources.filter(s=>s.id!=='all'&&(source==='all'||s.id===source)).map(s=>({source:s.id,status:s.id==='demo'?'ready':'not-configured',message:s.id==='demo'?'가상 샘플 상품입니다.':'판매처 연결 전입니다. 아래 공식 사이트 검색을 이용해 주세요.'}));
        if(id===run.current){setResult({products:products.slice((page-1)*20,page*20),sources:localSources,hasMore:products.length>page*20,links:retailerLinks(input)});setLoading(false);}return;
      }
      try{
        const query=Object.entries(input).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
        deadline=setTimeout(()=>controller.abort(),15000);
        const response=await fetch(`${connection.origin.replace(/\/$/,'')}/products?${query}`,{headers:{Authorization:`Bearer ${connection.token}`},signal:controller.signal});
        const data=await response.json();
        if(!response.ok)throw new Error(response.status===401?'연결이 만료되었습니다. 다시 연결한 후 검색해 주세요.':data.message||'검색을 완료하지 못했어요.');
        if(!Array.isArray(data.products)||!Array.isArray(data.sources))throw new Error('상품 응답을 읽지 못했어요.');
        if(id===run.current)setResult(data);
      }catch(e){if(id===run.current){setError(e.name==='AbortError'?'검색 시간이 길어지고 있어요. 다시 시도해 주세요.':e.message||'서버에 연결하지 못했어요.');setResult({products:[],sources:[],hasMore:false,links:retailerLinks(input)});}}
      finally{clearTimeout(deadline);if(id===run.current)setLoading(false);}
    },350);
    return()=>{run.current++;clearTimeout(timer);clearTimeout(deadline);controller.abort();};
  },[q,brand,category,source,sort,page,connection.origin,connection.token,revision]);
  const change=(setter,value)=>{setPage(1);setter(value);};
  const selected=detail&&savedIds.includes(detail.id);
  return <SafeAreaView style={styles.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="이전 화면" onPress={onBack}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.brand}>roomready</Text></View>
    <Text style={styles.eyebrow}>FIND YOUR NEXT PIECE</Text><Text style={styles.title}>어떤 가구를 찾나요?</Text><Text style={styles.subtitle}>상품명이나 브랜드로 찾고, 종류별로 둘러보세요.</Text>

    <TextInput accessibilityLabel="상품명 검색" style={styles.input} placeholder="상품명 검색 · 예: 원목 책상, BILLY" value={q} onChangeText={v=>change(setQ,v)} maxLength={150} returnKeyType="search" onSubmitEditing={()=>setRevision(v=>v+1)}/>
    <TextInput accessibilityLabel="브랜드 검색" style={styles.input} placeholder="브랜드 · 예: IKEA, Herman Miller" value={brand} onChangeText={v=>change(setBrand,v)} maxLength={100} autoCapitalize="none" returnKeyType="search"/>
    <Text style={styles.section}>종류별로 둘러보기</Text><View style={styles.categories}>{productCategories.map(c=><Chip key={c.id} label={`${c.icon} ${c.label}`} selected={category===c.id} onPress={()=>change(setCategory,c.id)}/>)}</View>
    <Text style={styles.section}>판매처</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{sources.map(s=><Chip key={s.id} label={s.label} selected={source===s.id} onPress={()=>change(setSource,s.id)}/>)}</ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{sorts.map(s=><Chip key={s.id} label={s.label} selected={sort===s.id} onPress={()=>change(setSort,s.id)}/>)}</ScrollView>
    {sort!=='relevance'&&<Text style={styles.caption}>같은 통화끼리 현재 페이지의 가격순으로 표시합니다. 환율·배송비는 반영하지 않습니다.</Text>}
    {loading?<View style={styles.empty}><ActivityIndicator color={colors.green}/><Text style={styles.subtitle}>상품을 찾고 있어요…</Text></View>:<>
      {error?<View style={styles.panel}><Text style={styles.error}>{error}</Text><Pressable onPress={()=>setRevision(v=>v+1)}><Text style={styles.link}>다시 검색</Text></Pressable></View>:null}
      {result.sources.filter(s=>s.status!=='ready'||s.source==='demo'||s.source==='ikea').map(s=><Text key={s.source} style={styles.sourceNote}>{sources.find(v=>v.id===s.source)?.label}: {s.message}</Text>)}
      <View style={styles.resultsHeading}><Text style={styles.section}>{q||brand?'검색 결과':'둘러볼 상품'}</Text><Text style={styles.caption}>{result.products.length}개 · {page}페이지</Text></View>
      {!result.products.length&&<View style={styles.empty}><Text style={{fontSize:32}}>🔎</Text><Text style={styles.cardTitle}>표시할 상품이 없어요</Text><Text style={styles.subtitle}>검색어나 종류를 바꾸거나 아래 판매처에서 직접 찾아보세요.</Text></View>}
      {result.products.map(product=><Pressable key={product.id} accessibilityRole="button" accessibilityLabel={`${product.name} 상세 보기`} onPress={()=>setDetail(product)} style={styles.product}><ProductImage product={product}/><View style={styles.productCopy}><Text style={styles.badge}>{product.sourceLabel} · {badge(product)}</Text><Text style={styles.cardTitle}>{product.name}</Text><Text style={styles.caption}>{product.brand||'브랜드는 판매처에서 확인'}</Text><Text style={styles.price}>{price(product)}</Text><Text style={styles.caption}>{dimensions(product)}</Text><Text style={styles.reason}>{product.matchReason}</Text>{savedIds.includes(product.id)&&<Text style={styles.saved}>✓ 내 후보에 저장됨</Text>}</View></Pressable>)}
      <View style={styles.pagination}>{page>1&&<Pressable style={styles.secondary} onPress={()=>setPage(v=>v-1)}><Text style={styles.link}>이전</Text></Pressable>}{result.hasMore&&page<10&&<Pressable style={styles.secondary} onPress={()=>setPage(v=>v+1)}><Text style={styles.link}>다음 상품 보기 →</Text></Pressable>}</View>
    </>}
    <Text style={styles.section}>판매처에서 더 찾아보기</Text><Text style={styles.caption}>현재 검색어와 종류를 판매처 사이트로 전달합니다. 앱 내 상품 검색과는 별도입니다.</Text>{(result.links.length?result.links:retailerLinks({q,brand,category})).filter(l=>source==='all'||source==='demo'||source===l.source).map(l=><Pressable key={l.source} onPress={()=>openUrl(l.url)} style={styles.retailer}><Text style={styles.link}>{l.label} ↗</Text></Pressable>)}
  </ScrollView>
  <Modal visible={!!detail} animationType="slide" onRequestClose={()=>setDetail(null)}><SafeAreaView style={styles.safe}>{detail&&<ScrollView contentContainerStyle={styles.content}><Pressable onPress={()=>setDetail(null)} accessibilityRole="button"><Text style={styles.link}>← 검색 결과로</Text></Pressable><ProductImage product={detail} large/><Text style={styles.badge}>{detail.sourceLabel} · {badge(detail)}</Text><Text style={styles.title}>{detail.name}</Text><Text style={styles.subtitle}>{detail.brand||'브랜드 미제공'}</Text><Text style={styles.price}>{price(detail)}</Text><Text style={styles.section}>상품 정보</Text><Text style={styles.subtitle}>{detail.description||'자세한 설명은 판매처에서 확인하세요.'}</Text><Text style={styles.section}>크기</Text><Text style={styles.subtitle}>{dimensions(detail)}</Text><Text style={styles.caption}>가로 × 깊이 × 높이. 치수가 있어도 실제 배치·출입문 통과 여부는 별도 확인이 필요합니다.</Text><RetailerDetails product={detail}/><Text style={styles.reason}>{detail.matchReason}</Text><View style={styles.categories}>{detail.tags.map(t=><Text key={t} style={styles.tag}>{t}</Text>)}</View><Pressable disabled={selected} onPress={()=>onSave(detail)} style={[styles.primary,selected&&{opacity:.55}]}><Text style={styles.primaryText}>{selected?'✓ 내 방 후보에 저장됨':'내 방 후보로 저장'}</Text></Pressable>{onTry&&<Pressable onPress={()=>{const product=detail;setDetail(null);onTry(product);}} style={styles.primary}><Text style={styles.primaryText}>이 상품을 내 방에서 보기</Text></Pressable>}{detail.productUrl&&<Pressable onPress={()=>openUrl(detail.productUrl)} style={styles.secondary}><Text style={styles.link}>판매처에서 상품 보기 ↗</Text></Pressable>}<Text style={styles.sourceNote}>{'내 방에서 보기에서 배치 위치를 선택하고 상품 사진을 참조해 합성할 수 있어요. 실제 치수와 배송 조건은 별도로 확인하세요.'}</Text></ScrollView>}</SafeAreaView></Modal>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.cream},content:{padding:22,paddingBottom:40},header:{flexDirection:'row',alignItems:'center',gap:18,marginBottom:24},back:{fontSize:36,color:colors.green},brand:{fontSize:20,fontWeight:'700',color:colors.ink},settingsButton:{marginLeft:'auto'},eyebrow:{fontSize:10,letterSpacing:1.6,color:colors.green,fontWeight:'700'},title:{fontSize:28,fontWeight:'700',color:colors.ink,marginTop:8},subtitle:{fontSize:14,color:colors.muted,lineHeight:22,marginVertical:8},input:{backgroundColor:'white',borderWidth:1,borderColor:colors.line,borderRadius:13,padding:15,fontSize:15,marginTop:10,color:colors.ink},section:{fontSize:16,color:colors.ink,fontWeight:'700',marginTop:20,marginBottom:10},categories:{flexDirection:'row',flexWrap:'wrap',gap:7},chipRow:{gap:7,paddingVertical:8},chip:{paddingVertical:10,paddingHorizontal:13,borderRadius:20,borderWidth:1,borderColor:colors.line,backgroundColor:'white'},chipActive:{backgroundColor:colors.green,borderColor:colors.green},chipText:{color:colors.ink,fontSize:12},chipTextActive:{color:'white'},panel:{padding:16,backgroundColor:'#EAF0E8',borderRadius:14,marginVertical:10},caption:{fontSize:11,color:colors.muted,lineHeight:17},sourceNote:{fontSize:11,color:colors.muted,lineHeight:18,marginTop:8,padding:10,backgroundColor:'#EEEDE6',borderRadius:9},resultsHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},empty:{alignItems:'center',padding:30,gap:8},product:{flexDirection:'row',padding:12,borderRadius:16,backgroundColor:'white',borderWidth:1,borderColor:colors.line,marginBottom:10,gap:12},picture:{width:90,height:100,backgroundColor:'#EFEFE8',borderRadius:12,alignItems:'center',justifyContent:'center',overflow:'hidden'},pictureLarge:{width:'100%',height:260,marginVertical:20},image:{width:'100%',height:'100%'},productCopy:{flex:1,gap:3},cardTitle:{fontSize:15,fontWeight:'700',color:colors.ink,lineHeight:21},badge:{fontSize:10,color:colors.green,fontWeight:'600'},price:{fontSize:14,fontWeight:'700',color:colors.ink,marginVertical:5},reason:{fontSize:11,color:colors.green,lineHeight:17,marginTop:6},saved:{fontSize:11,fontWeight:'700',color:colors.green},link:{fontSize:13,color:colors.green,fontWeight:'700'},primary:{backgroundColor:colors.green,borderRadius:13,padding:16,alignItems:'center',marginTop:16},primaryText:{color:'white',fontWeight:'700'},secondary:{padding:14,borderWidth:1,borderColor:colors.line,borderRadius:12,alignItems:'center',marginTop:10},retailer:{padding:16,backgroundColor:'#EAF0E8',borderRadius:12,marginTop:8},pagination:{flexDirection:'row',justifyContent:'space-between'},tag:{padding:8,borderRadius:8,backgroundColor:'#EAF0E8',color:colors.green,fontSize:11},error:{color:'#9C4435',lineHeight:21,marginBottom:10},
});

export function SavedFurniture({products,onBack,onExplore,onRemove}){
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={onBack}><Text style={styles.link}>← 돌아가기</Text></Pressable><Text style={styles.title}>내 방의 가구 후보</Text><Text style={styles.subtitle}>비교하고 싶은 상품을 모아두세요. 후보는 현재 앱 실행 중에 유지됩니다.</Text>
    {!products.length&&<View style={styles.empty}><Text style={styles.cardTitle}>아직 저장한 상품이 없어요</Text><Text style={styles.subtitle}>상품을 검색하고 마음에 드는 후보를 저장해 보세요.</Text></View>}
    {products.map(product=><View key={product.id} style={styles.product}><ProductImage product={product}/><View style={styles.productCopy}><Text style={styles.badge}>{product.sourceLabel} · {badge(product)}</Text><Text style={styles.cardTitle}>{product.name}</Text><Text style={styles.price}>{price(product)}</Text><Text style={styles.caption}>{dimensions(product)}</Text>{product.productUrl&&<Pressable onPress={()=>openUrl(product.productUrl)}><Text style={styles.link}>판매처에서 보기 ↗</Text></Pressable>}<Pressable onPress={()=>onRemove(product.id)} style={{paddingVertical:8}}><Text style={styles.caption}>후보에서 제거</Text></Pressable></View></View>)}
    <Pressable style={styles.primary} onPress={onExplore}><Text style={styles.primaryText}>다른 가구 찾아보기</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
