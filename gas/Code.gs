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

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      service: "Lona / Toldo especializada YAAVS",
      sheet: SHEET_NAME,
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "{}";
    var data = JSON.parse(raw);
    var sheet = ensureSheet_();
    sheet.appendRow(rowFromPayload_(data));
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, appended: true }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function setupSheet() {
  ensureSheet_();
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
