# Deploy dual: Render + Apps Script

## Render (automático)

Cada `git push origin main` dispara el redeploy en Render.

URL: https://solicitud-lona-especializada-yaavs.onrender.com

## Apps Script (manual con clasp)

Proyecto: **Lonas y toldos**  
Implementación web: **Untitled** (la URL en `SHEETS_WEBHOOK_URL` de Render)

### Primera vez

```bash
npx @google/clasp login
```

### Después de cada cambio en `gas/Code.gs`

```bash
npm run deploy:gas
```

O todo junto (push + GAS si clasp está logueado):

```bash
npm run deploy:all
```

### Actualizar la misma URL /exec (recomendado)

1. Lista implementaciones: `npx @google/clasp deployments`
2. Copia el `deploymentId` de **Untitled**
3. Exporta y despliega:

```bash
export GAS_DEPLOYMENT_ID="tu-deployment-id"
npx @google/clasp push --force
npx @google/clasp deploy --deploymentId "$GAS_DEPLOYMENT_ID" --description "Deploy $(date '+%Y-%m-%d %H:%M')"
```

## Checklist por cambio

| Cambio en… | Render | Apps Script |
|------------|--------|-------------|
| `public/*`, `server.js` | `git push` | — |
| `gas/Code.gs` | — | `npm run deploy:gas` |
| Columnas Sheets / payload | ambos | ambos |

## Verificación

- `GET /api/health` → `ok`
- `GET /resultados` → tablero sin overlay bloqueado
- `SHEETS_WEBHOOK_URL?action=list` → JSON con `media`, `caballetes`, etc.
