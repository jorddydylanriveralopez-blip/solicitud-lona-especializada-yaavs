#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Git push (Render auto-deploy desde main)"
git push origin main

echo ""
echo "==> Apps Script (clasp)"
if [[ ! -f "$HOME/.clasprc.json" ]]; then
  echo "Clasp no está autenticado. Ejecuta una vez:"
  echo "  npx @google/clasp login"
  echo "Luego vuelve a correr: npm run deploy:gas"
  exit 0
fi

npx @google/clasp push --force
echo "Código subido a Apps Script."

DEPLOY_ID="${GAS_DEPLOYMENT_ID:-}"
if [[ -n "$DEPLOY_ID" ]]; then
  npx @google/clasp deploy --deploymentId "$DEPLOY_ID" --description "Deploy $(date '+%Y-%m-%d %H:%M')"
  echo "Implementación web actualizada (deploymentId=$DEPLOY_ID)."
else
  echo "Tip: define GAS_DEPLOYMENT_ID con el ID de la implementación 'Untitled' para actualizar la URL /exec sin cambiarla."
  echo "  npx @google/clasp deployments"
  npx @google/clasp deploy --description "Deploy $(date '+%Y-%m-%d %H:%M')"
fi

echo ""
echo "Listo. Verifica:"
echo "  Render: https://solicitud-lona-especializada-yaavs.onrender.com"
echo "  Sheets: ?action=list en SHEETS_WEBHOOK_URL"
