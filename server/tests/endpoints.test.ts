import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import { createApp, MAX_UPLOAD_BYTES, type AppConfig } from '../src/app.ts';
import type { ImageEditor, EditInput } from '../src/provider.ts';
import { SAMPLE_REQUEST } from '../../shared/fixtures.ts';
const token='test-session-token-with-at-least-32-characters';
const photo=await sharp({create:{width:32,height:24,channels:3,background:'#b3c4d5'}}).jpeg().toBuffer();
const output=await sharp({create:{width:32,height:24,channels:3,background:'#eeddbb'}}).png().toBuffer();
const success: ImageEditor={async edit(){return {imageBase64:output.toString('base64'),mimeType:'image/jpeg'};}};
async function setup(t: test.TestContext, config: Partial<AppConfig>={}) {
  const server=createApp({sessionToken:token,editor:success,...config}).listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers={Authorization:`Bearer ${token}`};
  return {
    origin, headers,
    rec: (body: unknown=SAMPLE_REQUEST)=>fetch(`${origin}/recommendations`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)}),
    preview: (metadata: unknown={}, bytes: Buffer=photo,mime='image/jpeg')=>{
      const form=new FormData();
      form.set('metadata',JSON.stringify({...SAMPLE_REQUEST,requestId:crypto.randomUUID(),inputVersion:3,optionId:'sofa-linen',...(metadata as object)}));
      form.set('photo',new Blob([new Uint8Array(bytes)],{type:mime}),'room.jpg');
      return fetch(`${origin}/preview`,{method:'POST',headers,body:form});
    },
  };
}
test('health is reachable without credentials and says configured, not verified',async t=>{
  const api=await setup(t,{editor:undefined});const res=await fetch(`${api.origin}/health`);
  assert.equal(res.status,200);assert.equal((await res.json()).liveConfigured,false);
});
test('recommendations and previews require demo authorization before parsing',async t=>{
  const api=await setup(t);for(const path of ['/recommendations','/preview']){
    const res=await fetch(`${api.origin}${path}`,{method:'POST'});assert.equal(res.status,401);
    assert.equal((await res.json()).code,'UNAUTHORIZED');
  }
});
test('recommendations never call image service and expose only public candidate data',async t=>{
  let calls=0;const api=await setup(t,{editor:{async edit(){calls++;throw new Error('unused');}}});
  const res=await api.rec();assert.equal(res.status,200);const body=await res.json();
  assert.equal(body.candidates.length,2);assert.equal(calls,0);assert.ok(!JSON.stringify(body).includes('referencePath'));
});
test('real uploaded JPEG reaches adapter; response preserves IDs and actual output MIME',async t=>{
  let received: EditInput|undefined;
  const api=await setup(t,{editor:{async edit(input){received=input;return success.edit(input);}}});
  const res=await api.preview({requestId:'attempt-A',inputVersion:7});assert.equal(res.status,200);
  const body=await res.json();assert.equal(body.requestId,'attempt-A');assert.equal(body.inputVersion,7);
  assert.equal(body.optionId,'sofa-linen');assert.equal(body.mode,'live');assert.equal(body.mimeType,'image/png');
  const normalized=await sharp(photo).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
  assert.deepEqual(received!.roomJpeg,normalized);assert.equal(received!.candidate.id,'sofa-linen');
  assert.equal(Buffer.from(body.imageBase64,'base64').compare(output),0);
});
test('two alternatives each receive original room bytes, not previous generated output',async t=>{
  const received:EditInput[]=[];const api=await setup(t,{editor:{async edit(input){received.push(input);return success.edit(input);}}});
  assert.equal((await api.preview({optionId:'sofa-linen'})).status,200);
  assert.equal((await api.preview({optionId:'sofa-sage'})).status,200);
  assert.equal(received.length,2);assert.deepEqual(received[0].roomJpeg,received[1].roomJpeg);
  assert.notEqual(received[0].candidate.id,received[1].candidate.id);
});
test('invalid dimensions, conflicts, unknown IDs and no-match input avoid paid calls',async t=>{
  let calls=0;const api=await setup(t,{editor:{async edit(input){calls++;return success.edit(input);}}});
  for(const invalid of [{room:{widthCm:0,lengthCm:300}},{optionId:'../../secret'},
    {optionId:'chair-oak'},{room:{widthCm:10,lengthCm:10}},
    {request:{category:'sofa',description:'a blue chair'}},{inputVersion:-1},{requestId:''}])
    assert.equal((await api.preview(invalid)).status,400);
  assert.equal(calls,0);
});
test('empty recommendations is a 200 no-match state',async t=>{
  const api=await setup(t);const res=await api.rec({...SAMPLE_REQUEST,room:{widthCm:10,lengthCm:10}});
  assert.equal(res.status,200);assert.deepEqual((await res.json()).candidates,[]);
});
test('bad JSON and oversized JSON return normalized errors',async t=>{
  const api=await setup(t);for(const [body,status] of [['{oops',400],['x'.repeat(20_000),413]] as const){
    const res=await fetch(`${api.origin}/recommendations`,{method:'POST',headers:{...api.headers,'Content-Type':'application/json'},body});
    assert.equal(res.status,status);assert.equal(typeof (await res.json()).retryable,'boolean');
  }
});
test('missing file, wrong type, fake JPEG, and oversized upload are rejected',async t=>{
  const api=await setup(t);
  const form=new FormData();form.set('metadata',JSON.stringify({...SAMPLE_REQUEST,requestId:'x',inputVersion:1,optionId:'sofa-linen'}));
  assert.equal((await fetch(`${api.origin}/preview`,{method:'POST',headers:api.headers,body:form})).status,400);
  assert.equal((await api.preview({},photo,'image/png')).status,400);
  assert.equal((await api.preview({},Buffer.from('not a JPEG'))).status,400);
  assert.equal((await api.preview({},Buffer.alloc(MAX_UPLOAD_BYTES+1))).status,413);
  assert.equal((await api.preview()).status,200); // failed upload released concurrency lease
});
test('extra multipart fields and multiple photos are rejected',async t=>{
  const api=await setup(t);const form=new FormData();form.set('metadata','{}');form.set('extra','bad');
  form.set('photo',new Blob([new Uint8Array(photo)],{type:'image/jpeg'}),'a.jpg');
  assert.equal((await fetch(`${api.origin}/preview`,{method:'POST',headers:api.headers,body:form})).status,400);
  const two=new FormData();two.set('metadata','{}');for(let i=0;i<2;i++)two.append('photo',new Blob([new Uint8Array(photo)],{type:'image/jpeg'}),`${i}.jpg`);
  assert.equal((await fetch(`${api.origin}/preview`,{method:'POST',headers:api.headers,body:two})).status,400);
});
test('unconfigured provider returns explicit unavailable, never substitutes sample',async t=>{
  const api=await setup(t,{editor:undefined});const res=await api.preview();assert.equal(res.status,503);
  const body=await res.json();assert.equal(body.code,'LIVE_UNAVAILABLE');assert.equal(body.imageBase64,undefined);
});
test('provider errors are redacted and actionable; successes remain independently retryable',async t=>{
  let calls=0;const api=await setup(t,{editor:{async edit(input){if(++calls===1)throw Object.assign(new Error('SECRET upstream dump'),{status:500});return success.edit(input);}}});
  const bad=await api.preview();assert.equal(bad.status,502);const text=await bad.text();assert.ok(!text.includes('SECRET'));
  assert.equal((await api.preview()).status,200);
});
test('provider auth/rejection/rate limit normalize status and retryability',async t=>{
  for(const [upstream,status,retryable] of [[401,502,false],[400,502,false],[429,429,true]] as const){
    const api=await setup(t,{editor:{async edit(){throw {status:upstream,message:'sensitive'};}}});
    const res=await api.preview();assert.equal(res.status,status);assert.equal((await res.json()).retryable,retryable);
  }
});
test('missing and malformed output do not become ready results',async t=>{
  for(const imageBase64 of ['', 'not base64!', Buffer.from('text').toString('base64')]){
    const api=await setup(t,{editor:{async edit(){return {imageBase64,mimeType:'image/jpeg'};}}});
    const res=await api.preview();assert.equal(res.status,502);assert.equal((await res.json()).code,'INVALID_OUTPUT');
  }
});
test('deadline returns 504 and signals cancellation',async t=>{
  let signal:AbortSignal|undefined;
  const api=await setup(t,{timeoutMs:30,editor:{async edit(input){signal=input.signal;return new Promise(()=>{});}}});
  const res=await api.preview();assert.equal(res.status,504);assert.equal(signal!.aborted,true);
});
test('concurrent paid request is rejected, then capacity recovers',async t=>{
  let release!:()=>void;let started!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});const begun=new Promise<void>(resolve=>{started=resolve;});
  const api=await setup(t,{editor:{async edit(input){started();await gate;return success.edit(input);}}});
  const first=api.preview();await begun;
  const busy=await api.preview();assert.equal(busy.status,429);assert.equal((await busy.json()).code,'BUSY');
  release();assert.equal((await first).status,200);assert.equal((await api.preview()).status,200);
});
test('replayed attempt IDs are rejected and hourly paid budget is bounded',async t=>{
  const api=await setup(t,{maxPreviewsPerHour:1});
  assert.equal((await api.preview({requestId:'same'})).status,200);
  assert.equal((await api.preview({requestId:'same'})).status,409);
  const limited=await api.preview({requestId:'new'});assert.equal(limited.status,429);assert.equal((await limited.json()).code,'RATE_LIMITED');
});
test('broken multipart is a recoverable input error and releases upload slot',async t=>{
  const api=await setup(t);
  const res=await fetch(`${api.origin}/preview`,{method:'POST',headers:{...api.headers,'Content-Type':'multipart/form-data; boundary=broken'},body:'bad bytes'});
  assert.equal(res.status,400);assert.equal((await api.preview()).status,200);
});
