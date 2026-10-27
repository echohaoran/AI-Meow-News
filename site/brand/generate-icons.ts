// Optional asset generation on homelab with the installed sharp dependency.
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
for (const [name, size] of [["icon.png", 512], ["icon-192.png", 192], ["apple-icon.png", 180]] as const) {
  await sharp(new URL("logo.svg", import.meta.url).pathname).resize(size, size).png().toFile(new URL(name, import.meta.url).pathname);
}
const png = await sharp(new URL("logo.svg", import.meta.url).pathname).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header[6] = 32; header[7] = 32;
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile(new URL("favicon.ico", import.meta.url), Buffer.concat([header, png]));
console.log("Own-brand icons generated: 512, 192, 180, ICO 32.");
