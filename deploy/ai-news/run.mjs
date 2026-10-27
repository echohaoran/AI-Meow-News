// Run only on homelab. Credentials stay outside source and never appear in argv or logs.
import { readFileSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
import path from "node:path";

const root = "/mnt/local_data/Repo/AI-News";
const source = path.join(root, "source");
const [profile, action, ...args] = process.argv.slice(2);
const actions = {
  api: "apps/api/src/main.ts", worker: "apps/worker/src/main.ts",
  migrate: "scripts/migrate.ts", seed: "scripts/seed.ts",
  "collect-once": "apps/worker/src/collect-once.ts",
  "model-check": "deploy/ai-news/model-check.ts",
  "news-check": "deploy/ai-news/news-check.ts",
};
try {
  if (!["development", "production", "test"].includes(profile) || !actions[action]) throw new Error("Usage: run.mjs development|production|test api|worker|migrate|seed|collect-once|model-check|news-check");
  if (realpathSync(path.resolve(import.meta.dirname, "../..")) !== realpathSync(source)) throw new Error("Use the canonical homelab checkout");
  if (profile === "test" && action !== "migrate") throw new Error("The test profile only permits migration; run test files with the test DB runner");
  if (action !== "collect-once" && args.length) throw new Error("Unexpected arguments");
  const read = (file) => existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
  const env = { ...process.env, ...read(path.join(root, ".secrets", profile + ".env")), ...read(path.join(root, ".secrets", "backend-" + profile + ".env")) };
  if (!env.DATABASE_URL) throw new Error("Missing DATABASE_URL in runtime configuration");
  const database = new URL(env.DATABASE_URL).pathname.slice(1);
  if (profile === "test" && !/_(test|ci)$/.test(database)) throw new Error("Test database name must end in _test or _ci");
  env.LLM_BASE_URL ||= env.OPENAI_BASE_URL;
  env.LLM_API_KEY ||= env.OPENAI_API_KEY;
  env.LLM_MODEL ||= env.OPENAI_MODEL;
  // AI_ENABLED is not an authorization valve. Opening model calls is always explicit.
  env.COLLECT_ENABLED = process.env.COLLECT_ENABLED === "true" ? "true" : "false";
  env.MODEL_CALLS_ENABLED = process.env.MODEL_CALLS_ENABLED === "true" ? "true" : "false";
  for (const name of ["FEISHU_CONTENT_PUSH_ENABLED", "FEISHU_INTERNAL_ENABLED", "INDEXNOW_SUBMIT_ENABLED"]) env[name] = "false";
  env.API_PORT = "43182";
  env.API_HOST = process.env.API_HOST || "127.0.0.1";
  env.SITE_URL = process.env.SITE_URL || "http://192.168.1.77:43180";
  env.AIHOT_ENVIRONMENT = profile;
  env.NODE_ENV = profile === "production" ? "production" : "development";
  env.DATABASE_POOL_MAX ||= "4";
  env.AIHOT_DATA_DIR = path.join(root, ".runtime", profile, "data");
  env.TMPDIR = path.join(root, ".tmp");
  env.XDG_CACHE_HOME = path.join(root, ".cache");
  for (const dir of [env.AIHOT_DATA_DIR, env.TMPDIR]) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const child = spawn(process.execPath, [actions[action], ...args], { cwd: source, env, stdio: "inherit" });
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
  child.on("error", () => { console.error("Could not start backend process"); process.exitCode = 1; });
  child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
} catch (error) {
  // Keep parser, filesystem and URL errors from including configuration values.
  console.error(error instanceof Error && /^(Usage:|Use the|The test|Unexpected|Missing DATABASE|Test database)/.test(error.message) ? error.message : "Invalid backend runtime configuration");
  process.exitCode = 1;
}
