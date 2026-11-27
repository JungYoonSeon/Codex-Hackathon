/** Mobile-safe shared contract: no server imports, keys, or reference filesystem paths. */
export type Category = 'chair' | 'sofa';
export interface RoomInput { widthCm: number; lengthCm: number; heightCm?: number }
export interface PhotoInput {
  photoId: string; uri: string; mimeType: 'image/jpeg'; widthPx: number; heightPx: number;
  source: 'user' | 'sample';
}
export interface FurnitureRequest { category: Category; description: string }
export interface Candidate {
  id: string; name: string; category: Category; widthCm: number; depthCm: number;
  heightCm?: number; description: string; tags: string[]; matchReason: string;
}
export interface RecommendationsRequest { room: RoomInput; request: FurnitureRequest }
export interface RecommendationsResponse { candidates: Candidate[]; notice?: string }
export interface PreviewMetadata extends RecommendationsRequest {
  requestId: string; inputVersion: number; optionId: string;
}
export type ErrorCode = 'INVALID_INPUT' | 'CATEGORY_CONFLICT' | 'NO_MATCH' | 'UNAUTHORIZED' |
  'UPLOAD_TOO_LARGE' | 'BUSY' | 'RATE_LIMITED' | 'DUPLICATE_REQUEST' | 'LIVE_UNAVAILABLE' |
  'PROVIDER_FAILURE' | 'PROVIDER_TIMEOUT' | 'INVALID_OUTPUT' | 'NOT_FOUND' | 'INTERNAL_ERROR';
export interface ApiError { code: ErrorCode; message: string; retryable: boolean }
export interface PreviewResponse {
  requestId: string; inputVersion: number; optionId: string; imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; mode: 'live';
}
export interface Result {
  requestId: string; inputVersion: number; optionId: string;
  status: 'waiting' | 'generating' | 'ready' | 'failed';
  imageBase64?: string; mimeType?: string; error?: ApiError; mode: 'live' | 'saved_demo';
}
export interface GeneratePreviewInput extends RecommendationsRequest {
  photo: PhotoInput; candidate: Candidate; requestId: string; inputVersion: number; signal?: AbortSignal;
}
export interface PreviewService {
  getRecommendations(room: RoomInput, request: FurnitureRequest): Promise<RecommendationsResponse>;
  generatePreview(input: GeneratePreviewInput): Promise<PreviewResponse | (Omit<PreviewResponse, 'mode'> & { mode: 'saved_demo' })>;
}
export interface Session {
  step: 'dimensions' | 'photo' | 'request' | 'results';
  room?: RoomInput; photo?: PhotoInput; request?: FurnitureRequest;
  inputVersion: number; results: Result[];
}
export const VISUALIZATION_NOTICE = 'AI visualization: product appearance and placement may vary. Dimensions only filter obviously oversized furniture; exact fit is not checked.';
export const PHOTO_HANDLING_NOTICE = 'To create previews, we send this photo to our server and OpenAI. You can try a sample room instead.';
