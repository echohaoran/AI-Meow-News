// Public module snapshots share the publication read boundary, without exposing private settings.
import { sql } from "../db.ts";

export const publicSnapshotKey = (name: string) => `public-snapshot:${name}`;

export async function loadPublicSnapshot<T>(name: string): Promise<T | null> {
  const [row] = await sql<{ value: T }[]>`SELECT value FROM settings WHERE key = ${publicSnapshotKey(name)}`;
  return row?.value ?? null;
}
