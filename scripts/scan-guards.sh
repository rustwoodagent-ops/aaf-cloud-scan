#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR=${1:?target directory required}
MAX_FILE_COUNT=${2:-12000}
MAX_PATH_DEPTH=${3:-12}
MAX_EXTRACTED_SIZE_KB=${4:-75000}

FILE_COUNT=$(find "$TARGET_DIR" -type f | wc -l | tr -d ' ')
DEEPEST_PATH=$(find "$TARGET_DIR" -type f -printf '%P\n' | awk -F/ 'NF > max { max = NF } END { print max + 0 }')
TOTAL_SIZE_KB=$(du -sk "$TARGET_DIR" | awk '{ print $1 }')

if (( FILE_COUNT > MAX_FILE_COUNT )); then
  echo "Repository exceeds file-count limit (${FILE_COUNT} > ${MAX_FILE_COUNT})." >&2
  exit 1
fi

if (( DEEPEST_PATH > MAX_PATH_DEPTH )); then
  echo "Repository exceeds max path depth (${DEEPEST_PATH} > ${MAX_PATH_DEPTH})." >&2
  exit 1
fi

if (( TOTAL_SIZE_KB > MAX_EXTRACTED_SIZE_KB )); then
  echo "Repository exceeds extracted-size limit (${TOTAL_SIZE_KB} > ${MAX_EXTRACTED_SIZE_KB} KB)." >&2
  exit 1
fi

echo "Guardrails passed: files=${FILE_COUNT} deepest_path=${DEEPEST_PATH} total_kb=${TOTAL_SIZE_KB}"
