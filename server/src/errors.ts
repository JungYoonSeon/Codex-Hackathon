import type { ApiError, ErrorCode } from '../../shared/contracts.ts';
export class AppError extends Error {
  status: number;
  body: ApiError;
  constructor(status: number, code: ErrorCode, message: string, retryable = false) {
    super(message); this.status = status; this.body = { code, message, retryable };
  }
}
export function providerError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = error as { status?: number; name?: string } | null;
  if (e?.name === 'APIConnectionTimeoutError' || e?.name === 'AbortError' || e?.name === 'TimeoutError')
    return new AppError(504, 'PROVIDER_TIMEOUT', 'The image service took too long. You can retry this option.', true);
  if (e?.status === 429) return new AppError(429, 'RATE_LIMITED', 'The image service is busy. Try this option again later.', true);
  if (e?.status === 401 || e?.status === 403)
    return new AppError(502, 'PROVIDER_FAILURE', 'The image service is not authorized. Ask the demo operator to check API access.');
  if (e?.status === 400 || e?.status === 422)
    return new AppError(502, 'PROVIDER_FAILURE', 'The image service could not accept this edit. Try another photo or adjust your request.');
  return new AppError(502, 'PROVIDER_FAILURE', 'The image service could not create this option. Please retry.', true);
}
