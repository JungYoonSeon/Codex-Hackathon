import { fileURLToPath } from 'node:url';
import type { Candidate } from '../../shared/contracts.ts';
export interface CatalogItem extends Omit<Candidate, 'matchReason'> { referencePath: string; provenance: 'fictional-demo' }
const ref = (id: string) => fileURLToPath(new URL(`../assets/catalog/${id}.png`, import.meta.url));
export const catalog: CatalogItem[] = [
  { id: 'chair-oak', name: 'Demo Oak Chair', category: 'chair', widthCm: 50, depthCm: 55, heightCm: 82,
    tags: ['oak', 'wood', 'natural', 'minimal', 'compact'], description: 'Fictional compact natural-oak chair with a curved wood back, beige seat and four slim wooden legs.', referencePath: ref('chair-oak'), provenance: 'fictional-demo' },
  { id: 'chair-blue', name: 'Demo Blue Lounge Chair', category: 'chair', widthCm: 78, depthCm: 80, heightCm: 88,
    tags: ['blue', 'fabric', 'modern', 'lounge'], description: 'Fictional blue upholstered lounge chair with rounded arms, a padded back and four dark short legs.', referencePath: ref('chair-blue'), provenance: 'fictional-demo' },
  { id: 'sofa-linen', name: 'Demo Compact Linen Sofa', category: 'sofa', widthCm: 160, depthCm: 85, heightCm: 82,
    tags: ['beige', 'fabric', 'minimal', 'compact'], description: 'Fictional compact two-seat beige linen sofa with square arms, two back cushions and four oak legs.', referencePath: ref('sofa-linen'), provenance: 'fictional-demo' },
  { id: 'sofa-sage', name: 'Demo Sage Sofa', category: 'sofa', widthCm: 200, depthCm: 95, heightCm: 86,
    tags: ['green', 'sage', 'fabric', 'modern'], description: 'Fictional sage-green upholstered sofa with rounded arms, two back cushions and four dark wood legs.', referencePath: ref('sofa-sage'), provenance: 'fictional-demo' },
];
