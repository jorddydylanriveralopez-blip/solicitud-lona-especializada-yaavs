const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");

(() => {
  try {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, "utf8")
      .split(/\n/)
      .forEach((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) return;
        const key = m[1];
        let val = m[2];
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
      });
  } catch (_) {}
})();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
const dataDir = process.env.DATA_DIR
  ? path.resolve(String(process.env.DATA_DIR))
  : path.join(__dirname, "data");
const dataFile = path.join(dataDir, "responses.json");
const uploadsRoot = path.join(dataDir, "uploads");
const yaavsersFile = path.join(
  fs.existsSync(path.join(dataDir, "yaavsers.json"))
    ? dataDir
    : path.join(__dirname, "data"),
  "yaavsers.json",
);
const SHEETS_WEBHOOK_URL = String(process.env.SHEETS_WEBHOOK_URL || "").trim();
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 20;

function safeFilename(name) {
  const base = path.basename(String(name || "archivo"));
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "archivo";
}

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      const tmp = path.join(uploadsRoot, "_tmp");
      fs.mkdirSync(tmp, { recursive: true });
      cb(null, tmp);
    },
    filename(_req, file, cb) {
      cb(
        null,
        `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeFilename(file.originalname)}`,
      );
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_FILES },
  fileFilter(_req, file, cb) {
    const ok = /^(image\/(jpeg|png|jpg|webp)|application\/pdf)$/i.test(file.mimetype || "");
    cb(ok ? null : new Error("Solo se permiten JPG, PNG o PDF"), ok);
  },
});

const FIELD_ORDER = [
  ["folio", "Folio"],
  ["receivedAt", "Fecha y hora"],
  ["material", "Material"],
  ["autorizada", "Autorizada por gerente"],
  ["gerenteTerritorial", "Gerente que autorizó"],
  ["gerenteTelefono", "Teléfono del gerente"],
  ["territorioGerente", "Territorio"],
  ["ejecutivoNombre", "Ejecutivo de ventas"],
  ["ejecutivoTelefono", "Teléfono ejecutivo"],
  ["ejecutivoCorreo", "Correo ejecutivo"],
  ["yaavserNombre", "Nombre YAAVSER"],
  ["claveYaavser", "Clave YAAVSER"],
  ["yaavserTelefono", "Teléfono YAAVSER"],
  ["puntoVenta", "Punto de venta"],
  ["puntoVentaUbicacion", "Ubicación punto de venta"],
  ["puntoVentaUbicacionMaps", "Google Maps punto de venta"],
  ["tipoEstablecimiento", "Tipo de establecimiento"],
  ["tipoEstablecimientoOtro", "Tipo (otro)"],
  ["objetivoLona", "Objetivo"],
  ["cantidadLonas", "Cantidad de lonas"],
  ["lonas", "Especificaciones por lona"],
  ["cantidadToldos", "Cantidad de toldos"],
  ["toldos", "Especificaciones por toldo"],
  ["cantidadCaballetes", "Cantidad de caballetes"],
  ["caballetes", "Especificaciones por caballete"],
  ["rotulacion", "Especificaciones de rotulación"],
  ["confirmaciones", "Confirmaciones"],
  ["observacionesAdicionales", "Observaciones adicionales"],
  ["id", "ID interno"],
];

const COLUMN_WIDTHS = {
  folio: 16,
  receivedAt: 20,
  autorizada: 18,
  gerenteTerritorial: 28,
  gerenteTelefono: 16,
  territorioGerente: 24,
  ejecutivoNombre: 24,
  ejecutivoTelefono: 16,
  ejecutivoCorreo: 28,
  yaavserNombre: 24,
  claveYaavser: 18,
  yaavserTelefono: 16,
  puntoVenta: 24,
  puntoVentaUbicacion: 36,
  puntoVentaUbicacionMaps: 40,
  tipoEstablecimiento: 22,
  tipoEstablecimientoOtro: 18,
  objetivoLona: 36,
  cantidadLonas: 12,
  mismoDiseno: 16,
  lonas: 56,
  cantidadToldos: 12,
  toldos: 56,
  cantidadCaballetes: 14,
  caballetes: 56,
  rotulacion: 56,
  confirmaciones: 40,
  observacionesAdicionales: 40,
  id: 28,
};

let yaavserIndex = null;

function loadYaavsers() {
  if (yaavserIndex) return yaavserIndex;
  try {
    const raw = JSON.parse(fs.readFileSync(yaavsersFile, "utf8"));
    const byClave = raw.byClave || {};
    const map = new Map();
    for (const [k, v] of Object.entries(byClave)) {
      map.set(String(k).trim().toUpperCase(), v);
    }
    yaavserIndex = map;
  } catch (_) {
    yaavserIndex = new Map();
  }
  return yaavserIndex;
}

function normalizeClave(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[-–—].*$/, "");
}

function lookupYaavser(claveRaw) {
  const index = loadYaavsers();
  const full = String(claveRaw || "").trim().toUpperCase();
  const clave = normalizeClave(claveRaw);
  if (!clave) return null;
  if (index.has(full)) return index.get(full);
  if (index.has(clave)) return index.get(clave);
  for (const [k, v] of index.entries()) {
    if (k.startsWith(clave) || clave.startsWith(k)) return v;
  }
  return null;
}

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]", "utf8");
}

function readResponses() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeResponses(list) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), "utf8");
}

function nextFolio(material) {
  const n = readResponses().length + 1;
  const y = new Date().getFullYear().toString().slice(-2);
  const m = String(material || "").toLowerCase();
  let prefix = "LONA";
  if (m.startsWith("toldo")) prefix = "TOLDO";
  else if (m.includes("caballete")) prefix = "CABAL";
  else if (m.includes("rotul")) prefix = "ROTUL";
  return `${prefix}-${y}-${String(n).padStart(4, "0")}`;
}

function parseSubmitBody(req) {
  const body = { ...(req.body || {}) };
  if (typeof body.answers === "string") {
    try {
      body.answers = JSON.parse(body.answers);
    } catch (_) {
      body.answers = {};
    }
  }
  return body;
}

let saveFileSeq = 0;

function saveNamedFiles(entryId, fieldKey, files) {
  const dest = path.join(uploadsRoot, entryId);
  fs.mkdirSync(dest, { recursive: true });
  const out = [];
  for (const file of files || []) {
    if (file.fieldname !== fieldKey) continue;
    // Unique name per file: same originalname + same ms used to overwrite
    // other uploads (permiso/foto1/foto2) and show identical images in resultados.
    saveFileSeq += 1;
    const fname = [
      Date.now(),
      saveFileSeq,
      Math.random().toString(36).slice(2, 8),
      String(fieldKey || "file").replace(/[^\w-]+/g, "_").slice(0, 40),
      safeFilename(file.originalname),
    ].join("_");
    const target = path.join(dest, fname);
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.renameSync(file.path, target);
      } catch (_) {
        fs.copyFileSync(file.path, target);
        try {
          fs.unlinkSync(file.path);
        } catch (_) {}
      }
    } else if (file.buffer) fs.writeFileSync(target, file.buffer);
    else continue;
    out.push({
      name: file.originalname || fname,
      storedAs: fname,
      url: `/uploads/${entryId}/${fname}`,
      mime: file.mimetype || "application/octet-stream",
      size: file.size || 0,
      field: fieldKey,
    });
  }
  return out;
}

function attachItemFiles(entryId, items, prefix, files) {
  if (!Array.isArray(items)) return items;
  return items.map((item, idx) => {
    const i = idx + 1;
    const logoFiles = saveNamedFiles(entryId, `logo_${prefix}_${i}`, files);
    const referenciaFiles = saveNamedFiles(entryId, `referenciaFile_${prefix}_${i}`, files);
    return {
      ...item,
      logoFiles,
      referenciaFiles,
    };
  });
}

function extractMediaFromItems(items, labelKey) {
  const media = [];
  if (!Array.isArray(items)) return media;
  items.forEach((item, idx) => {
    const group = item[labelKey] || item.lona || item.toldo || item.caballete || `Item ${idx + 1}`;
    for (const f of item.logoFiles || []) {
      media.push({ ...f, kind: "logo", group, label: "Logotipo" });
    }
    for (const f of item.referenciaFiles || []) {
      media.push({ ...f, kind: "referencia", group, label: "Referencia de diseño" });
    }
  });
  return media;
}

function extractToldoPuntoVentaMedia(answers) {
  const media = [];
  const group = "Punto de venta";
  for (const f of answers.toldoFotoFile || []) {
    media.push({ ...f, kind: "foto", group, label: "Foto del punto de venta" });
  }
  return media;
}

function dedupeMedia(files) {
  const out = [];
  const seen = new Set();
  for (const f of files || []) {
    if (!f || !(f.url || f.storedAs || f.name)) continue;
    // Prefer real identity (path/url). Never collapse different uploads that
    // only share the same original filename.
    const key = String(f.storedAs || f.url || `${f.field || ""}|${f.name}|${f.size || ""}|${out.length}`)
      .trim()
      .toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function extractRotulacionMedia(answers) {
  const media = [];
  const detail =
    answers.rotulacion && typeof answers.rotulacion === "object" ? answers.rotulacion : {};
  const permisoFiles = dedupeMedia([
    ...(answers.rotulacionPermisoFile || []),
    ...(detail.permisoFiles || []),
  ]);
  const pvFiles = dedupeMedia([
    ...(answers.rotulacionFotoPvFile || []),
    ...(detail.fotoPvFiles || []),
  ]);
  const fotoFiles = dedupeMedia([
    ...(answers.rotulacionFotoFiles || []),
    ...(detail.fotoFiles || []),
  ]);

  for (const f of permisoFiles) {
    media.push({
      ...f,
      kind: "permiso",
      group: "Permisos gubernamentales",
      label: "Evidencia de permiso",
    });
  }
  for (const f of pvFiles) {
    media.push({
      ...f,
      kind: "foto",
      group: "Punto de venta",
      label: "Foto del punto de venta",
    });
  }
  fotoFiles.forEach((f, idx) => {
    const fromField = String(f.field || "");
    const label =
      fromField.includes("foto_2") || idx >= 1 ? "Foto de fachada 2" : "Foto de fachada";
    media.push({
      ...f,
      kind: "foto",
      group: "Fachada del punto de venta",
      label,
    });
  });
  return media;
}

function extractMedia(entry) {
  const answers = entry?.answers && typeof entry.answers === "object" ? entry.answers : {};
  return dedupeMedia([
    ...extractMediaFromItems(answers.lonas, "lona"),
    ...extractMediaFromItems(answers.toldos, "toldo"),
    ...extractMediaFromItems(answers.caballetes, "caballete"),
    ...extractToldoPuntoVentaMedia(answers),
    ...extractRotulacionMedia(answers),
  ]);
}

function parseMediaField(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw == null || raw === "") return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function buildAttachments(entry) {
  const entryId = entry?.id;
  if (!entryId) return [];
  const answers = entry.answers && typeof entry.answers === "object" ? entry.answers : {};
  const attachments = [];
  let totalBytes = 0;
  const maxTotal = 8 * 1024 * 1024;
  const maxFile = 4 * 1024 * 1024;

  const pushFiles = (files, kind, group, label) => {
    for (const f of files || []) {
      const storedAs = f.storedAs || path.basename(String(f.url || ""));
      if (!storedAs) continue;
      const diskPath = path.join(uploadsRoot, entryId, storedAs);
      if (!fs.existsSync(diskPath)) continue;
      const stat = fs.statSync(diskPath);
      if (stat.size > maxFile || totalBytes + stat.size > maxTotal) continue;
      totalBytes += stat.size;
      attachments.push({
        name: f.name || storedAs,
        mime: f.mime || "application/octet-stream",
        kind,
        group,
        label:
          label ||
          (kind === "logo"
            ? "Logotipo"
            : kind === "referencia"
              ? "Referencia de diseño"
              : kind === "permiso"
                ? "Evidencia de permiso"
                : kind === "foto"
                  ? "Foto del punto de venta"
                  : "Archivo"),
        data: fs.readFileSync(diskPath).toString("base64"),
      });
    }
  };

  for (const item of answers.lonas || []) {
    const group = item.lona || "Lona";
    pushFiles(item.logoFiles, "logo", group, "Logotipo");
    pushFiles(item.referenciaFiles, "referencia", group, "Referencia de diseño");
  }
  for (const item of answers.toldos || []) {
    const group = item.toldo || "Toldo";
    pushFiles(item.logoFiles, "logo", group, "Logotipo");
    pushFiles(item.referenciaFiles, "referencia", group, "Referencia de diseño");
  }
  for (const item of answers.caballetes || []) {
    const group = item.caballete || "Caballete";
    pushFiles(item.logoFiles, "logo", group, "Logotipo");
    pushFiles(item.referenciaFiles, "referencia", group, "Referencia de diseño");
  }
  pushFiles(answers.toldoFotoFile, "foto", "Punto de venta", "Foto del punto de venta");
  const rotDetail =
    answers.rotulacion && typeof answers.rotulacion === "object" ? answers.rotulacion : {};
  pushFiles(
    [...(answers.rotulacionPermisoFile || []), ...(rotDetail.permisoFiles || [])],
    "permiso",
    "Permisos gubernamentales",
    "Evidencia de permiso",
  );
  pushFiles(
    [...(answers.rotulacionFotoPvFile || []), ...(rotDetail.fotoPvFiles || [])],
    "foto",
    "Punto de venta",
    "Foto del punto de venta",
  );
  pushFiles(
    [...(answers.rotulacionFotoFiles || []), ...(rotDetail.fotoFiles || [])],
    "foto",
    "Fachada del punto de venta",
    "Foto de fachada",
  );
  return attachments;
}

function boardItemFromEntry(entry) {
  const flat = flatten(entry);
  const answers = entry.answers && typeof entry.answers === "object" ? entry.answers : {};
  return {
    ...flat,
    media: extractMedia(entry),
    lonasDetail: Array.isArray(answers.lonas) ? answers.lonas : null,
    toldosDetail: Array.isArray(answers.toldos) ? answers.toldos : null,
    caballetesDetail: Array.isArray(answers.caballetes) ? answers.caballetes : null,
    rotulacionDetail: answers.rotulacion && typeof answers.rotulacion === "object" ? answers.rotulacion : null,
  };
}

function enrichSheetItem(item) {
  const media = parseMediaField(item.media);
  let rotulacionDetail = null;
  if (item.rotulacion) {
    if (typeof item.rotulacion === "object") rotulacionDetail = item.rotulacion;
    else {
      try {
        const parsed = JSON.parse(item.rotulacion);
        if (parsed && typeof parsed === "object") rotulacionDetail = parsed;
      } catch (_) {}
    }
  }
  return {
    ...item,
    media,
    lonasDetail: null,
    toldosDetail: null,
    caballetesDetail: null,
    rotulacionDetail,
  };
}

function stringifyComplex(v) {
  if (v == null) return "";
  if (Array.isArray(v)) {
    return v
      .map((row) => {
        if (row && typeof row === "object") {
          return Object.entries(row)
            .map(([k, val]) => {
              if (Array.isArray(val)) {
                if (val.length && typeof val[0] === "object") {
                  return `${k}: ${val.map((f) => f.name || f.url || "").filter(Boolean).join(", ")}`;
                }
                return `${k}: ${val.join(", ")}`;
              }
              return `${k}: ${val}`;
            })
            .join(" | ");
        }
        return String(row);
      })
      .join(" || ");
  }
  if (typeof v === "object") {
    if (Array.isArray(v.files)) {
      return v.files.map((f) => f.name || f.url || "").filter(Boolean).join(", ");
    }
    return JSON.stringify(v);
  }
  return String(v);
}

function flatten(entry) {
  const a = entry.answers && typeof entry.answers === "object" ? entry.answers : {};
  const out = {
    id: entry.id || "",
    folio: entry.folio || a.folio || "",
    receivedAt: entry.receivedAt || entry.timestamp || "",
    timestamp: entry.timestamp || entry.receivedAt || "",
  };
  for (const [key] of FIELD_ORDER) {
    if (key === "receivedAt" || key === "id" || key === "folio") continue;
    const v = a[key];
    if (key === "lonas" || key === "toldos" || key === "caballetes" || key === "rotulacion") {
      out[key] = stringifyComplex(v);
    } else if (Array.isArray(v)) out[key] = v.join(", ");
    else if (v == null) out[key] = "";
    else out[key] = String(v);
  }
  return out;
}

function normalize(body) {
  const now = new Date().toISOString();
  const answers = body && typeof body.answers === "object" ? body.answers : body || {};
  const clean = { ...answers };
  delete clean.website;
  const id = body?.id || `lona_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const folio = body?.folio || clean.folio || nextFolio(clean.material);
  clean.folio = folio;
  return {
    id,
    folio,
    receivedAt: body?.receivedAt || body?.timestamp || now,
    timestamp: body?.timestamp || now,
    answers: clean,
  };
}

async function postToSheetsRaw(payload) {
  if (!SHEETS_WEBHOOK_URL) return { skipped: true };
  try {
    // Apps Script ejecuta doPost en el 1er hop y responde 302.
    // El cuerpo de respuesta se lee con GET en Location (POST ahí da 405).
    let res = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      redirect: "manual",
    });

    let text = "";
    let status = res.status;
    if (status >= 300 && status < 400) {
      const loc = res.headers.get("location");
      if (loc) {
        const follow = await fetch(loc, { method: "GET", redirect: "follow" });
        text = await follow.text().catch(() => "");
        status = follow.ok ? 200 : follow.status;
      } else {
        // Redirect sin Location: doPost ya corrió
        status = 200;
      }
    } else {
      text = await res.text().catch(() => "");
    }

    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_) {
      body = text ? { raw: text.slice(0, 200) } : null;
    }

    const ok = status >= 200 && status < 300;
    if (!ok) {
      console.error("Sheets webhook HTTP", status, text.slice(0, 300));
    }
    return { ok, status, body };
  } catch (err) {
    console.error("Sheets webhook error:", err.message);
    return { ok: false, error: err.message };
  }
}

async function forwardToSheets(entry) {
  if (!SHEETS_WEBHOOK_URL) return { skipped: true };
  const flat = flatten(entry);
  const localMedia = extractMedia(entry);

  const makePayload = (attachments) =>
    JSON.stringify({
      ...flat,
      receivedAt: flat.receivedAt || entry.receivedAt,
      timestamp: entry.timestamp || flat.receivedAt,
      id: entry.id,
      folio: entry.folio,
      answers: entry.answers,
      media: localMedia,
      attachments,
    });

  let attachments = buildAttachments(entry);
  let payload = makePayload(attachments);
  // Apps Script suele fallar con payloads muy grandes (varias fotos en base64).
  const maxBytes = 3.5 * 1024 * 1024;
  if (Buffer.byteLength(payload, "utf8") > maxBytes) {
    console.warn(
      "Sheets payload too large (%d bytes); reenviando sin binarios",
      Buffer.byteLength(payload, "utf8"),
    );
    attachments = [];
    payload = makePayload([]);
  }

  let result = await postToSheetsRaw(payload);
  if (!result.ok && attachments.length) {
    console.warn("Sheets webhook failed with attachments; retrying metadata-only");
    result = await postToSheetsRaw(makePayload([]));
  }
  if (result.ok) {
    sheetsListCache = { at: 0, items: null, error: null };
  } else {
    console.error("Sheets forward failed:", result.error || result.status, result.body);
  }
  return result;
}

async function deleteFromSheets(id, folio) {
  if (!SHEETS_WEBHOOK_URL) return { skipped: true };
  const payload = JSON.stringify({ action: "delete", id: id || "", folio: folio || "" });
  return postToSheetsRaw(payload);
}

function formatDateMx(iso) {
  const d = new Date(iso || "");
  if (Number.isNaN(d.getTime())) return String(iso || "");
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function sortedItems() {
  return readResponses()
    .map(boardItemFromEntry)
    .sort((a, b) => {
      const ta = new Date(a.receivedAt || a.timestamp || 0).getTime();
      const tb = new Date(b.receivedAt || b.timestamp || 0).getTime();
      return tb - ta;
    });
}

let sheetsListCache = { at: 0, items: null, error: null };
const SHEETS_LIST_CACHE_MS = 800;

function sheetsListUrl() {
  if (!SHEETS_WEBHOOK_URL) return "";
  const sep = SHEETS_WEBHOOK_URL.includes("?") ? "&" : "?";
  return `${SHEETS_WEBHOOK_URL}${sep}action=list`;
}

async function fetchSheetsItems() {
  if (!SHEETS_WEBHOOK_URL) return null;
  const now = Date.now();
  if (sheetsListCache.items && now - sheetsListCache.at < SHEETS_LIST_CACHE_MS) {
    return sheetsListCache.items;
  }
  try {
    const res = await fetch(sheetsListUrl(), { redirect: "follow" });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error(`Sheets list no-JSON (${res.status})`);
    }
    if (!data?.ok || !Array.isArray(data.items)) {
      throw new Error(data?.error || "Sheets list inválido");
    }
    sheetsListCache = { at: now, items: data.items, error: null };
    return data.items;
  } catch (err) {
    console.error("Sheets list error:", err.message);
    sheetsListCache = {
      at: now,
      items: sheetsListCache.items,
      error: err.message,
    };
    return sheetsListCache.items;
  }
}

function mergeMediaLists(localMedia, sheetMedia) {
  const out = [];
  const indexByKey = new Map();
  const keyOf = (f) => {
    if (f?.storedAs) return `stored:${String(f.storedAs).trim().toLowerCase()}`;
    if (f?.url) return `url:${String(f.url).trim().toLowerCase()}`;
    return "";
  };

  const upsert = (file) => {
    if (!file || !file.url) return;
    const key = keyOf(file);
    if (!key) {
      out.push(file);
      return;
    }
    if (indexByKey.has(key)) {
      const idx = indexByKey.get(key);
      const prev = out[idx] || {};
      const preferDrive =
        String(file.url).includes("drive.google") && !String(prev.url || "").includes("drive.google");
      out[idx] = {
        ...prev,
        ...file,
        url: preferDrive ? file.url : prev.url || file.url,
        label: prev.label || file.label,
        group: prev.group || file.group,
        kind: prev.kind || file.kind,
      };
      return;
    }
    indexByKey.set(key, out.length);
    out.push(file);
  };

  for (const f of localMedia || []) upsert(f);
  for (const f of sheetMedia || []) upsert(f);
  return out;
}

function mergeBoardItems(localItems, sheetsItems) {
  const map = new Map();
  const keyOf = (item) => {
    const id = String(item?.id || "").trim();
    const folio = String(item?.folio || "").trim();
    if (id) return `id:${id}`;
    if (folio) return `folio:${folio}`;
    return `row:${item?.receivedAt || ""}|${item?.claveYaavser || ""}|${item?.material || ""}`;
  };
  for (const item of sheetsItems || []) {
    map.set(keyOf(item), enrichSheetItem(item));
  }
  for (const item of localItems || []) {
    const k = keyOf(item);
    const prev = map.get(k) || {};
    const localMedia = Array.isArray(item.media) ? item.media : [];
    const sheetMedia = Array.isArray(prev.media) ? prev.media : [];
    const media = mergeMediaLists(localMedia, sheetMedia);
    map.set(k, {
      ...prev,
      ...item,
      media,
      lonasDetail: item.lonasDetail || prev.lonasDetail || null,
      toldosDetail: item.toldosDetail || prev.toldosDetail || null,
      caballetesDetail: item.caballetesDetail || prev.caballetesDetail || null,
      rotulacionDetail: item.rotulacionDetail || prev.rotulacionDetail || null,
    });
  }
  return [...map.values()].sort((a, b) => {
    const ta = new Date(a.receivedAt || a.timestamp || 0).getTime();
    const tb = new Date(b.receivedAt || b.timestamp || 0).getTime();
    return tb - ta;
  });
}

async function boardItems() {
  const local = sortedItems();
  const sheets = await fetchSheetsItems();
  if (!sheets) {
    return {
      items: local,
      source: "local",
      sheetsError: sheetsListCache.error || null,
    };
  }
  return {
    items: mergeBoardItems(local, sheets),
    source: "sheets+local",
    sheetsError: sheetsListCache.error || null,
  };
}

async function buildWorkbook(items) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "YAAVS";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Lonas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { key: "_n", width: 6 },
    ...FIELD_ORDER.map(([key]) => ({
      key,
      width: COLUMN_WIDTHS[key] || 22,
    })),
  ];

  const headerRow = sheet.addRow(["#", ...FIELD_ORDER.map(([, label]) => label)]);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B1F38" },
  };

  items.forEach((item, i) => {
    const row = { _n: i + 1 };
    for (const [key] of FIELD_ORDER) {
      let val = item[key];
      if (key === "receivedAt") val = formatDateMx(val);
      row[key] = val == null ? "" : val;
    }
    sheet.addRow(row);
  });

  return workbook;
}

app.get("/api/config", (_req, res) => {
  res.json({
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  });
});

app.get("/api/health", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const board = await boardItems();
  res.json({
    ok: true,
    yaavsers: loadYaavsers().size,
    responses: board.items.length,
    localResponses: readResponses().length,
    sheetsConfigured: Boolean(SHEETS_WEBHOOK_URL),
    source: board.source,
    dataDir,
  });
});

app.get("/api/yaavser/:clave", (req, res) => {
  const found = lookupYaavser(req.params.clave);
  if (!found) {
    return res.status(404).json({
      found: false,
      message: "No se encontró la clave en el catálogo. Puedes capturar el gerente manualmente.",
    });
  }
  res.json({
    found: true,
    clave: found.clave,
    nombre: found.nombre,
    gerente: found.gerente,
    coordinador: found.coordinador,
    director: found.director,
    municipio: found.municipio,
    estado: found.estado,
  });
});

app.get("/api/responses", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const board = await boardItems();
  res.json({
    ok: true,
    items: board.items,
    total: board.items.length,
    source: board.source,
    sheetsConfigured: Boolean(SHEETS_WEBHOOK_URL),
    sheetsError: board.sheetsError || null,
    updatedAt: new Date().toISOString(),
  });
});

app.delete("/api/responses/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "Falta el id de la solicitud" });

    const before = readResponses();
    const match = before.find((e) => e.id === id || e.folio === id);
    const remaining = before.filter((e) => e.id !== id && e.folio !== id);
    if (remaining.length !== before.length) {
      writeResponses(remaining);
      const entryId = match?.id;
      if (entryId) {
        const dir = path.join(uploadsRoot, entryId);
        fs.rm(dir, { recursive: true, force: true }, () => {});
      }
    }

    const sheetsResult = await deleteFromSheets(id, match?.folio || id);
    sheetsListCache = { at: 0, items: null, error: null };

    res.json({
      ok: true,
      removedLocal: remaining.length !== before.length,
      sheets: sheetsResult,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "Error al eliminar" });
  }
});

app.get("/api/export.xlsx", async (_req, res) => {
  try {
    const { items } = await boardItems();
    const wb = await buildWorkbook(items);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="solicitudes-lona-especializada.xlsx"',
    );
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo exportar" });
  }
});

app.get("/api/export.csv", async (_req, res) => {
  const { items } = await boardItems();
  const headers = ["#", ...FIELD_ORDER.map(([, label]) => label)];
  const keys = FIELD_ORDER.map(([key]) => key);
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(",")];
  items.forEach((item, i) => {
    const cols = [
      i + 1,
      ...keys.map((k) => (k === "receivedAt" ? formatDateMx(item[k]) : item[k] ?? "")),
    ];
    lines.push(cols.map(escape).join(","));
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="solicitudes-lona-especializada.csv"',
  );
  res.send("\uFEFF" + lines.join("\n"));
});

app.post("/api/submit", (req, res) => {
  upload.any()(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ ok: false, error: err.message || "Error al subir archivos" });
    }
    try {
      const body = parseSubmitBody(req);
      if (body.answers?.website) {
        return res.json({ ok: true, ignored: true });
      }
      const entry = normalize(body);
      const files = req.files || [];
      if (Array.isArray(entry.answers.lonas)) {
        entry.answers.lonas = attachItemFiles(entry.id, entry.answers.lonas, "lona", files);
      }
      if (Array.isArray(entry.answers.toldos)) {
        entry.answers.toldos = attachItemFiles(entry.id, entry.answers.toldos, "toldo", files);
      }
      if (Array.isArray(entry.answers.caballetes)) {
        entry.answers.caballetes = attachItemFiles(entry.id, entry.answers.caballetes, "caballete", files);
      }
      if (String(entry.answers.material || "").toLowerCase().includes("toldo")) {
        const fotoFiles = saveNamedFiles(entry.id, "toldo_foto", files);
        if (fotoFiles.length) entry.answers.toldoFotoFile = fotoFiles;
      }
      if (String(entry.answers.material || "").toLowerCase().includes("rotul")) {
        const permisoFiles = saveNamedFiles(entry.id, "rotulacion_permiso", files);
        const fotoPvFiles = saveNamedFiles(entry.id, "rotulacion_foto_pv", files);
        const foto1 = saveNamedFiles(entry.id, "rotulacion_foto_1", files);
        const foto2 = saveNamedFiles(entry.id, "rotulacion_foto_2", files);
        if (permisoFiles.length) entry.answers.rotulacionPermisoFile = permisoFiles;
        if (fotoPvFiles.length) entry.answers.rotulacionFotoPvFile = fotoPvFiles;
        const fotoFiles = [...foto1, ...foto2];
        if (fotoFiles.length) entry.answers.rotulacionFotoFiles = fotoFiles;
        if (entry.answers.rotulacion && typeof entry.answers.rotulacion === "object") {
          entry.answers.rotulacion = {
            ...entry.answers.rotulacion,
            permisoFiles,
            fotoPvFiles,
            fotoFiles,
          };
        }
      }

      const list = readResponses();
      list.push(entry);
      writeResponses(list);

      // Responder ya al formulario; el tablero (Sheets) se actualiza en paralelo
      res.json({
        ok: true,
        id: entry.id,
        folio: entry.folio,
        sheets: { queued: Boolean(SHEETS_WEBHOOK_URL) },
      });

      if (SHEETS_WEBHOOK_URL) {
        forwardToSheets(entry).catch((err) =>
          console.error("Sheets webhook error:", err?.message || err),
        );
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: "No se pudo guardar la solicitud" });
    }
  });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/resultados", (_req, res) => {
  res.sendFile(path.join(publicDir, "resultados.html"));
});

app.use(
  "/uploads",
  express.static(uploadsRoot, {
    fallthrough: false,
  }),
);

app.use(
  express.static(publicDir, {
    extensions: ["html"],
    etag: false,
    lastModified: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
      else if (filePath.endsWith(".css") || filePath.endsWith(".js")) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
    },
  }),
);

app.use((req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

ensureStore();
loadYaavsers();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Lona especializada YAAVS on http://0.0.0.0:${PORT}`);
  console.log(`Catálogo YAAVSER: ${loadYaavsers().size} claves`);
  console.log(`Data dir: ${dataDir}`);
  console.log(
    SHEETS_WEBHOOK_URL
      ? "Google Sheets webhook: configurado"
      : "Google Sheets webhook: pendiente (SHEETS_WEBHOOK_URL)",
  );
});
