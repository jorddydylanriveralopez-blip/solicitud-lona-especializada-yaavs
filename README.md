# Solicitud de lona especializada · YAAVS

Formulario web a partir del brief de diseño y producción de lona especializada.

## Arrancar

```bash
cd "/Users/LBARRADAS/Desktop/Formularios Yaavs/Formulario 8 Lona Especializada"
npm install
npm start
```

- Formulario: http://localhost:3000  
- Resultados (tablero en vivo): http://localhost:3000/resultados  
- Export Excel: http://localhost:3000/api/export.xlsx  

## Tablero en tiempo real

1. Panel web: `/resultados` se refresca solo cada 2 segundos.
2. Google Sheets (recomendado en Render):
   - Copia `gas/Code.gs` a Apps Script de una hoja nueva
   - Ejecuta `setupSheet()`
   - Publica como aplicación web (acceso: Cualquiera)
   - En Render → Environment agrega `SHEETS_WEBHOOK_URL` con la URL `/exec`
   - Redeploy

En el plan free de Render el disco se reinicia al redeploy/sleep. Para no perder datos:
- configura Sheets, o
- monta un disco y define `DATA_DIR=/var/data`
