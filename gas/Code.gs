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
  "Gerente territorial",
  "Teléfono del gerente",
  "Gerente regional",
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
  "Especificaciones de rotulación",
  "Observaciones adicionales",
  "Estado de producción",
  "Faltó agregar",
  "Evidencia de aviso",
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
  "cantidadLonas",
  "lonas",
  "cantidadToldos",
  "toldos",
  "confirmaciones",
  "id",
  "media",
  "cantidadCaballetes",
  "caballetes",
  "rotulacion",
  "observacionesAdicionales",
  "estadoProduccion",
  "faltanteCliente",
  "faltanteHistorial",
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
    if (data.action === "setFaltante") {
      var textoFalta = String(data.texto || "").trim();
      if (!textoFalta) return jsonOut_({ ok: false, error: "Escribe qué faltó agregar" });
      var updatedFalta = setFaltante_(
        data.id,
        data.folio,
        textoFalta.slice(0, 800),
        String(data.historial || "").slice(0, 20000),
      );
      return jsonOut_({ ok: updatedFalta > 0, updated: updatedFalta });
    }
    if (data.action === "setEstado") {
      var estado = normalizeEstado_(data.estado);
      if (!estado) return jsonOut_({ ok: false, error: "Estado no válido" });
      var updated = setEstado_(data.id, data.folio, estado);
      return jsonOut_({ ok: updated > 0, updated: updated, estado: estado });
    }
    if (data.action === "delete") {
      var deleted = deleteRows_(data.id, data.folio);
      return jsonOut_({ ok: true, deleted: deleted });
    }
    if (data.action === "resetAll") {
      var clearedRows = resetAllRows_();
      return jsonOut_({ ok: true, cleared: clearedRows });
    }
    if (data.action === "cleanupEmpty") {
      return jsonOut_({ ok: true, removed: cleanupEmptyRows_() });
    }
    if (data.action === "addMedia") {
      var added = saveAttachments_(
        data.attachment ? [data.attachment] : data.attachments || [],
        data.folio || data.id || "",
      );
      var mediaNow = appendMediaToRow_(data.id, data.folio, added);
      var merged = mediaNow.merged || [];
      var saved = mediaNow.saved || [];
      var failed = [];
      for (var ai = 0; ai < added.length; ai++) {
        if (added[ai] && added[ai].error) failed.push(added[ai].error);
      }
      return jsonOut_({
        ok: failed.length === 0 && saved.length > 0,
        added: saved.length,
        mediaCount: merged.length,
        media: merged,
        saved: saved,
        errors: failed,
      });
    }
    if (data.action) {
      return jsonOut_({ ok: false, error: "Acción desconocida: " + data.action });
    }
    if (!String(data.material || "").trim() && !String(data.puntoVenta || "").trim()) {
      return jsonOut_({ ok: false, error: "Solicitud vacía: no se agrega fila" });
    }
    var media = saveAttachments_(data.attachments || [], data.folio || data.id || "");
    if ((!media || !media.length) && data.media) {
      if (Object.prototype.toString.call(data.media) === "[object Array]") {
        media = data.media;
      } else {
        media = parseMedia_(data.media);
      }
    }
    // No guardar URLs locales de Render: se pierden al redeploy.
    media = (media || []).filter(function (m) {
      var url = String((m && m.url) || "");
      return url && url.indexOf("/uploads/") !== 0;
    });
    data.media = media;
    var sheet = ensureSheet_();
    sheet.appendRow(rowFromPayload_(data));
    return jsonOut_({ ok: true, appended: true, mediaCount: (data.media || []).length });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function deleteRows_(id, folio) {
  var wantedId = String(id || "").trim();
  var wantedFolio = String(folio || "").trim();
  if (!wantedId && !wantedFolio) return 0;

  var sheet = ensureSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var values = sheet.getRange(2, 1, lastRow, HEADERS.length).getValues();
  var rowsToDelete = matchRows_(values, wantedId, wantedFolio).map(function (r) {
    return r + 2;
  });
  rowsToDelete.sort(function (a, b) {
    return b - a;
  });
  for (var i = 0; i < rowsToDelete.length; i++) {
    sheet.deleteRow(rowsToDelete[i]);
  }
  return rowsToDelete.length;
}

function setupSheet() {
  ensureSheet_();
}

/** Ejecutar una vez desde el editor para autorizar Drive (fotos). */
function authorizeDrive() {
  var folder = attachmentsFolder_();
  return folder.getName() + " | id=" + folder.getId();
}

function resetAllRows_() {
  var sheet = ensureSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var count = lastRow - 1;
  sheet.deleteRows(2, count);
  return count;
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

function appendMediaToRow_(id, folio, newMedia) {
  var wantedId = String(id || "").trim();
  var wantedFolio = String(folio || "").trim();
  function pack_(merged, saved) {
    return { merged: merged || [], saved: saved || [] };
  }
  if ((!wantedId && !wantedFolio) || !newMedia || !newMedia.length) return pack_([], []);

  // Solo persistir entradas con URL de Drive (ignorar fallos).
  var valid = [];
  for (var i = 0; i < newMedia.length; i++) {
    if (newMedia[i] && newMedia[i].url) valid.push(newMedia[i]);
  }
  if (!valid.length) return pack_([], []);

  var sheet = ensureSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return pack_(valid, valid);

  var mediaCol = KEYS.indexOf("media");
  var materialCol = KEYS.indexOf("material");
  if (mediaCol < 0) return pack_(valid, valid);

  var values = sheet.getRange(2, 1, lastRow, HEADERS.length).getValues();
  var matches = matchRows_(values, wantedId, wantedFolio).filter(function (r) {
    return materialCol < 0 || String(values[r][materialCol] || "").trim() !== "";
  });
  if (!matches.length) return pack_(valid, valid);
  var row = matches[0];
  var existing = parseMedia_(values[row][mediaCol]);
  var seen = {};
  var merged = [];
  function mediaKey_(file) {
    if (!file) return "";
    if (file.storedAs) return "s:" + String(file.storedAs);
    var url = String(file.url || "");
    var match = url.match(/[?&]id=([\w-]+)/);
    if (match) return "d:" + match[1];
    return "u:" + url;
  }
  function pushUnique_(file) {
    var key = mediaKey_(file);
    if (!key || seen[key]) return false;
    seen[key] = true;
    merged.push(file);
    return true;
  }
  for (var e = 0; e < existing.length; e++) pushUnique_(existing[e]);
  var saved = [];
  for (var n = 0; n < valid.length; n++) {
    var key = mediaKey_(valid[n]);
    var already = false;
    for (var m = 0; m < merged.length; m++) {
      if (mediaKey_(merged[m]) === key) {
        saved.push(merged[m]);
        already = true;
        break;
      }
    }
    if (!already && pushUnique_(valid[n])) saved.push(valid[n]);
  }
  sheet.getRange(row + 2, mediaCol + 1).setValue(JSON.stringify(merged));
  return pack_(merged, saved);
}

/** Filas por id; el folio solo se usa si no hay id que coincida (los folios pueden repetirse). */
function matchRows_(values, wantedId, wantedFolio) {
  var idCol = KEYS.indexOf("id");
  var folioCol = KEYS.indexOf("folio");
  var byId = [];
  var byFolio = [];
  for (var r = 0; r < values.length; r++) {
    var rowId = idCol >= 0 ? String(values[r][idCol] || "").trim() : "";
    var rowFolio = folioCol >= 0 ? String(values[r][folioCol] || "").trim() : "";
    if (wantedId && rowId === wantedId) byId.push(r);
    else if (wantedFolio && rowFolio === wantedFolio) byFolio.push(r);
  }
  return byId.length ? byId : byFolio;
}

/** Borra filas sin material ni punto de venta (creadas por versiones viejas al subir fotos). */
function cleanupEmptyRows_() {
  var sheet = ensureSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var materialCol = KEYS.indexOf("material");
  var pvCol = KEYS.indexOf("puntoVenta");
  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var removed = 0;
  for (var r = values.length - 1; r >= 0; r--) {
    var material = String(values[r][materialCol] || "").trim();
    var pv = String(values[r][pvCol] || "").trim();
    if (!material && !pv) {
      sheet.deleteRow(r + 2);
      removed++;
    }
  }
  return removed;
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
        storedAs: att.storedAs || "",
        field: att.field || "",
        kind: att.kind || "archivo",
        group: att.group || "",
        label:
          att.label ||
          (att.kind === "logo"
            ? "Logotipo"
            : att.kind === "referencia"
              ? "Referencia"
              : att.kind === "foto"
                ? "Foto del punto de venta"
                : att.kind === "permiso"
                  ? "Evidencia de permiso"
                  : "Archivo"),
      });
    } catch (err) {
      // Devolver el error para diagnosticar (p. ej. permisos de Drive).
      out.push({
        name: att.name || "archivo",
        mime: att.mime || "application/octet-stream",
        kind: att.kind || "archivo",
        group: att.group || "",
        label: att.label || "Archivo",
        error: String(err),
        url: "",
      });
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
    pick_(data, "cantidadLonas"),
    asText_(pick_(data, "lonas")),
    pick_(data, "cantidadToldos"),
    asText_(pick_(data, "toldos")),
    asText_(pick_(data, "confirmaciones")),
    pick_(data, "id"),
    media.length ? JSON.stringify(media) : "",
    pick_(data, "cantidadCaballetes"),
    asText_(pick_(data, "caballetes")),
    asText_(pick_(data, "rotulacion")),
    pick_(data, "observacionesAdicionales"),
    normalizeEstado_(pick_(data, "estadoProduccion")),
    pick_(data, "faltanteCliente"),
    pick_(data, "faltanteHistorial"),
  ];
}

function normalizeEstado_(raw) {
  var value = String(raw || "").trim().toLowerCase();
  if (value === "en diseño" || value === "en diseno") return "En diseño";
  if (value === "en proceso") return "En proceso";
  if (value === "en revisión" || value === "en revision") return "En revisión";
  if (value === "terminado") return "Terminado";
  return "";
}

function setFaltante_(id, folio, texto, historial) {
  var wantedId = String(id || "").trim();
  var wantedFolio = String(folio || "").trim();
  if (!wantedId && !wantedFolio) return 0;
  var sheet = ensureSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var textoCol = KEYS.indexOf("faltanteCliente");
  var histCol = KEYS.indexOf("faltanteHistorial");
  if (textoCol < 0 || histCol < 0) return 0;
  var values = sheet.getRange(2, 1, lastRow, HEADERS.length).getValues();
  var matches = matchRows_(values, wantedId, wantedFolio);
  if (!matches.length) return 0;
  for (var i = 0; i < matches.length; i++) {
    sheet.getRange(matches[i] + 2, textoCol + 1).setValue(texto);
    sheet.getRange(matches[i] + 2, histCol + 1).setValue(historial);
  }
  return matches.length;
}

function setEstado_(id, folio, estado) {
  var wantedId = String(id || "").trim();
  var wantedFolio = String(folio || "").trim();
  if (!wantedId && !wantedFolio) return 0;
  var sheet = ensureSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var estadoCol = KEYS.indexOf("estadoProduccion");
  if (estadoCol < 0) return 0;
  var values = sheet.getRange(2, 1, lastRow, HEADERS.length).getValues();
  var matches = matchRows_(values, wantedId, wantedFolio);
  if (!matches.length) return 0;
  for (var i = 0; i < matches.length; i++) {
    sheet.getRange(matches[i] + 2, estadoCol + 1).setValue(estado);
  }
  return matches.length;
}
