import { Router, type RequestHandler, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { catalog } from "../catalog.ts";
import { AppError, providerError } from "../errors.ts";
import { validateOutput } from "../provider.ts";
import type { ProductEditor } from "./editor.ts";
import type { createProductRegistry } from "./registry.ts";
const metadata = z
  .object({
    requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    inputVersion: z.number().int().nonnegative(),
    optionId: z.string().min(1).max(200),
    room: z
      .object({
        widthCm: z.number().positive().max(100000),
        lengthCm: z.number().positive().max(100000),
        heightCm: z.number().positive().max(100000).optional(),
      })
      .strict(),
    target: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        rotation: z.union([z.literal(0), z.literal(90)]),
      })
      .strict(),
    focus: z.enum(["whole", "corner", "wall"]),
    description: z.string().max(500),
  })
  .strict();
const MAX_BYTES = 5 * 1024 * 1024;
async function jpeg(bytes: Buffer, strict = false) {
  try {
    const image = sharp(bytes, {
        limitInputPixels: 16000000,
        failOn: "warning",
      }),
      m = await image.metadata();
    if (
      (strict && m.format !== "jpeg") ||
      !["jpeg", "png", "webp"].includes(m.format ?? "") ||
      (m.pages ?? 1) > 1
    )
      throw new Error();
    return await image
      .rotate()
      .resize({
        width: 1280,
        height: 1280,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "The room or product image is unreadable. Use a JPEG, PNG or WebP photo.",
    );
  }
}
export async function fetchProductImage(
  url: string,
  source: string,
  signal: AbortSignal,
): Promise<Buffer> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "Upload a product reference photo for this item.",
    );
  }
  const host = target.hostname.toLowerCase();
  const allowed =
    source === "ikea"
      ? host === "www.ikea.com"
      : source === "amazon"
        ? [
            "m.media-amazon.com",
            "images-na.ssl-images-amazon.com",
            "images-eu.ssl-images-amazon.com",
          ].includes(host)
        : source === "ebay"
          ? host === "i.ebayimg.com"
          : source === "coupang"
            ? /^(?:thumbnail\d*\.)?coupangcdn\.com$/.test(host)
            : false;
  if (
    !allowed ||
    target.protocol !== "https:" ||
    target.port ||
    target.username ||
    target.password
  )
    throw new AppError(
      400,
      "INVALID_INPUT",
      "This image host is not supported. Upload a product reference photo instead.",
    );
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(12000)]);
  const response = await fetch(target, { signal: deadline, redirect: "error" });
  if (
    !response.ok ||
    !response.body ||
    !/^image\/(jpeg|png|webp)(;|$)/i.test(
      response.headers.get("content-type") ?? "",
    )
  )
    throw new AppError(
      400,
      "INVALID_INPUT",
      "The retailer image could not be loaded. Upload a product reference photo instead.",
    );
  if (Number(response.headers.get("content-length")) > MAX_BYTES)
    throw new AppError(
      413,
      "UPLOAD_TOO_LARGE",
      "Product image exceeds 5 MB. Upload a smaller reference.",
    );
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES)
        throw new AppError(
          413,
          "UPLOAD_TOO_LARGE",
          "Product image exceeds 5 MB.",
        );
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}
export function createProductPreviewRouter(options: {
  registry: ReturnType<typeof createProductRegistry>;
  editor?: ProductEditor;
  acquire: RequestHandler;
  useBudget: (id: string, res: Response) => void;
  timeoutMs: number;
}) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_BYTES,
      files: 2,
      fields: 1,
      parts: 3,
      fieldSize: 8192,
    },
  }).fields([
    { name: "photo", maxCount: 1 },
    { name: "reference", maxCount: 1 },
  ]);
  router.post(
    "/",
    options.acquire,
    (req, res, next) => upload(req, res, (error) => next(error)),
    async (req, res) => {
      let raw;
      try {
        raw = JSON.parse(req.body?.metadata);
      } catch {
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Send product preview metadata with the photo.",
        );
      }
      const parsed = metadata.safeParse(raw);
      if (!parsed.success)
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Check the product, room measurements and target point.",
        );
      const input = parsed.data,
        product = options.registry.get(input.optionId);
      if (!product)
        throw new AppError(
          404,
          "NOT_FOUND",
          "This product is no longer in the server catalog. Search for it again to refresh its reference.",
        );
      if (!options.editor)
        throw new AppError(
          503,
          "LIVE_UNAVAILABLE",
          "Configure OPENAI_API_KEY and IMAGE_MODEL on the server to generate furniture previews.",
        );
      const files = req.files as
        Record<string, Express.Multer.File[]> | undefined;
      if (!files?.photo?.[0])
        throw new AppError(
          400,
          "INVALID_INPUT",
          "Attach the original room photo.",
        );
      const controller = new AbortController();
      const disconnect = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on("close", disconnect);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(
              new AppError(
                504,
                "PROVIDER_TIMEOUT",
                "This preview timed out. Retry this product.",
                true,
              ),
            );
          }, options.timeoutMs);
        });
        const job = async () => {
          const roomJpeg = await jpeg(files.photo[0].buffer, true);
          let reference: Buffer;
          if (files.reference?.[0]) reference = files.reference[0].buffer;
          else {
            const demo = catalog.find((c) => c.id === product.previewOptionId);
            if (demo) reference = await readFile(demo.referencePath);
            else if (product.imageUrl)
              reference = await fetchProductImage(
                product.imageUrl,
                product.source,
                controller.signal,
              );
            else
              throw new AppError(
                400,
                "INVALID_INPUT",
                "This product has no reference image. Upload its product photo.",
              );
          }
          const referenceJpeg = await jpeg(reference);
          if (controller.signal.aborted || res.destroyed)
            throw new AppError(
              504,
              "PROVIDER_TIMEOUT",
              "Preview request was cancelled.",
              true,
            );
          options.useBudget(input.requestId, res);
          res.locals.jobStarted = true;
          return validateOutput(
            await options.editor!.edit({
              roomJpeg,
              referenceJpeg,
              product,
              room: input.room,
              target: input.target,
              focus: input.focus,
              description: input.description,
              signal: controller.signal,
            }),
          );
        };
        const result = await Promise.race([job(), deadline]);
        if (!res.destroyed)
          res.json({
            ...result,
            requestId: input.requestId,
            inputVersion: input.inputVersion,
            optionId: product.id,
            mode: "live",
          });
      } catch (error) {
        throw providerError(error);
      } finally {
        clearTimeout(timer);
        res.off("close", disconnect);
        res.locals.release?.();
      }
    },
  );
  return router;
}
