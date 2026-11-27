import {Platform} from 'react-native';
import Constants from 'expo-constants';
import {normalizeApiOrigin} from './liveService';
export function defaultApiOrigin() {
  const configured=normalizeApiOrigin(process.env.EXPO_PUBLIC_API_URL);
  if(configured)return configured;
  if(Platform.OS==='web'&&typeof window!=='undefined') {
    const {hostname,origin,protocol}=window.location;
    return ['localhost','127.0.0.1'].includes(hostname)?`${protocol}//${hostname}:3001`:origin;
  }
  if(__DEV__){const host=Constants.expoConfig?.hostUri?.split(':')[0];if(host)return `http://${host}:3001`;}
  return '';
}
export async function openGuestSession(origin,signal) {
  if(!origin)throw new Error('서비스 연결 주소가 설정되지 않았습니다. 잠시 후 다시 시도해 주세요.');
  const response=await fetch(`${origin}/session`,{method:'POST',signal});
  const body=await response.json();
  if(!response.ok||typeof body.token!=='string'||!Number.isFinite(body.expiresAt))throw new Error(body.message||'서비스에 연결하지 못했습니다. 다시 시도해 주세요.');
  return {origin,token:body.token,expiresAt:body.expiresAt};
}
