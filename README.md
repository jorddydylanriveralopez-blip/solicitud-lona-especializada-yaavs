# Solicitud de lona especializada · YAAVS

Formulario web a partir del brief de diseño y producción de lona especializada.

- Al capturar la **clave YAAVSER**, se completa automáticamente el **gerente territorial** (catálogo en `data/yaavsers.json`).
- Si la clave no existe en el catálogo, el gerente se puede capturar a mano.
- Si responde que **no** hay autorización gerencial, el formulario se detiene.

## Arrancar

```bash
cd "/Users/LBARRADAS/Desktop/Formularios Yaavs/Formulario 8 Lona Especializada"
npm install
npm start
```

- Formulario: http://localhost:3000  
- Resultados: http://localhost:3000/resultados  
- Export Excel: http://localhost:3000/api/export.xlsx  

## Catálogo clave → gerente

El archivo `data/yaavsers.json` se generó desde `Libro1_unificado.xlsx`.
Para actualizarlo, vuelve a exportar la base con columnas `ClaveUnica` y `Gerente` y regenera el JSON.
