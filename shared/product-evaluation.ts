import type { Evidence, HomeProfile, MeasuredDimensions } from './home-profile.ts';
/** Additive contract: teammate's discovery schema does not need editing. */
export interface PackageDimensions extends MeasuredDimensions { id: string; name: string }
export interface Money { amount: number; currency: string }
export interface EvaluationProduct {
  id: string; name: string; category: string; brand?: string; retailer?: string;
  productUrl?: string; imageUrl?: string; demo: boolean;
  dimensions: MeasuredDimensions;
  packages: PackageDimensions[];
  packagesComplete?: Evidence<boolean>;
  price?: Evidence<Money>;
  deliveryFee?: Evidence<Money>;
  tax?: Evidence<Money>;
  deliveryAvailable?: Evidence<boolean>;
  deliveryRegion?: Evidence<string>;
  deliveryService?: Evidence<'doorstep' | 'room' | 'assembly'>;
  deliveryDays?: Evidence<number>;
  materials?: Evidence<string[]>;
  careInstructions?: Evidence<string>;
  washableCovers?: Evidence<boolean>;
  scratchResistant?: Evidence<boolean>;
  roundedEdges?: Evidence<boolean>;
  requiresAnchoring?: Evidence<boolean>;
  groundClearanceCm?: Evidence<number>;
  storageCapacityLiters?: Evidence<number>;
  careDifficulty?: Evidence<'low' | 'moderate' | 'high'>;
}
export type CheckStatus = 'pass' | 'conflict' | 'review';
export interface EvidenceRow { label: string; fact?: Evidence<unknown> }
export interface ProductCheck {
  id: string; group: 'room' | 'walkway' | 'delivery' | 'budget' | 'lifestyle';
  status: CheckStatus; priority: 'required' | 'preference';
  title: string; detail: string; action?: string; evidence: EvidenceRow[];
}
export interface ProductEvaluation {
  productId: string;
  verdict: 'conflicts' | 'needs-confirmation' | 'meets-entered-conditions';
  checks: ProductCheck[];
  reasons: string[];
  tradeoffs: string[];
  missingInformation: string[];
  evidence: EvidenceRow[];
  certainty: 'demo' | 'estimated' | 'incomplete' | 'documented-inputs';
  evidenceCounts: { measured: number; supplier: number; estimated: number; unknown: number; demo: number; userReported: number };
  walkwayCm?: number;
  totalCost?: Money;
  limitations: string[];
}
export interface ComparisonRow { label: string; left: string; right: string; note?: string }
export interface ProductComparison {
  left: ProductEvaluation; right: ProductEvaluation; rows: ComparisonRow[];
  priceDifference?: Money;
}
export interface RankedProduct { product: EvaluationProduct; evaluation: ProductEvaluation; rank: number }
export type ProductEvaluator = (product: EvaluationProduct, home: HomeProfile) => ProductEvaluation;
