import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPrompt, validateOutput, MAX_OUTPUT_BYTES } from '../src/provider.ts';
import { catalog } from '../src/catalog.ts';
import { recommend } from '../src/matcher.ts';
import { createFixtureService } from '../../shared/fixture-service.ts';
import { SAMPLE_PHOTO_ID, SAMPLE_REQUEST } from '../../shared/fixtures.ts';
import type { GeneratePreviewInput } from '../../shared/contracts.ts';
test('prompt uses server reference, dimensions and bounded preference data without claiming geometry guarantees',()=>{
  const prompt=buildPrompt({candidate:catalog[2],metadata:{...SAMPLE_REQUEST,requestId:'a',inputVersion:1,optionId:catalog[2].id}});
  assert.match(prompt,/Edit image 1/);assert.match(prompt,/reference in image 2/);assert.match(prompt,/400 cm/);
  assert.match(prompt,/160 × 85 × 82/);assert.match(prompt,/Preserve the camera viewpoint/);
  assert.match(prompt,/untrusted user preference data/);
});
test('oversized base64 is rejected before decoding',async()=>{
  await assert.rejects(validateOutput({imageBase64:'A'.repeat(Math.ceil(MAX_OUTPUT_BYTES/3)*4+4),mimeType:'image/jpeg'}),/oversized/);
});
test('fixture adapter returns labeled paired results only for matching sample',async()=>{
  const candidates=recommend(SAMPLE_REQUEST.room,SAMPLE_REQUEST.request).candidates;
  const images:Record<string,{imageBase64:string;mimeType:'image/jpeg'}>={};
  for(const c of candidates) images[c.id]={imageBase64:(await readFile(new URL(`../assets/sample/${c.id}.jpg`,import.meta.url))).toString('base64'),mimeType:'image/jpeg'};
  const service=createFixtureService({candidates,images});
  assert.equal((await service.getRecommendations(SAMPLE_REQUEST.room,SAMPLE_REQUEST.request)).candidates.length,2);
  const input:GeneratePreviewInput={...SAMPLE_REQUEST,candidate:candidates[0],requestId:'fixture-attempt',inputVersion:5,
    photo:{photoId:SAMPLE_PHOTO_ID,uri:'sample.jpg',mimeType:'image/jpeg',widthPx:960,heightPx:720,source:'sample'}};
  const result=await service.generatePreview(input);
  assert.equal(result.mode,'saved_demo');assert.equal(result.requestId,'fixture-attempt');assert.equal(result.inputVersion,5);
  assert.equal(result.optionId,candidates[0].id);assert.ok(result.imageBase64.length>100);
  await assert.rejects(service.generatePreview({...input,photo:{...input.photo,source:'user'}}));
  await assert.rejects(service.generatePreview({...input,room:{widthCm:500,lengthCm:500}}));
  await assert.rejects(service.generatePreview({...input,request:{category:'chair',description:''}}));
  await assert.rejects(service.getRecommendations(SAMPLE_REQUEST.room,{category:'sofa',description:'blue'}));
  const controller=new AbortController();controller.abort();
  await assert.rejects(service.generatePreview({...input,signal:controller.signal}),{name:'AbortError'});
});
test('negated style preference is not ranked as a positive match',()=>{
  const result=recommend(SAMPLE_REQUEST.room,{category:'chair',description:'not blue'});
  assert.equal(result.candidates[0].id,'chair-oak');
  assert.equal(result.candidates[0].matchReason,'Matched on category and dimensions.');
});
test('OpenAI SDK sends original room first, catalog reference second, one output and no retries',async()=>{
  const {createOpenAIEditor}=await import('../src/provider.ts');
  const room=await readFile(new URL('../assets/sample/room.jpg',import.meta.url));
  const reference=await readFile(catalog[2].referencePath);
  let calls=0;
  const transport:typeof fetch=async (url,init)=>{
    const request=new Request(url,init);
    if (request.url.startsWith('data:')) return fetch(request); // SDK FormData capability probe, not a paid request
    calls++;
    assert.equal(new URL(request.url).pathname,'/v1/images/edits');
    const form=await request.formData();
    const images=form.getAll('image[]') as File[];
    assert.equal(images.length,2);
    assert.deepEqual(Buffer.from(await images[0].arrayBuffer()),room);
    assert.deepEqual(Buffer.from(await images[1].arrayBuffer()),reference);
    assert.equal(form.get('model'),'test-enabled-model');assert.equal(form.get('n'),'1');
    assert.equal(form.get('output_format'),'jpeg');
    return new Response(JSON.stringify({data:[{b64_json:room.toString('base64')}]}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const editor=createOpenAIEditor('test-key-not-real','test-enabled-model',transport);
  const result=await editor.edit({roomJpeg:room,candidate:catalog[2],metadata:{...SAMPLE_REQUEST,requestId:'sdk',inputVersion:1,optionId:catalog[2].id},signal:new AbortController().signal});
  assert.equal(calls,1);assert.equal(result.imageBase64,room.toString('base64'));
  calls=0;
  const failing=createOpenAIEditor('test-key-not-real','test-enabled-model',async(url,init)=>{const request=new Request(url,init);if(request.url.startsWith('data:'))return fetch(request);calls++;return new Response('{}',{status:500,headers:{'Content-Type':'application/json'}});});
  await assert.rejects(failing.edit({roomJpeg:room,candidate:catalog[2],metadata:{...SAMPLE_REQUEST,requestId:'failed',inputVersion:1,optionId:catalog[2].id},signal:new AbortController().signal}));
  assert.equal(calls,1);
});
