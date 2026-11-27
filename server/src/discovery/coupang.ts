// Coupang connector boundary (Korea).
// Status 2026-11-27: NOT ACTIVE.
// - The candidate access route is the Coupang Partners (affiliate) Open API, which needs an approved
//   Partners account and an access key + secret key (HMAC-signed requests).
// - Coupang's official documentation (partners.coupang.com, developers.coupang.com) returned HTTP 403 to
//   our automated reads, so endpoint paths, signing format, response fields and display/caching rules are
//   NOT verified here. Request signing is intentionally not implemented until a team member with an
//   approved account confirms the official spec.
// - Public coupang.com pages are not fetched (robots.txt itself returned 403; anti-bot protection is not bypassed).
import { ConnectorError } from './errors.ts';

export interface CoupangConfig { accessKey?: string; secretKey?: string }

export function readCoupangConfig(env: NodeJS.ProcessEnv): CoupangConfig {
  return { accessKey: env.COUPANG_ACCESS_KEY?.trim() || undefined, secretKey: env.COUPANG_SECRET_KEY?.trim() || undefined };
}
export const isCoupangConfigured = (config: CoupangConfig) => !!(config.accessKey && config.secretKey);

/** Always rejects without any network call: configured or not, there is no verified API contract yet. */
export async function searchCoupang(config: CoupangConfig): Promise<never> {
  if (!isCoupangConfigured(config)) throw new ConnectorError('unavailable', 'Coupang Partners API credentials are not configured.');
  throw new ConnectorError('unavailable', 'Coupang credentials are present, but the official Partners API contract has not been verified, so no request is sent.');
}
