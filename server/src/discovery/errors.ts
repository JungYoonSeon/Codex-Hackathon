import type { SourceProblem } from '../../../shared/discovery.ts';

/** Typed retailer failure. Messages are safe to show; they never contain credentials or raw responses. */
export class ConnectorError extends Error {
  kind: SourceProblem;
  retryable: boolean;
  constructor(kind: SourceProblem, message: string, retryable = false) {
    super(message); this.name = 'ConnectorError'; this.kind = kind; this.retryable = retryable;
  }
}

export function errorFromHttpStatus(status: number): ConnectorError {
  if (status === 401 || status === 403) return new ConnectorError('access-denied', `Retailer refused access (HTTP ${status}).`);
  if (status === 429) return new ConnectorError('rate-limited', 'Retailer rate limit reached.', true);
  if (status === 404) return new ConnectorError('no-results', 'Retailer reported that the item does not exist (HTTP 404).');
  if (status >= 500) return new ConnectorError('unavailable', `Retailer service error (HTTP ${status}).`, true);
  return new ConnectorError('network', `Unexpected retailer response (HTTP ${status}).`);
}

/** Maps anything thrown by a connector to a ConnectorError without leaking internals. */
export function toConnectorError(error: unknown, signal?: AbortSignal): ConnectorError {
  if (error instanceof ConnectorError) return error;
  const name = (error as { name?: string } | null)?.name;
  if (name === 'AbortError' || name === 'TimeoutError' || signal?.aborted) return new ConnectorError('timeout', 'Retailer request timed out.', true);
  if (error instanceof SyntaxError) return new ConnectorError('parse', 'Retailer response could not be parsed.');
  return new ConnectorError('network', 'Could not reach the retailer.', true);
}

const MESSAGES: Record<SourceProblem, string> = {
  'access-denied': '판매처가 접근을 거부했어요. API 승인 또는 자격 증명을 확인해야 해요.',
  'rate-limited': '판매처 요청 한도에 도달했어요. 잠시 후 다시 시도해 주세요.',
  timeout: '판매처 응답 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.',
  network: '판매처에 연결하지 못했어요. 잠시 후 다시 시도하거나 판매처에서 검색해 주세요.',
  parse: '판매처 응답 형식이 예상과 달라 상품 정보를 읽지 못했어요.',
  'no-results': '판매처에서 일치하는 상품을 찾지 못했어요.',
  unavailable: '판매처 서비스를 지금 사용할 수 없어요.',
};
export const userMessageFor = (kind: SourceProblem) => MESSAGES[kind];
