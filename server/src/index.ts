import { createStyleRanker } from './style/recommendations.ts';
import { createApp } from './app.ts';
import { createOpenAIEditor } from './provider.ts';
const token = process.env.DEMO_SESSION_TOKEN ?? '';
if (token.length < 32) {
  console.error('Set a random DEMO_SESSION_TOKEN of at least 32 characters in server/.env. See .env.example.');
  process.exit(1);
}
const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.IMAGE_MODEL?.trim();
const editor = apiKey && model ? createOpenAIEditor(apiKey, model) : undefined;
const recommendationModel = process.env.RECOMMENDATION_MODEL?.trim() || 'gpt-4o-mini';
const styleRanker = apiKey && recommendationModel ? createStyleRanker(apiKey, recommendationModel) : undefined;
const app = createApp({ sessionToken: token, editor, styleRanker, allowedOrigin: process.env.ALLOWED_ORIGIN || undefined });
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
const server = app.listen(port, process.env.HOST ?? '0.0.0.0', () => {
  console.log(`Room preview backend listening on port ${port}; live provider ${editor ? 'configured (not yet verified)' : 'unavailable'}.`);
});
server.requestTimeout = 180_000;
server.headersTimeout = 20_000;
server.timeout = 180_000;
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
});
