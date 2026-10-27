#!/usr/bin/env bash
set -uo pipefail
cd /mnt/local_data/Repo/AI-News/source
source ../.tooling/development-environment.env
E=/mnt/local_data/File/AI-News/00-临时文件/开发接续/全栈
exec 9>../.coordination/dependencies.lock
flock -n 9 || exit 75
failed=0
run() {
 local label=$1; shift
 "$@" > "$E/$label.log" 2>&1
 local result=$?
 printf '{"check":"%s","exit":%s}\n' "$label" "$result" | tee -a "$E/final-check-results.ndjson"
 if [ "$result" -ne 0 ]; then failed=1; tail -25 "$E/$label.log"; fi
}
: > "$E/final-check-results.ndjson"
run final-typecheck npm run typecheck
run final-build npm run build
run final-http node --env-file=../.secrets/test.env deploy/ai-news/test-isolated.mjs tests/backend/api.test.ts
run final-web node --test --test-concurrency=1 tests/frontend/public-states.test.ts
run final-real-ssr env FRONTEND_EVIDENCE_DIR="$E/final-real-ssr" API_BASE_URL=http://127.0.0.1:43182 node tests/frontend/real-api-smoke.ts
run final-compose env AI_NEWS_IMAGE=ainews-app:review AI_NEWS_DATA_DIR=/mnt/local_data/Repo/AI-News/.runtime/production/data AIHOT_RELEASE=review docker compose config --no-env-resolution --quiet
run final-diff git diff --check
exit "$failed"
