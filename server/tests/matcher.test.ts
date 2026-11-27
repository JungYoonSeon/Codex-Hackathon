import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { catalog } from '../src/catalog.ts';
import { recommend } from '../src/matcher.ts';
import { parse, recommendationsSchema } from '../src/validation.ts';
import { SAMPLE_REQUEST } from '../../shared/fixtures.ts';
const large = { widthCm: 400, lengthCm: 300, heightCm: 260 };
test('four fictional items: two chairs, two sofas, local references exist', async () => {
  assert.equal(catalog.length, 4); assert.equal(new Set(catalog.map(c=>c.id)).size,4);
  assert.equal(catalog.filter(c=>c.category==='chair').length,2);
  for (const item of catalog) { assert.equal(item.provenance,'fictional-demo'); await access(item.referencePath); }
});
test('sample returns two distinct sofas ranked by recognized preferences', () => {
  const result = recommend(SAMPLE_REQUEST.room,SAMPLE_REQUEST.request);
  assert.deepEqual(result.candidates.map(c=>c.id),['sofa-linen','sofa-sage']);
  assert.match(result.candidates[0].matchReason,/beige/);
  assert.ok(!('referencePath' in result.candidates[0]));
});
test('category excludes unrelated candidates; tags refine stable order', () => {
  assert.deepEqual(recommend(large,{category:'chair',description:'modern blue'}).candidates.map(c=>c.id),['chair-blue','chair-oak']);
  assert.deepEqual(recommend(large,{category:'chair',description:''}).candidates.map(c=>c.id),['chair-oak','chair-blue']);
});
test('unknown preferences fall back to category and dimensions', () => {
  assert.equal(recommend(large,{category:'sofa',description:'cozy celestial vibes'}).candidates[0].matchReason,'Matched on category and dimensions.');
});
test('swapped orientation is accepted; exact dimension boundary is accepted', () => {
  const result = recommend({widthCm:85,lengthCm:160},{category:'sofa',description:''});
  assert.deepEqual(result.candidates.map(c=>c.id),['sofa-linen']);
});
test('one and zero candidates are honest; no unrelated fallback', () => {
  assert.equal(recommend({widthCm:170,lengthCm:90},{category:'sofa',description:''}).candidates.length,1);
  assert.equal(recommend({widthCm:20,lengthCm:20},{category:'sofa',description:''}).candidates.length,0);
});
test('height filters only when known on both sides', () => {
  assert.equal(recommend({...large,heightCm:81},{category:'sofa',description:''}).candidates.length,0);
  const items = catalog.map(({heightCm: _height,...c})=>c);
  assert.equal(recommend({...large,heightCm:81},{category:'sofa',description:''},items).candidates.length,2);
});
test('clear category conflict asks for correction; contextual/negated mentions do not', () => {
  assert.throws(()=>recommend(large,{category:'chair',description:'a compact beige sofa'}),/Change the category/);
  assert.throws(()=>recommend(large,{category:'sofa',description:'I want a blue chair'}),/Change the category/);
  for (const description of ['chair beside my sofa','not a sofa','something next to my sofa'])
    assert.equal(recommend(large,{category:'chair',description}).candidates.length,2);
});
test('validation rejects non-integer, zero, negative, string dimensions and extra URLs', () => {
  for(const widthCm of [0,-1,1.5,'400',Infinity,NaN]) assert.throws(()=>parse(recommendationsSchema,{room:{...large,widthCm},request:{category:'chair',description:''}}));
  assert.throws(()=>parse(recommendationsSchema,{...SAMPLE_REQUEST,referenceUrl:'https://untrusted.invalid/a.png'}));
  assert.throws(()=>parse(recommendationsSchema,{...SAMPLE_REQUEST,request:{category:'table',description:''}}));
  assert.throws(()=>parse(recommendationsSchema,{...SAMPLE_REQUEST,request:{category:'chair',description:'x'.repeat(501)}}));
});
