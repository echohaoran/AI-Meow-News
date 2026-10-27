// Run the pixel scan away from the API event loop. Never return or log decoded QR contents.
import { parentPort, workerData } from "node:worker_threads";
import sharp from "sharp";
import jsQR from "jsqr";

const body = Buffer.from(workerData as Uint8Array);
const metadata = await sharp(body, { limitInputPixels: 40_000_000 }).metadata();
const width = metadata.width ?? 0;
const height = metadata.pageHeight ?? metadata.height ?? 0;
if (!width || !height) throw new Error("unreadable image dimensions");
// Upscaling helps recover small codes in otherwise ordinary editorial images. Limit both axes
// so exceptionally large uploads cannot allocate unbounded raw buffers.
const scale = Math.min(2, 2400 / Math.max(width, height));
const { data, info } = await sharp(body, { limitInputPixels: 40_000_000 })
  .rotate().resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), fit: "inside" })
  .flatten({ background: "#ffffff" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const decode = jsQR as unknown as (pixels: Uint8ClampedArray, width: number, height: number) => unknown;
const found = !!decode(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
parentPort!.postMessage(found);
