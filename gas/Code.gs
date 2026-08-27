/**
 * Lona / Toldo especializada YAAVS → Google Sheets (tablero en vivo)
 *
 * SETUP (una sola vez):
 * 1. Abre https://sheets.new y renombra a
 *    "Solicitudes Lona / Toldo YAAVS — Respuestas"
 * 2. Extensiones → Apps Script → pega este código → Guardar
 * 3. Ejecuta setupSheet() una vez (Ejecutar)
 * 4. Implementar → Nueva implementación → Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquiera
 * 5. Copia la URL (.../exec)
 * 6. En Render → Environment:
 *    SHEETS_WEBHOOK_URL=<esa URL>
 * 7. Redeploy / Manual Deploy
 *
 * Si actualizas este código: Implementar → Administrar implementaciones
 * → Editar (lápiz) → Versión: Nueva versión → Implementar
 */

var SHEET_NAME = "Respuestas Lona Toldo";

var HEADERS = [
  "Fecha y hora",
  "Folio",
  "Material",
  "Autorizada por gerente",
  "Gerente que autorizó",
  "Teléfono del gerente",
  "Territorio",
  "Ejecutivo de ventas",
  "Teléfono ejecutivo",
  "Correo ejecutivo",
  "Nombre YAAVSER",
  "Clave YAAVSER",
  "Teléfono YAAVSER",
  "Punto de venta",
  "Tipo de establecimiento",
  "Tipo (otro)",
  "Objetivo",
  "Resultado esperado",
  "Servicios actuales",
  "Cantidad de lonas",
  "Especificaciones por lona",
  "Cantidad de toldos",
  "Especificaciones por toldo",
  "Confirmaciones",
  "ID interno",
];

var KEYS = [
  "receivedAt",
  "folio",
  "material",
  "autorizada",
  "gerenteTerritorial",
  "gerenteTelefono",
  "territorioGerente",
  "ejecutivoNombre",
  "ejecutivoTelefono",
  "ejecutivoCorreo",
  "yaavserNombre",
  "claveYaavser",
  "yaavserTelefono",
  "puntoVenta",
  "tipoEstablecimiento",
  "tipoEstablecimientoOtro",
  "objetivoLona",
  "resultadoEsperado",
  "serviciosActuales",
  "cantidadLonas",
  "lonas",
  "cantidadToldos",
  "toldos",
  "confirmaciones",
  "id",
];

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "";
    if (action === "list") {
      return jsonOut_({
        ok: true,
        source: "sheets",
        items: listItems_(),
        sheet: SHEET_NAME,
      });
    }
    return jsonOut_({
      ok: true,
      service: "Lona / Toldo especializada YAAVS",
      sheet: SHEET_NAME,
      list: "?action=list",
    });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "{}";
    var data = JSON.parse(raw);
    var sheet = ensureSheet_();
    sheet.appendRow(rowFromPayload_(data));
    return jsonOut_({ ok: true, appended: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function setupSheet() {
  ensureSheet_();
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function ensureSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, Math.min(12, HEADERS.length));
  }
  return sheet;
}

function listItems_() {
  var sheet = ensureSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow, HEADERS.length).getDisplayValues();
  var items = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var item = {};
    var empty = true;
    for (var c = 0; c < KEYS.length; c++) {
      var val = row[c];
      if (val != null && String(val).trim() !== "") empty = false;
      item[KEYS[c]] = val == null ? "" : String(val);
    }
    if (empty) continue;
    if (!item.id) item.id = item.folio || "sheet_" + (r + 2);
    items.push(item);
  }
  items.sort(function (a, b) {
    return String(b.receivedAt || "").localeCompare(String(a.receivedAt || ""));
  });
  return items;
}

function asText_(v) {
  if (v == null) return "";
  if (Object.prototype.toString.call(v) === "[object Array]") return v.join(", ");
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch (err) {
      return String(v);
    }
  }
  return String(v);
}

function pick_(data, key) {
  if (data[key] != null && data[key] !== "") return data[key];
  if (data.answers && data.answers[key] != null && data.answers[key] !== "") {
    return data.answers[key];
  }
  return "";
}

function rowFromPayload_(data) {
  return [
    pick_(data, "receivedAt") || pick_(data, "timestamp") || new Date().toISOString(),
    pick_(data, "folio"),
    pick_(data, "material"),
    pick_(data, "autorizada"),
    pick_(data, "gerenteTerritorial"),
    pick_(data, "gerenteTelefono"),
    pick_(data, "territorioGerente"),
    pick_(data, "ejecutivoNombre"),
    pick_(data, "ejecutivoTelefono"),
    pick_(data, "ejecutivoCorreo"),
    pick_(data, "yaavserNombre"),
    pick_(data, "claveYaavser"),
    pick_(data, "yaavserTelefono"),
    pick_(data, "puntoVenta"),
    asText_(pick_(data, "tipoEstablecimiento")),
    pick_(data, "tipoEstablecimientoOtro"),
    asText_(pick_(data, "objetivoLona")),
    asText_(pick_(data, "resultadoEsperado")),
    asText_(pick_(data, "serviciosActuales")),
    pick_(data, "cantidadLonas"),
    asText_(pick_(data, "lonas")),
    pick_(data, "cantidadToldos"),
    asText_(pick_(data, "toldos")),
    asText_(pick_(data, "confirmaciones")),
    pick_(data, "id"),
  ];
}
