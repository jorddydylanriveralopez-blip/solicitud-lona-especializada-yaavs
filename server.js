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
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "responses.json");
const uploadsRoot = path.join(dataDir, "uploads");
const yaavsersFile = path.join(dataDir, "yaavsers.json");
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
  ["autorizada", "Autorizada por gerente"],
  ["gerenteTerritorial", "Gerente territorial"],
  ["ejecutivoNombre", "Ejecutivo de ventas"],
  ["ejecutivoTelefono", "Teléfono ejecutivo"],
  ["ejecutivoCorreo", "Correo ejecutivo"],
  ["yaavserNombre", "Nombre YAAVSER"],
  ["claveYaavser", "Clave YAAVSER"],
  ["yaavserTelefono", "Teléfono YAAVSER"],
  ["puntoVenta", "Punto de venta"],
  ["tipoEstablecimiento", "Tipo de establecimiento"],
  ["tipoEstablecimientoOtro", "Tipo (otro)"],
  ["objetivoLona", "Objetivo de la lona"],
  ["resultadoEsperado", "Resultado esperado"],
  ["serviciosActuales", "Servicios actuales"],
  ["cantidadLonas", "Cantidad de lonas"],
  ["mismoDiseno", "¿Mismo diseño y medidas?"],
  ["lonas", "Especificaciones por lona"],
  ["marcas", "Marcas"],
  ["textoPrincipal", "Texto principal"],
  ["datosContactoOpciones", "Datos de contacto (opciones)"],
  ["datosContactoDetalle", "Datos de contacto (detalle)"],
  ["tieneReferencia", "¿Diseño de referencia?"],
  ["logoFiles", "Logotipo"],
  ["referenciaFiles", "Referencia"],
  ["confirmaciones", "Confirmaciones"],
  ["id", "ID interno"],
];

const COLUMN_WIDTHS = {
  folio: 16,
  receivedAt: 20,
  autorizada: 18,
  gerenteTerritorial: 28,
  ejecutivoNombre: 24,
  ejecutivoTelefono: 16,
  ejecutivoCorreo: 28,
  yaavserNombre: 24,
  claveYaavser: 18,
  yaavserTelefono: 16,
  puntoVenta: 24,
  tipoEstablecimiento: 22,
  tipoEstablecimientoOtro: 18,
  objetivoLona: 36,
  resultadoEsperado: 36,
  serviciosActuales: 36,
  cantidadLonas: 12,
  mismoDiseno: 16,
  lonas: 48,
  marcas: 24,
  textoPrincipal: 36,
  datosContactoOpciones: 24,
  datosContactoDetalle: 36,
  tieneReferencia: 16,
  logoFiles: 28,
  referenciaFiles: 28,
  confirmaciones: 40,
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

function nextFolio() {
  const n = readResponses().length + 1;
  const y = new Date().getFullYear().toString().slice(-2);
  return `LONA-${y}-${String(n).padStart(4, "0")}`;
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

function saveNamedFiles(entryId, fieldKey, files) {
  const dest = path.join(uploadsRoot, entryId);
  fs.mkdirSync(dest, { recursive: true });
  const out = [];
  for (const file of files || []) {
    if (file.fieldname !== fieldKey) continue;
    const fname = `${Date.now()}_${safeFilename(file.originalname)}`;
    const target = path.join(dest, fname);
    if (file.path && fs.existsSync(file.path)) fs.renameSync(file.path, target);
    else if (file.buffer) fs.writeFileSync(target, file.buffer);
    else continue;
    out.push({
      name: file.originalname || fname,
      storedAs: fname,
      url: `/uploads/${entryId}/${fname}`,
      mime: file.mimetype || "application/octet-stream",
      size: file.size || 0,
    });
  }
  return out;
}

function stringifyComplex(v) {
  if (v == null) return "";
  if (Array.isArray(v)) {
    return v
      .map((row) => {
        if (row && typeof row === "object") {
          return Object.entries(row)
            .map(([k, val]) => `${k}: ${Array.isArray(val) ? val.join(", ") : val}`)
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
    if (key === "lonas" || key === "logoFiles" || key === "referenciaFiles") {
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
  const folio = body?.folio || clean.folio || nextFolio();
  clean.folio = folio;
  return {
    id,
    folio,
    receivedAt: body?.receivedAt || body?.timestamp || now,
    timestamp: body?.timestamp || now,
    answers: clean,
  };
}

async function forwardToSheets(entry) {
  if (!SHEETS_WEBHOOK_URL) return { skipped: true };
  try {
    const flat = flatten(entry);
    const res = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...flat, answers: entry.answers }),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error("Sheets webhook error:", err.message);
    return { ok: false, error: err.message };
  }
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
    .map(flatten)
    .sort((a, b) => {
      const ta = new Date(a.receivedAt || a.timestamp || 0).getTime();
      const tb = new Date(b.receivedAt || b.timestamp || 0).getTime();
      return tb - ta;
    });
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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, yaavsers: loadYaavsers().size });
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

app.get("/api/responses", (_req, res) => {
  res.json({ items: sortedItems(), total: readResponses().length });
});

app.get("/api/export.xlsx", async (_req, res) => {
  try {
    const items = sortedItems();
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

app.get("/api/export.csv", (_req, res) => {
  const items = sortedItems();
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
      entry.answers.logoFiles = saveNamedFiles(entry.id, "logo", files);
      entry.answers.referenciaFiles = saveNamedFiles(entry.id, "referencia", files);

      const list = readResponses();
      list.push(entry);
      writeResponses(list);
      const sheets = await forwardToSheets(entry);
      res.json({
        ok: true,
        id: entry.id,
        folio: entry.folio,
        sheets,
      });
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
});
