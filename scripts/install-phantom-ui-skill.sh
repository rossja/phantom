#!/usr/bin/env bash
# Installs the phantom-ui skill seed into the user-level Claude Agent SDK
# skills directory. The seed is shipped inside the repo at
# local/2026-04-12-phantom-ui-chapter/scratch/02-project2/phantom-ui-skill.md
# and gets copied into ~/.claude/skills/phantom-ui/SKILL.md so the live agent
# discovers it once Project 3 wires settingSources to include 'user'.
set -euo pipefail

SOURCE_FILE="local/2026-04-12-phantom-ui-chapter/scratch/02-project2/phantom-ui-skill.md"
TARGET_DIR="${HOME}/.claude/skills/phantom-ui"
TARGET_FILE="${TARGET_DIR}/SKILL.md"

if [ ! -f "${SOURCE_FILE}" ]; then
  echo "error: source file not found at ${SOURCE_FILE}"
  echo "       run this script from the repository root"
  exit 1
fi

mkdir -p "${TARGET_DIR}"
cp "${SOURCE_FILE}" "${TARGET_FILE}"
echo "installed phantom-ui skill seed at ${TARGET_FILE}"
