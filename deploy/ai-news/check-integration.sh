#!/usr/bin/env bash
set -uo pipefail
cd /mnt/local_data/Repo/AI-News/source
source ../.tooling/development-environment.env
E=${INTEGRATION_EVIDENCE_DIR:-/mnt/local_data/File/AI-News/00-临时文件/开发接续/全栈}
mkdir -p "$E"
exec 9>../.coordination/dependencies.lock
flock -n 9 || exit 75
export MODEL_CALLS_ENABLED=false COLLECT_ENABLED=false FEISHU_CONTENT_PUSH_ENABLED=false FEISHU_INTERNAL_ENABLED=false INDEXNOW_SUBMIT_ENABLED=false
failed=0
run() {
  local label=$1; shift
  "$@" > "$E/$label.log" 2>&1
  local result=$?
  printf '{"check":"%s","exit":%s}\n' "$label" "$result" | tee -a "$E/check-results.ndjson"
  if [ "$result" -ne 0 ]; then failed=1; tail -35 "$E/$label.log"; fi
}
: > "$E/check-results.ndjson"
run typecheck npm run typecheck
run build npm run build
run backend node --env-file=../.secrets/test.env deploy/ai-news/test-isolated.mjs tests/backend/api.test.ts tests/materials.test.ts tests/ingest.test.ts tests/private-routes.test.ts tests/collection-identity.test.ts tests/receipts.test.ts
run security node --import ./tests/standalone.ts --test --test-concurrency=1 tests/url.standalone.test.ts tests/outbound-protocol.standalone.test.ts tests/migration-safety.standalone.test.ts tests/migration-check.standalone.test.ts
run web node --test --test-concurrency=1 apps/web/tests/cache.test.ts apps/web/tests/request-target.test.ts apps/web/tests/report-ordinals.test.ts apps/web/tests/report-discovery.test.ts apps/web/tests/markdown.test.ts apps/web/tests/local-state.test.ts apps/web/tests/session-cache.test.ts apps/web/tests/day-header-year.test.ts tests/frontend/public-states.test.ts
run diff git diff --check
exit "$failed"
