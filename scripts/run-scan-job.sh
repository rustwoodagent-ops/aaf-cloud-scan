#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
JOB_ID=${JOB_ID:?JOB_ID is required}
TARGET_OWNER=${TARGET_OWNER:?TARGET_OWNER is required}
TARGET_REPO=${TARGET_REPO:?TARGET_REPO is required}
TARGET_DEFAULT_BRANCH=${TARGET_DEFAULT_BRANCH:?TARGET_DEFAULT_BRANCH is required}
CALLBACK_URL=${CALLBACK_URL:?CALLBACK_URL is required}
SCAN_CALLBACK_SECRET=${SCAN_CALLBACK_SECRET:?SCAN_CALLBACK_SECRET is required}
AAF_COMMIT_SHA=${AAF_COMMIT_SHA:?AAF_COMMIT_SHA is required}
RUN_STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ARTIFACTS_DIR="$ROOT_DIR/artifacts/$JOB_ID"
TARGET_DIR="$RUNNER_TEMP/scan-target"
AAF_SOURCE_DIR="$RUNNER_TEMP/aaf-src"
TARGET_TARBALL_URL="https://codeload.github.com/${TARGET_OWNER}/${TARGET_REPO}/tar.gz/${TARGET_DEFAULT_BRANCH}"
AAF_TARBALL_URL="https://codeload.github.com/rustwoodagent-ops/agent-artifact-firewall/tar.gz/${AAF_COMMIT_SHA}"

if [[ ! "$AAF_COMMIT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "AAF_COMMIT_SHA must be a full 40-character commit SHA." >&2
  exit 1
fi

mkdir -p "$ARTIFACTS_DIR"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
rm -rf "$AAF_SOURCE_DIR"
mkdir -p "$AAF_SOURCE_DIR"

post_callback() {
  local status=$1
  local error_message=${2:-}
  JOB_STATUS="$status" \
  ERROR_MESSAGE="$error_message" \
  CALLBACK_URL="$CALLBACK_URL" \
  SCAN_CALLBACK_SECRET="$SCAN_CALLBACK_SECRET" \
  RUN_STARTED_AT="$RUN_STARTED_AT" \
  REPORT_JSON_PATH="$ARTIFACTS_DIR/report.json" \
  REPORT_MARKDOWN_PATH="$ARTIFACTS_DIR/report.md" \
  node "$ROOT_DIR/scripts/runner-callback.mjs"
}

on_error() {
  local line_no=$1
  local exit_code=$2
  post_callback failed "Scan job failed near line ${line_no}."
  exit "$exit_code"
}
trap 'on_error $LINENO $?' ERR

post_callback running

curl --fail --silent --show-error --location \
  --connect-timeout 20 --max-time 120 \
  "${TARGET_TARBALL_URL}" \
  -o "$RUNNER_TEMP/repo.tar.gz"

tar -xzf "$RUNNER_TEMP/repo.tar.gz" -C "$TARGET_DIR" --strip-components=1
find "$TARGET_DIR" -type f -exec chmod a-x {} +
"$ROOT_DIR/scripts/scan-guards.sh" "$TARGET_DIR" "${MAX_FILE_COUNT:-12000}" "${MAX_PATH_DEPTH:-12}" "${MAX_EXTRACTED_SIZE_KB:-75000}"

curl --fail --silent --show-error --location \
  --connect-timeout 20 --max-time 120 \
  "${AAF_TARBALL_URL}" \
  -o "$RUNNER_TEMP/aaf.tar.gz"

tar -xzf "$RUNNER_TEMP/aaf.tar.gz" -C "$AAF_SOURCE_DIR" --strip-components=1
(
  cd "$AAF_SOURCE_DIR"
  timeout --signal=TERM 180 go build -o "$RUNNER_TEMP/aaf" ./cmd/aaf
)

timeout --signal=TERM 300 "$RUNNER_TEMP/aaf" scan "$TARGET_DIR" --format json --out "$ARTIFACTS_DIR/report.json" --fail-on high --max-risk-score 70 --no-fail
timeout --signal=TERM 300 "$RUNNER_TEMP/aaf" scan "$TARGET_DIR" --format markdown --out "$ARTIFACTS_DIR/report.md" --fail-on high --max-risk-score 70 --no-fail
node "$ROOT_DIR/scripts/build-summary.mjs" "$ARTIFACTS_DIR/report.json" > "$ARTIFACTS_DIR/summary.json"

trap - ERR
post_callback completed
