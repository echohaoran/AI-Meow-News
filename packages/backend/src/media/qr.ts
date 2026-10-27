import { Worker } from "node:worker_threads";

// Bound CPU and memory even when a feed requests many uncached images at once.
let active = 0;
const waiting: Array<() => void> = [];
const scans = new Map<string, Promise<boolean>>();
const recent = new Map<string, { found: boolean; until: number }>();

async function scan(body: Buffer): Promise<boolean> {
  if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const worker = new Worker(new URL("./qr-worker.ts", import.meta.url), { workerData: body, execArgv: [] });
      let delivered = false;
      worker.once("message", (result: boolean) => { delivered = true; resolve(result); });
      worker.once("error", reject);
      worker.once("exit", (code) => { if (!delivered || code !== 0) reject(new Error(`image scan worker exited ${code}`)); });
    });
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

export function containsQr(url: string, body: Buffer): Promise<boolean> {
  const cached = recent.get(url);
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.found);
  let job = scans.get(url);
  if (!job) {
    job = scan(body).then((found) => {
      recent.delete(url);
      recent.set(url, { found, until: Date.now() + 60_000 });
      if (recent.size > 512) recent.delete(recent.keys().next().value!);
      return found;
    }).finally(() => scans.delete(url));
    scans.set(url, job);
  }
  return job;
}
