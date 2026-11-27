import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { profileProblems } from '../../shared/home-profile';

const KEY='roomready-home-profiles-v1';
// Uses the FileSystem module already included by this project's Expo SDK 54.
// Kept behind a key/value adapter so the integrator can substitute AsyncStorage.
function deviceStorage(){
  if(Platform.OS==='web')return {
    async getItem(key){return globalThis.localStorage.getItem(key);},
    async setItem(key,value){globalThis.localStorage.setItem(key,value);},
  };
  const fs=requireOptionalNativeModule('ExponentFileSystem');
  if(!fs?.documentDirectory||!fs.readAsStringAsync||!fs.writeAsStringAsync)throw new Error('이 기기에서 로컬 저장소를 사용할 수 없습니다. Expo FileSystem 연결을 확인하세요.');
  const path=key=>`${fs.documentDirectory.replace(/\/$/,'')}/${key}.json`;
  return {
    async getItem(key){const info=await fs.getInfoAsync(path(key),{});return info.exists?fs.readAsStringAsync(path(key),{encoding:'utf8'}):null;},
    async setItem(key,value){await fs.writeAsStringAsync(path(key),value,{encoding:'utf8'});},
  };
}
function decode(text){
  if(text===null)return {schemaVersion:1,profiles:[],comparisons:[]};
  if(typeof text!=='string'||text.length>2_000_000)throw new Error('저장된 프로필 데이터가 너무 큽니다.');
  const data=JSON.parse(text);
  if(data.schemaVersion!==1||!Array.isArray(data.profiles)||data.profiles.length>50||!Array.isArray(data.comparisons))throw new Error('저장된 프로필 형식을 읽지 못했습니다.');
  for(const profile of data.profiles)if(profileProblems(profile).length)throw new Error('저장된 측정 데이터에 오류가 있습니다.');
  if(data.comparisons.length>100||data.comparisons.some(c=>!c.id||!c.profileId||!Array.isArray(c.productIds)||c.productIds.length!==2||c.productIds.some(id=>typeof id!=='string')))throw new Error('저장된 비교 목록을 읽지 못했습니다.');
  return data;
}
export function createHomeProfileStore(adapter){
  let storage=adapter;let queue=Promise.resolve();
  const backend=()=>storage??(storage=deviceStorage());
  async function load(){
    try{return decode(await backend().getItem(KEY));}
    catch(error){
      const backup=await backend().getItem(`${KEY}-backup`);
      if(backup!==null)return {...decode(backup),recovered:true};
      throw new Error('저장된 프로필을 읽지 못했습니다. 기존 데이터를 덮어쓰지 않았습니다.');
    }
  }
  function update(change,retainPrevious=true){
    const work=queue.catch(()=>{}).then(async()=>{
      const previous=await load();const next=change(previous);
      decode(JSON.stringify(next));
      const text=JSON.stringify(next);
      // Retain the last valid document if an interrupted write damages the primary.
      await backend().setItem(`${KEY}-backup`,JSON.stringify(retainPrevious?previous:next));
      await backend().setItem(KEY,text);
      return next;
    });queue=work;return work;
  }
  return {
    load:async()=>{await queue.catch(()=>{});return load();},
    save(profile){const issues=profileProblems(profile);if(issues.length)return Promise.reject(new Error(issues.join('\n')));
      return update(state=>({...state,recovered:false,profiles:[...state.profiles.filter(p=>p.id!==profile.id),{...profile,updatedAt:new Date().toISOString()}]}));},
    remove(id){return update(state=>({...state,profiles:state.profiles.filter(p=>p.id!==id),comparisons:state.comparisons.filter(c=>c.profileId!==id)}),false);},
    saveComparison(profileId,productIds){return update(state=>{
      if(!state.profiles.some(p=>p.id===profileId))throw new Error('먼저 집 프로필을 저장하세요.');
      if(productIds.length!==2||productIds[0]===productIds[1])throw new Error('서로 다른 두 상품을 선택하세요.');
      const entry={id:`comparison-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,profileId,productIds:[...productIds],createdAt:new Date().toISOString()};
      return {...state,comparisons:[entry,...state.comparisons].slice(0,100)};
    });},
    removeComparison(id){return update(state=>({...state,comparisons:state.comparisons.filter(c=>c.id!==id)}),false);},
  };
}
export const homeProfileStore=createHomeProfileStore();
