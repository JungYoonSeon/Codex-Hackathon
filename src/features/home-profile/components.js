import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, ui } from '../../ui.js';
export const s=StyleSheet.create({
  heading:{fontSize:24,fontWeight:'700',color:COLORS.ink,marginBottom:10},section:{fontSize:18,fontWeight:'700',color:COLORS.ink,marginVertical:12},
  row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:8},chip:{paddingHorizontal:12,paddingVertical:10,borderRadius:18,borderWidth:1,borderColor:COLORS.line,backgroundColor:'white'},active:{backgroundColor:COLORS.green,borderColor:COLORS.green},
  chipText:{fontSize:12,color:COLORS.ink},label:{fontSize:13,color:COLORS.ink,fontWeight:'600',marginBottom:6},small:{fontSize:12,color:COLORS.muted,lineHeight:18},card:{...ui.card},
  status:{fontSize:12,fontWeight:'700',color:COLORS.green,marginBottom:5},warn:{color:COLORS.warnInk},divider:{height:1,backgroundColor:COLORS.line,marginVertical:12},
});
export function Chip({title,selected,onPress}){return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={[s.chip,selected&&s.active]}><Text style={[s.chipText,selected&&{color:'white'}]}>{title}</Text></Pressable>;}
export function Toggle({title,value,onChange,hint}){return <View style={{marginVertical:7}}><Pressable accessibilityRole="switch" accessibilityState={{checked:value}} onPress={()=>onChange(!value)} style={s.row}><Text style={{fontSize:17,color:COLORS.green}}>{value?'☑':'☐'}</Text><Text style={[s.label,{flex:1}]}>{title}</Text></Pressable>{hint?<Text style={s.small}>{hint}</Text>:null}</View>;}
export function Field({label,value,onChange,numeric=false,placeholder='',hint}){return <View style={ui.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={String(value??'')} onChangeText={onChange} style={ui.input} keyboardType={numeric?'decimal-pad':'default'} autoCapitalize={numeric?'none':'sentences'} placeholder={placeholder} maxLength={numeric?12:160}/>{hint?<Text style={s.small}>{hint}</Text>:null}</View>;}
export function MeasurementField({label,value,onChange}){
  return <View style={{marginBottom:10}}><Field label={label} numeric value={value.text} onChange={text=>onChange({...value,text})}/><View style={s.row}>{[['measured','직접 측정'],['estimated','추정'],['user-reported','참고값']].map(([source,title])=><Chip key={source} title={title} selected={value.source===source} onPress={()=>onChange({...value,source})}/>)}</View></View>;
}
export function numericText(value,label,zero=false){
  const text=String(value??'').trim();if(!text)return undefined;
  if(!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text))throw new Error(`${label}: 숫자로 입력하세요.`);
  const n=Number(text.replace(',','.'));
  if(!Number.isFinite(n)||(zero?n<0:n<=0)||n>100000000)throw new Error(`${label}: ${zero?'0 이상':'0보다 큰'} 값으로 입력하세요.`);
  return n;
}
