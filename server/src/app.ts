import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { timingSafeEqual } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { catalog } from './catalog.ts';
import { recommend } from './matcher.ts';
import { parse, recommendationsSchema, previewSchema } from './validation.ts';
import { AppError, providerError } from './errors.ts';
import { validateOutput, type ImageEditor } from './provider.ts';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export interface AppConfig {
  sessionToken: string; editor?: ImageEditor; allowedOrigin?: string;
  timeoutMs?: number; maxConcurrent?: number; maxPreviewsPerHour?: number;
}
export function createApp(config: AppConfig) {
  if (config.sessionToken.length < 32) throw new Error('DEMO_SESSION_TOKEN must contain at least 32 characters.');
  const app = express(); app.disable('x-powered-by');
  let active = 0; let used = 0; let windowStart = Date.now();
  const seen = new Set<string>(); // Bounded by hourly paid-attempt budget; no image retention.
  const cap = config.maxConcurrent ?? 1;
  const timeoutMs = config.timeoutMs ?? 170_000;
  const maxPreviews = config.maxPreviewsPerHour ?? 12;
  app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  if (config.allowedOrigin) app.use((req, res, next) => {
    if (req.headers.origin === config.allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', config.allowedOrigin!);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    }
    next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok', liveConfigured: !!config.editor, provider: 'OpenAI' }));
  const authenticate: RequestHandler = (req, _res, next) => {
    const supplied = Buffer.from(req.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${config.sessionToken}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return next(new AppError(401, 'UNAUTHORIZED', 'Enter the current restricted demo-session token.'));
    next();
  };
  app.post('/recommendations', authenticate, express.json({ limit: '16kb' }), (req, res) => {
    const input = parse(recommendationsSchema, req.body);
    res.json(recommend(input.room, input.request));
  });
  const acquire: RequestHandler = (_req, res, next) => {
    if (active >= cap) { res.setHeader('Retry-After', '5'); return next(new AppError(429, 'BUSY', 'Another preview is in progress. Retry this option when it finishes.', true)); }
    active++;
    let released = false;
    res.locals.release = () => { if (!released) { active--; released = true; } };
    // The route retains this lease during the paid job even if the client disconnects.
    res.on('finish', () => { if (!res.locals.jobStarted) res.locals.release(); });
    res.on('close', () => { if (!res.locals.jobStarted) res.locals.release(); });
    next();
  };
  const upload = multer({ storage: multer.memoryStorage(), limits: {
    fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 1, parts: 2, fieldSize: 8192, fieldNameSize: 100,
  }, fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'image/jpeg') return cb(new AppError(400, 'INVALID_INPUT', 'Upload one JPEG photo. Convert it in the app first.'));
    cb(null, true);
  } }).single('photo');
  app.post('/preview', authenticate, acquire, (req, res, next) => upload(req, res, error => {
    if (error && !(error instanceof AppError) && !(error instanceof multer.MulterError))
      return next(new AppError(400, 'INVALID_INPUT', 'The multipart upload is malformed. Try uploading the photo again.'));
    next(error);
  }), async (req, res) => {
    let metadata: unknown;
    try { metadata = JSON.parse(req.body?.metadata); }
    catch { throw new AppError(400, 'INVALID_INPUT', 'Send a JSON metadata field with the JPEG photo.'); }
    const input = parse(previewSchema, metadata);
    const candidate = catalog.find(item => item.id === input.optionId);
    if (!candidate) throw new AppError(400, 'INVALID_INPUT', 'Choose a known catalog option.');
    const eligible = recommend(input.room, input.request).candidates;
    if (!eligible.some(item => item.id === candidate.id))
      throw new AppError(400, 'NO_MATCH', 'This option does not match the current category and dimensions. Request recommendations again.');
    if (!req.file) throw new AppError(400, 'INVALID_INPUT', 'Attach one JPEG file in the photo field; a local file URI is not an upload.');
    let roomJpeg: Buffer;
    try {
      const image = sharp(req.file.buffer, { limitInputPixels: 16_000_000, failOn: 'warning' });
      const details = await image.metadata();
      if (details.format !== 'jpeg' || !details.width || !details.height) throw new Error('Not JPEG');
      roomJpeg = await image.rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch { throw new AppError(400, 'INVALID_INPUT', 'The JPEG is unreadable or too large in pixel dimensions. Choose another photo.'); }
    if (!config.editor) throw new AppError(503, 'LIVE_UNAVAILABLE', 'Live preview is unavailable. The operator must configure and verify OpenAI access. Saved examples are only available for the supplied sample.');
    if (Date.now() - windowStart >= 3_600_000) { used = 0; seen.clear(); windowStart = Date.now(); }
    if (seen.has(input.requestId)) throw new AppError(409, 'DUPLICATE_REQUEST', 'This attempt ID was already used. Explicitly retry with a new requestId.');
    if (used >= maxPreviews) { res.setHeader('Retry-After', String(Math.ceil((windowStart + 3_600_000 - Date.now()) / 1000)));
      throw new AppError(429, 'RATE_LIMITED', 'The demo session has reached its hourly preview limit. Try later.', true); }
    if (res.destroyed) return;
    used++; seen.add(input.requestId); res.locals.jobStarted = true;
    const controller = new AbortController();
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new AppError(504, 'PROVIDER_TIMEOUT', 'The preview took too long. You can retry this option.', true));
          controller.abort();
        }, timeoutMs);
      });
      const output = await Promise.race([
        config.editor.edit({ roomJpeg, candidate, metadata: input, signal: controller.signal }).then(validateOutput), deadline,
      ]);
      if (!res.destroyed) res.json({ requestId: input.requestId, inputVersion: input.inputVersion,
        optionId: input.optionId, ...output, mode: 'live' });
    } catch (error) { throw providerError(error); }
    finally { clearTimeout(timer); res.off('close', disconnect); res.locals.release(); }
  });
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'This endpoint does not exist.')));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    let normalized = error instanceof AppError ? error : undefined;
    if (error instanceof multer.MulterError) normalized = error.code === 'LIMIT_FILE_SIZE'
      ? new AppError(413, 'UPLOAD_TOO_LARGE', 'Photo exceeds 5 MB. Resize it and try again.')
      : new AppError(400, 'INVALID_INPUT', 'Send exactly one photo and one small metadata field.');
    if ((error as { type?: string })?.type === 'entity.too.large') normalized = new AppError(413, 'UPLOAD_TOO_LARGE', 'Request body is too large.');
    if ((error as { type?: string })?.type === 'entity.parse.failed') normalized = new AppError(400, 'INVALID_INPUT', 'Request JSON is malformed.');
    normalized ??= new AppError(500, 'INTERNAL_ERROR', 'The server could not process this request. Please retry.', true);
    // Deliberately do not log request bodies, image bytes, preferences, SDK errors or keys.
    if (!res.headersSent && !res.destroyed) res.status(normalized.status).json(normalized.body);
    if (!res.locals.jobStarted) res.locals.release?.();
  };
  app.use(errors);
  return app;
}
