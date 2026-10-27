// Container entry for the shared root-built app image. No secrets are printed.
import { spawn } from "node:child_process";
const entry = { api: "apps/api/src/main.ts", worker: "apps/worker/src/main.ts", collector: "apps/worker/src/collector.ts", migrate: "scripts/migrate.ts" }[process.argv[2]];
if (!entry || process.argv.length !== 3) {
  console.error("Usage: container.mjs api|worker|collector|migrate");
  process.exitCode = 1;
} else {
  const env = { ...process.env };
  env.LLM_BASE_URL ||= env.OPENAI_BASE_URL;
  env.LLM_API_KEY ||= env.OPENAI_API_KEY;
  env.LLM_MODEL ||= env.OPENAI_MODEL;
  const child = spawn(process.execPath, [entry], { env, stdio: "inherit" });
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
  child.on("error", () => { console.error("Backend launch failed"); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}
