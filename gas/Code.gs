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
  "Ubicación punto de venta",
  "Google Maps punto de venta",
  "Tipo de establecimiento",
  "Tipo (otro)",
  "Objetivo",
  "Cantidad de lonas",
  "Especificaciones por lona",
  "Cantidad de toldos",
  "Especificaciones por toldo",
  "Confirmaciones",
  "ID interno",
  "Archivos adjuntos",
  "Cantidad de caballetes",
  "Especificaciones por caballete",
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
  "puntoVentaUbicacion",
  "puntoVentaUbicacionMaps",
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
  "media",
  "cantidadCaballetes",
  "caballetes",
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
    var media = saveAttachments_(data.attachments || [], data.folio || data.id || "");
    data.media = media;
    var sheet = ensureSheet_();
    sheet.appendRow(rowFromPayload_(data));
    return jsonOut_({ ok: true, appended: true, mediaCount: media.length });
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
  } else {
    var headerRow = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRow.setValues([HEADERS]);
    headerRow.setFontWeight("bold");
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
    item.media = parseMedia_(item.media);
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

function parseMedia_(raw) {
  if (!raw) return [];
  if (Object.prototype.toString.call(raw) === "[object Array]") return raw;
  try {
    var parsed = JSON.parse(String(raw));
    return Object.prototype.toString.call(parsed) === "[object Array]" ? parsed : [];
  } catch (err) {
    return [];
  }
}

function attachmentsFolder_() {
  var name = "YAAVS Lona Toldo Archivos";
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function saveAttachments_(attachments, label) {
  if (!attachments || !attachments.length) return [];
  var folder = attachmentsFolder_();
  var out = [];
  for (var i = 0; i < attachments.length; i++) {
    var att = attachments[i];
    if (!att || !att.data) continue;
    try {
      var blob = Utilities.newBlob(
        Utilities.base64Decode(att.data),
        att.mime || "application/octet-stream",
        att.name || "archivo",
      );
      var safeLabel = String(label || "solicitud").replace(/[^\w\-]+/g, "_").slice(0, 40);
      var file = folder.createFile(blob);
      file.setName(safeLabel + "_" + (att.name || file.getName()));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      out.push({
        name: att.name || file.getName(),
        mime: att.mime || blob.getContentType(),
        url: "https://drive.google.com/uc?export=view&id=" + file.getId(),
        kind: att.kind || "archivo",
        group: att.group || "",
        label: att.kind === "logo" ? "Logotipo" : att.kind === "referencia" ? "Referencia" : "Archivo",
      });
    } catch (err) {
      // omitir adjunto fallido
    }
  }
  return out;
}

function rowFromPayload_(data) {
  var media = data.media || [];
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
    pick_(data, "puntoVentaUbicacion"),
    pick_(data, "puntoVentaUbicacionMaps"),
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
    media.length ? JSON.stringify(media) : "",
    pick_(data, "cantidadCaballetes"),
    asText_(pick_(data, "caballetes")),
  ];
}
