#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-development}"
MODEL="${OLLAMA_MODEL:-tinyllama:1.1b-chat}"
export OLLAMA_MODEL="$MODEL"
export OLLAMA_HOST="${OLLAMA_HOST:-127.0.0.1:11434}"
OLLAMA_URL="http://${OLLAMA_HOST}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "[NEXUS AI] Ollama is not installed in this Replit environment. Check the ollama Nix package in .replit and restart the repl."
  exit 1
fi

# Reuse an already-running daemon; otherwise start one in the background.
if ! curl --silent --fail --max-time 2 "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  echo "[NEXUS AI] Starting local Ollama at $OLLAMA_URL ..."
  ollama serve >/tmp/nexus-ollama.log 2>&1 &
  OLLAMA_PID=$!
  echo "$OLLAMA_PID" >/tmp/nexus-ollama.pid
fi

READY=0
for attempt in $(seq 1 90); do
  if curl --silent --fail --max-time 2 "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  echo "[NEXUS AI] Ollama did not become ready. Recent daemon log:"
  tail -n 60 /tmp/nexus-ollama.log 2>/dev/null || true
  exit 1
fi

echo "[NEXUS AI] Ollama is ready. Checking model $MODEL ..."
if ! ollama list 2>/dev/null | awk 'NR > 1 {print $1}' | grep -Fxq "$MODEL"; then
  echo "[NEXUS AI] Downloading $MODEL (first startup may take a few minutes) ..."
  if ! ollama pull "$MODEL"; then
    echo "[NEXUS AI] Could not download $MODEL. Check network access and available disk space."
    tail -n 60 /tmp/nexus-ollama.log 2>/dev/null || true
    exit 1
  fi
fi

echo "[NEXUS AI] Model $MODEL is ready."

if [ "$MODE" = "production" ]; then
  if [ ! -f dist/index.cjs ]; then
    echo "[NEXUS AI] Production build dist/index.cjs is missing. Run npm run build first."
    exit 1
  fi
  exec node ./dist/index.cjs
fi

exec npm run dev
