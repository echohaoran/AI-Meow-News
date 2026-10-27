#!/usr/bin/env bash
set -uo pipefail
cd /mnt/local_data/Repo/AI-News/source
source ../.tooling/development-environment.env
evidence=/mnt/local_data/File/AI-News/00-临时文件/开发接续/后端
mkdir -p "$evidence"
exec 9>../.coordination/dependencies.lock
if ! flock -n 9; then
  printf 'dependency lock unavailable\n' >&2
  exit 75
fi
export MODEL_CALLS_ENABLED=false COLLECT_ENABLED=false FEISHU_CONTENT_PUSH_ENABLED=false FEISHU_INTERNAL_ENABLED=false INDEXNOW_SUBMIT_ENABLED=false
failed=0
run() {
  local label="$1"
  shift
  "$@" > "$evidence/$label.log" 2>&1
  local result=$?
  printf '{"check":"%s","exit":%s}\n' "$label" "$result" | tee -a "$evidence/unit-check-results.ndjson"
  if [ "$result" -ne 0 ]; then failed=1; tail -25 "$evidence/$label.log"; fi
}
: > "$evidence/unit-check-results.ndjson"
for component in contracts backend; do run "typecheck-$component" node node_modules/typescript/bin/tsc -p "packages/$component"; done
for component in api worker; do run "typecheck-$component" node node_modules/typescript/bin/tsc -p "apps/$component"; done
run typecheck-backend-tests node node_modules/typescript/bin/tsc -p tests/backend
run backend-behavior node --env-file=../.secrets/test.env --test --test-concurrency=1 tests/backend/api.test.ts
run existing-materials node --env-file=../.secrets/test.env --test --test-concurrency=1 tests/materials.test.ts tests/ingest.test.ts tests/private-routes.test.ts tests/collection-identity.test.ts
run standalone-security node --import ./tests/standalone.ts --test --test-concurrency=1 tests/url.standalone.test.ts tests/outbound-protocol.standalone.test.ts tests/migration-safety.standalone.test.ts tests/migration-check.standalone.test.ts
run existing-budgets node --env-file=../.secrets/test.env --test --test-concurrency=1 --test-name-pattern="migrations seed a budget|concurrent distinct requests|budget independently refuses|with the valve off" tests/receipts.test.ts
exit "$failed"
