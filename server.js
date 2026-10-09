const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const archiver = require("archiver");

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

function isAllowedUpload(file) {
  const mime = String(file?.mimetype || "").toLowerCase();
  const name = String(file?.originalname || "").toLowerCase();
  if (/^image\/(p?jpeg|jpg|png|webp|heic|heif)/.test(mime)) return true;
  if (mime === "application/pdf") return true;
  // Algunos celulares mandan la foto sin tipo, o como octet-stream.
  if (!mime || mime === "application/octet-stream") {
    return /\.(jpe?g|png|webp|heic|heif|pdf)$/.test(name);
  }
  return false;
}

function uploadErrorMessage(err) {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return "Una foto pesa más de 12 MB. Elige una más ligera o tómala de nuevo.";
  }
  if (err?.code === "LIMIT_FILE_COUNT" || err?.code === "LIMIT_UNEXPECTED_FILE") {
    return "Hay demasiados archivos en la solicitud.";
  }
  const msg = String(err?.message || "");
  if (/solo se permiten/i.test(msg)) {
    return "Solo se permiten fotos JPG, PNG, HEIC o un PDF.";
  }
  return msg || "No se pudo subir el archivo.";
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
    const ok = isAllowedUpload(file);
    cb(ok ? null : new Error("Solo se permiten JPG, PNG, HEIC o PDF"), ok);
  },
});

const FIELD_ORDER = [
  ["folio", "Folio"],
  ["receivedAt", "Fecha y hora"],
  ["material", "Material"],
  ["autorizada", "Autorizada por gerente"],
  ["gerenteTerritorial", "Gerente territorial"],
  ["gerenteTelefono", "Teléfono del gerente"],
  ["territorioGerente", "Gerente regional"],
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
  ["estadoProduccion", "Estado de producción"],
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
  estadoProduccion: 22,
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
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));

// Acceso al tablero. El repo es público: solo se guardan hashes scrypt ("salt:hash");
// en Render se pueden sustituir con BOARD_PASSWORD_MARKETING / BOARD_PASSWORD_ROTULACION / BOARD_PASSWORD_EJECUTIVO.
const BOARD_ROLES = {
  marketing: {
    label: "Marketing",
    seesAll: true,
    canDelete: true,
    envPassword: "BOARD_PASSWORD_MARKETING",
    hash: "f6e81b05c57f0ac3cf952436c015ccaf:204820d4156c6f638a5471588f47ae67c05631bb8d4c6c301126e6c3407b710b",
  },
  rotulacion: {
    label: "Dirección comercial · Rotulación",
    seesAll: false,
    canDelete: false,
    envPassword: "BOARD_PASSWORD_ROTULACION",
    hash: "027aa9c9b2e048233f0e322a4a106eae:f41028090bc1d6027308afc7c3fd952abf23268b3a3a619daed11e76b17b8a25",
  },
  ejecutivo: {
    label: "Ejecutivo de ventas · Rotulación",
    seesAll: false,
    canDelete: false,
    envPassword: "BOARD_PASSWORD_EJECUTIVO",
    hash: "102d46f591c1ec63ba75e79340bbda4f:9aaac3482ca9368c40f3d8bbe9660865de40322a708e7a79cb3c94eec5e2e55b",
  },
};
const PRODUCCION_ESTADOS = ["En diseño", "En proceso", "En revisión", "Terminado"];

function normalizeProduccionEstado(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "en diseño" || value === "en diseno") return "En diseño";
  if (value === "en proceso") return "En proceso";
  if (value === "en revisión" || value === "en revision") return "En revisión";
  if (value === "terminado") return "Terminado";
  return "";
}

const BOARD_COOKIE = "yaavs_board";
const BOARD_SESSION_DAYS = 30;
const BOARD_SESSION_SECRET = String(
  process.env.BOARD_SESSION_SECRET ||
    (SHEETS_WEBHOOK_URL
      ? crypto.createHash("sha256").update(`board-session:${SHEETS_WEBHOOK_URL}`).digest("hex")
      : crypto.randomBytes(32).toString("hex")),
);

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function passwordMatchesRole(password, role) {
  const plain = String(process.env[role.envPassword] || "");
  if (plain) return safeEqual(password, plain);
  const [salt, hash] = role.hash.split(":");
  const derived = crypto.scryptSync(String(password), salt, 32, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(derived, Buffer.from(hash, "hex"));
}

function roleForPassword(password) {
  if (!password) return null;
  for (const [key, role] of Object.entries(BOARD_ROLES)) {
    if (passwordMatchesRole(password, role)) return key;
  }
  return null;
}

function signSession(roleKey) {
  const exp = Date.now() + BOARD_SESSION_DAYS * 86400000;
  const payload = `${roleKey}.${exp}`;
  const sig = crypto.createHmac("sha256", BOARD_SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function readCookie(req, name) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return "";
}

function boardRoleKey(req) {
  const [roleKey, exp, sig] = readCookie(req, BOARD_COOKIE).split(".");
  if (!roleKey || !exp || !sig || !BOARD_ROLES[roleKey]) return null;
  if (!(Number(exp) > Date.now())) return null;
  const expected = crypto.createHmac("sha256", BOARD_SESSION_SECRET).update(`${roleKey}.${exp}`).digest("hex");
  return safeEqual(sig, expected) ? roleKey : null;
}

function boardRole(req) {
  const key = boardRoleKey(req);
  return key ? { key, ...BOARD_ROLES[key] } : null;
}

function requireBoard(req, res, next) {
  const role = boardRole(req);
  if (!role) return res.status(401).json({ ok: false, error: "Inicia sesión para ver el tablero" });
  req.boardRole = role;
  next();
}

function isRotulacionItem(item) {
  return String(item?.material || "").toLowerCase().includes("rotul");
}

function scopeItems(items, role) {
  return role?.seesAll ? items : (items || []).filter(isRotulacionItem);
}

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 10;

app.post("/api/login", (req, res) => {
  const ip = req.ip || "?";
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (rec && now - rec.first < LOGIN_WINDOW_MS && rec.fails >= LOGIN_MAX_FAILS) {
    return res.status(429).json({ ok: false, error: "Demasiados intentos. Espera unos minutos." });
  }
  const roleKey = roleForPassword(String(req.body?.password || ""));
  if (!roleKey) {
    const next = rec && now - rec.first < LOGIN_WINDOW_MS ? rec : { first: now, fails: 0 };
    next.fails += 1;
    loginAttempts.set(ip, next);
    return res.status(401).json({ ok: false, error: "Contraseña incorrecta" });
  }
  loginAttempts.delete(ip);
  res.setHeader(
    "Set-Cookie",
    `${BOARD_COOKIE}=${encodeURIComponent(signSession(roleKey))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
      BOARD_SESSION_DAYS * 86400
    }${req.secure ? "; Secure" : ""}`,
  );
  res.json({ ok: true, role: roleKey, label: BOARD_ROLES[roleKey].label });
});

app.post("/api/logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    `${BOARD_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${req.secure ? "; Secure" : ""}`,
  );
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const role = boardRole(req);
  if (!role) return res.status(401).json({ ok: false });
  res.json({ ok: true, role: role.key, label: role.label, seesAll: role.seesAll, canDelete: role.canDelete });
});

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

function nextFolio(material, knownItems) {
  const y = new Date().getFullYear().toString().slice(-2);
  // El disco de Render se borra en cada deploy: el consecutivo debe considerar también Sheets.
  let maxSeq = 0;
  for (const item of [...readResponses(), ...(knownItems || [])]) {
    const match = String(item?.folio || "").match(new RegExp(`-${y}-(\\d+)$`));
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]));
  }
  const n = Math.max(maxSeq, readResponses().length) + 1;
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
  const evidenciaTipo = String(detail.evidenciaTipo || answers.evidenciaTipo || "").toLowerCase();
  const isEsquina = evidenciaTipo.includes("esquina");
  fotoFiles.forEach((f, idx) => {
    const fromField = String(f.field || "");
    let label = "Foto de fachada";
    if (isEsquina) {
      if (fromField.includes("foto_2") || idx >= 1) label = "Foto del lateral derecho";
      else label = "Foto del lateral izquierdo";
    } else if (fromField.includes("foto_2") || idx >= 1) {
      label = "Foto de fachada 2";
    } else {
      label = "Foto frontal de fachada";
    }
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
  const attachments = [];
  for (const f of extractMedia(entry)) {
    const storedAs = f.storedAs || path.basename(String(f.url || ""));
    if (!storedAs) continue;
    const diskPath = path.join(uploadsRoot, entryId, storedAs);
    if (!fs.existsSync(diskPath)) continue;
    const stat = fs.statSync(diskPath);
    if (stat.size > MAX_UPLOAD_BYTES) {
      console.warn("Adjunto omitido por tamaño:", storedAs, stat.size);
      continue;
    }
    attachments.push({
      name: f.name || storedAs,
      mime: f.mime || "application/octet-stream",
      kind: f.kind || "archivo",
      group: f.group || "",
      label: f.label || "Archivo",
      storedAs,
      field: f.field || "",
      data: fs.readFileSync(diskPath).toString("base64"),
    });
  }
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

function normalize(body, knownItems) {
  const now = new Date().toISOString();
  const answers = body && typeof body.answers === "object" ? body.answers : body || {};
  const clean = { ...answers };
  delete clean.website;
  const id = body?.id || `lona_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const folio = body?.folio || clean.folio || nextFolio(clean.material, knownItems);
  clean.folio = folio;
  return {
    id,
    folio,
    receivedAt: body?.receivedAt || body?.timestamp || now,
    timestamp: body?.timestamp || now,
    answers: clean,
  };
}

function logLine(level, message, extra) {
  const row = {
    timestamp: new Date().toISOString(),
    level: String(level || "info"),
    message: String(message || ""),
  };
  if (extra && typeof extra === "object") {
    for (const [key, value] of Object.entries(extra)) {
      if (value == null) continue;
      row[key] = typeof value === "string" ? value.slice(0, 300) : value;
    }
  }
  console.log(JSON.stringify(row));
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
      signal: AbortSignal.timeout(90000),
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
  const attachments = buildAttachments(entry);

  // 1) Crear la fila primero (sin binarios) para no perder la solicitud.
  const basePayload = {
    ...flat,
    receivedAt: flat.receivedAt || entry.receivedAt,
    timestamp: entry.timestamp || flat.receivedAt,
    id: entry.id,
    folio: entry.folio,
    answers: entry.answers,
    media: [],
    attachments: [],
  };
  let result = await postToSheetsRaw(JSON.stringify(basePayload));
  if (!result.ok) {
    logLine("error", "Sheets append failed", {
      folio: entry.folio,
      status: result.status || "",
      error: result.error || JSON.stringify(result.body || {}).slice(0, 240),
    });
    return result;
  }

  // 2) Subir cada archivo a Drive de uno en uno y actualizar la fila.
  let uploaded = 0;
  for (const att of attachments) {
    let saved = false;
    for (let attempt = 1; attempt <= 3 && !saved; attempt += 1) {
      try {
        const one = await postToSheetsRaw(
          JSON.stringify({
            action: "addMedia",
            id: entry.id,
            folio: entry.folio,
            attachment: att,
          }),
        );
        const savedRows = Array.isArray(one.body?.saved)
          ? one.body.saved
          : one.body?.media || [];
        const savedToDrive = savedRows.some(
          (m) =>
            String(m?.url || "").includes("drive.google") &&
            String(m?.storedAs || "") === String(att.storedAs || ""),
        );
        if (one.ok && savedToDrive) {
          uploaded += 1;
          saved = true;
        } else if (attempt === 3) {
          logLine("warn", "Sheets addMedia failed", {
            folio: entry.folio,
            file: att.name,
            status: one.status || "",
            error: one.error || JSON.stringify(one.body || {}).slice(0, 240),
          });
        }
      } catch (err) {
        if (attempt === 3) {
          logLine("warn", "Sheets addMedia error", {
            folio: entry.folio,
            file: att.name,
            error: err?.message || String(err),
          });
        }
      }
      if (!saved && attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }

  invalidateSheetsCache();
  logLine("info", "Sheets forward done", {
    folio: entry.folio,
    mediaUploaded: uploaded,
    mediaTotal: attachments.length,
  });
  return { ok: true, mediaUploaded: uploaded, mediaTotal: attachments.length, body: result.body };
}

const RESYNC_MIN_AGE_MS = 5 * 60 * 1000;
let resyncRunning = false;

async function resyncMissingMedia() {
  if (!SHEETS_WEBHOOK_URL || resyncRunning) return;
  resyncRunning = true;
  try {
    invalidateSheetsCache({ hard: true });
    const sheets = await fetchSheetsItems();
    if (!sheets) return;
    const rowById = new Map(sheets.map((s) => [String(s.id || "").trim(), s]));
    const mediaKey = (m) => m?.storedAs || `${m?.name || ""}|${m?.group || ""}`;
    for (const entry of readResponses()) {
      const age = Date.now() - new Date(entry.receivedAt || 0).getTime();
      if (!(age > RESYNC_MIN_AGE_MS)) continue;
      const row = rowById.get(String(entry.id || "").trim());
      if (!row) continue;
      const inDrive = new Set(
        parseMediaField(row.media)
          .filter((m) => String(m?.url || "").includes("drive.google"))
          .map(mediaKey),
      );
      const pending = buildAttachments(entry).filter(
        (att) => !inDrive.has(att.storedAs) && !inDrive.has(`${att.name}|${att.group}`),
      );
      for (const att of pending) {
        const one = await postToSheetsRaw(
          JSON.stringify({ action: "addMedia", id: entry.id, folio: entry.folio, attachment: att }),
        );
        console.log("Resync media", entry.folio, att.name, one.ok ? "ok" : one.error || one.status);
      }
    }
    invalidateSheetsCache();
  } catch (err) {
    console.error("Resync media error:", err?.message || err);
  } finally {
    resyncRunning = false;
  }
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
// Apps Script tarda 5–20 s por lectura: se sirve la última copia y se refresca en segundo plano.
const SHEETS_LIST_CACHE_MS = 4000;
let sheetsListInFlight = null;
let sheetsCacheGen = 0;

function patchSheetEstado(id, folio, estado) {
  sheetsCacheGen += 1;
  sheetsListInFlight = null;
  if (!Array.isArray(sheetsListCache.items)) return;
  const wantedId = String(id || "").trim();
  const wantedFolio = String(folio || "").trim();
  sheetsListCache = {
    at: Date.now(),
    error: null,
    items: sheetsListCache.items.map((item) => {
      const sameId = wantedId && String(item.id || "").trim() === wantedId;
      const sameFolio = wantedFolio && String(item.folio || "").trim() === wantedFolio;
      if (!sameId && !sameFolio) return item;
      return { ...item, estadoProduccion: estado };
    }),
  };
}

function invalidateSheetsCache({ hard = false } = {}) {
  sheetsCacheGen += 1;
  sheetsListInFlight = null;
  sheetsListCache =
    hard || !sheetsListCache.items
      ? { at: 0, items: null, error: null }
      : { ...sheetsListCache, at: 1 };
}

function sheetsListUrl() {
  if (!SHEETS_WEBHOOK_URL) return "";
  const sep = SHEETS_WEBHOOK_URL.includes("?") ? "&" : "?";
  return `${SHEETS_WEBHOOK_URL}${sep}action=list`;
}

async function fetchSheetsItems() {
  if (!SHEETS_WEBHOOK_URL) return null;
  const cached = sheetsListCache;
  if (cached.items && Date.now() - cached.at < SHEETS_LIST_CACHE_MS) return cached.items;
  if (!sheetsListInFlight) {
    const pending = loadSheetsItems().finally(() => {
      if (sheetsListInFlight === pending) sheetsListInFlight = null;
    });
    sheetsListInFlight = pending;
  }
  if (cached.items && cached.at > 0) return cached.items;
  return sheetsListInFlight;
}

/** Folio sin bloquear el envío: usa la copia ya cargada y, si no hay, espera poco. */
async function sheetsItemsForSubmit() {
  if (!SHEETS_WEBHOOK_URL) return null;
  if (sheetsListCache.items) {
    if (Date.now() - sheetsListCache.at >= SHEETS_LIST_CACHE_MS) {
      fetchSheetsItems().catch(() => null);
    }
    return sheetsListCache.items;
  }
  return Promise.race([
    fetchSheetsItems().catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(sheetsListCache.items || null), 12000)),
  ]);
}

async function loadSheetsItems() {
  const now = Date.now();
  const gen = sheetsCacheGen;
  try {
    const res = await fetch(sheetsListUrl(), { redirect: "follow", signal: AbortSignal.timeout(45000) });
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
    if (gen === sheetsCacheGen) sheetsListCache = { at: now, items: data.items, error: null };
    return data.items;
  } catch (err) {
    console.error("Sheets list error:", err.message);
    if (gen === sheetsCacheGen) {
      sheetsListCache = { at: now, items: sheetsListCache.items, error: err.message };
    }
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
  // Copias en Drive anteriores a storedAs: emparejar con la local por nombre + grupo.
  const nameGroup = (f) => `${String(f?.name || "").toLowerCase()}|${String(f?.group || "").toLowerCase()}`;
  const replaced = new Set();
  for (const f of sheetMedia || []) {
    if (!f?.storedAs && String(f?.url || "").includes("drive.google")) {
      const idx = out.findIndex(
        (prev, i) =>
          !replaced.has(i) &&
          String(prev.url || "").startsWith("/uploads/") &&
          nameGroup(prev) === nameGroup(f),
      );
      if (idx >= 0) {
        out[idx] = { ...out[idx], url: f.url };
        replaced.add(idx);
        continue;
      }
    }
    upsert(f);
  }
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
      estadoProduccion:
        String(prev.estadoProduccion || "").trim() || String(item.estadoProduccion || "").trim(),
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

function mapsPinFromText(text) {
  let value = String(text || "");
  try {
    value = decodeURIComponent(value);
  } catch (_) {}
  const valid = (lat, lng) => {
    const a = Number(lat);
    const b = Number(lng);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
    return { lat: String(lat), lng: String(lng) };
  };
  // !3d/!4d es el pin del lugar. @lat,lng es solo el centro de la cámara y puede ser otra zona.
  const pins = [...value.matchAll(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/g)];
  if (pins.length) {
    const last = pins[pins.length - 1];
    const pin = valid(last[1], last[2]);
    if (pin) return pin;
  }
  const patterns = [
    /[?&](?:q|query|ll|center|destination)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /\/(?:place|search)\/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /(?:^|[^\d.-])(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)(?:[^\d.]|$)/,
  ];
  for (const re of patterns) {
    const match = value.match(re);
    if (!match) continue;
    const pin = valid(match[1], match[2]);
    if (pin) return pin;
  }
  return null;
}

function mapsCoordsFromText(text) {
  return mapsPinFromText(text);
}

function pinInMexico(pin) {
  if (!pin) return null;
  const lat = Number(pin.lat);
  const lng = Number(pin.lng);
  if (lat < 14.5 || lat > 32.8 || lng < -118.5 || lng > -86.5) return null;
  return pin;
}

function mapsQueryFromUrl(url) {
  try {
    const parsed = new URL(url);
    const q = parsed.searchParams.get("q") || parsed.searchParams.get("query") || "";
    if (q && !mapsCoordsFromText(q)) return q.replace(/\+/g, " ");
    const place = decodeURIComponent(parsed.pathname).match(/\/place\/([^/]+)/);
    if (place) return place[1].replace(/\+/g, " ");
  } catch (_) {}
  return "";
}

function isAllowedMapsUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  const pathName = parsed.pathname.toLowerCase();
  if (host === "maps.app.goo.gl" || host === "maps.google.com" || host === "share.google") return true;
  if (host === "goo.gl") return pathName.startsWith("/maps");
  return host.includes("google.") && pathName.startsWith("/maps");
}

app.get("/api/config", (_req, res) => {
  res.json({
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  });
});

app.get("/api/maps-resolve", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const raw = String(req.query.url || "").trim();
  if (!isAllowedMapsUrl(raw)) {
    return res.status(400).json({ ok: false, error: "Solo enlaces de Google Maps" });
  }
  try {
    const response = await fetch(raw, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; YaavsForm/1.0)",
        Accept: "text/html",
        "Accept-Language": "es-MX,es;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    const finalUrl = response.url || raw;
    if (!isAllowedMapsUrl(finalUrl) && !/google\./i.test(finalUrl)) {
      return res.status(400).json({ ok: false, error: "El enlace no llevó a Google Maps" });
    }
    let coords = pinInMexico(mapsPinFromText(finalUrl));
    if (!coords) {
      const html = await response.text().catch(() => "");
      coords = pinInMexico(mapsPinFromText(html.slice(0, 400000)));
    }
    return res.json({
      ok: true,
      url: finalUrl,
      lat: coords?.lat || "",
      lng: coords?.lng || "",
      query: mapsQueryFromUrl(finalUrl),
    });
  } catch (_) {
    return res.status(502).json({ ok: false, error: "No se pudo abrir el enlace de Maps" });
  }
});

const geocodeCache = new Map();

app.get("/api/maps-geocode", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const q = String(req.query.q || "").trim().slice(0, 180);
  if (q.length < 6) {
    return res.status(400).json({ ok: false, error: "Escribe una dirección más completa" });
  }
  const direct = pinInMexico(mapsPinFromText(q));
  if (direct) return res.json({ ok: true, lat: direct.lat, lng: direct.lng });

  const key = q.toLowerCase();
  if (geocodeCache.has(key)) return res.json(geocodeCache.get(key));

  let coords = null;
  try {
    const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    const response = await fetch(searchUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; YaavsForm/1.0)",
        Accept: "text/html",
        "Accept-Language": "es-MX,es;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    coords = pinInMexico(mapsPinFromText(response.url || ""));
  } catch (_) {}

  if (!coords) {
    try {
      const nom = new URL("https://nominatim.openstreetmap.org/search");
      nom.searchParams.set("q", q);
      nom.searchParams.set("format", "jsonv2");
      nom.searchParams.set("limit", "1");
      nom.searchParams.set("countrycodes", "mx");
      const response = await fetch(nom, {
        headers: {
          "User-Agent": "YaavsForm/1.0 (solicitudes especializadas)",
          "Accept-Language": "es",
        },
        signal: AbortSignal.timeout(8000),
      });
      const rows = await response.json();
      if (rows?.[0]?.lat && rows?.[0]?.lon) {
        coords = pinInMexico({ lat: String(rows[0].lat), lng: String(rows[0].lon) });
      }
    } catch (_) {}
  }

  if (!coords) {
    return res.status(404).json({ ok: false, error: "No se encontró el punto exacto" });
  }
  const payload = { ok: true, lat: coords.lat, lng: coords.lng };
  geocodeCache.set(key, payload);
  res.json(payload);
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

app.get("/api/responses", requireBoard, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const board = await boardItems();
  const items = scopeItems(board.items, req.boardRole);
  res.json({
    ok: true,
    items,
    total: items.length,
    source: board.source,
    sheetsConfigured: Boolean(SHEETS_WEBHOOK_URL),
    sheetsError: board.sheetsError || null,
    updatedAt: new Date().toISOString(),
  });
});

function driveDownloadUrl(url) {
  const id = String(url || "").match(/[?&]id=([\w-]+)/)?.[1];
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}

app.get("/api/responses/:id/archivos.zip", requireBoard, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const items = scopeItems((await boardItems()).items, req.boardRole);
    const item = items.find((it) => it.id === id || it.folio === id);
    if (!item) return res.status(404).json({ ok: false, error: "Solicitud no encontrada" });
    const media = (Array.isArray(item.media) ? item.media : []).filter((f) => f?.url);
    if (!media.length) return res.status(404).json({ ok: false, error: "Sin archivos" });

    const zipName = safeFilename(`${item.folio || id}_${item.puntoVenta || "archivos"}`) + ".zip";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
    const zip = archiver("zip", { zlib: { level: 1 } });
    zip.on("error", (err) => {
      console.error("Zip error:", err.message);
      res.destroy(err);
    });
    zip.pipe(res);

    const used = new Set();
    for (const [idx, file] of media.entries()) {
      let name = safeFilename(`${idx + 1}_${file.label || file.kind || "archivo"}_${file.name || "archivo"}`);
      while (used.has(name)) name = `x_${name}`;
      used.add(name);
      const url = String(file.url);
      if (url.startsWith("/uploads/")) {
        const diskPath = path.join(uploadsRoot, url.replace(/^\/uploads\//, ""));
        if (diskPath.startsWith(uploadsRoot) && fs.existsSync(diskPath)) {
          zip.file(diskPath, { name });
        }
        continue;
      }
      try {
        const r = await fetch(driveDownloadUrl(url), { redirect: "follow" });
        if (r.ok) zip.append(Buffer.from(await r.arrayBuffer()), { name });
        else console.warn("Zip: no se pudo bajar", url, r.status);
      } catch (err) {
        console.warn("Zip: error al bajar", url, err.message);
      }
    }
    await zip.finalize();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message || "Error al generar ZIP" });
  }
});

app.post("/api/responses/:id/estado", requireBoard, async (req, res) => {
  if (!req.boardRole.seesAll) {
    return res.status(403).json({ ok: false, error: "Solo Marketing puede cambiar el semáforo" });
  }
  const estado = normalizeProduccionEstado(req.body?.estado);
  if (!estado || !PRODUCCION_ESTADOS.includes(estado)) {
    return res.status(400).json({ ok: false, error: "Elige en diseño, en proceso, en revisión o terminado" });
  }
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "Falta el id de la solicitud" });

  const list = readResponses();
  let folio = "";
  let changedLocal = false;
  for (const entry of list) {
    if (entry.id !== id && entry.folio !== id) continue;
    folio = entry.folio || folio;
    entry.answers = entry.answers && typeof entry.answers === "object" ? entry.answers : {};
    entry.answers.estadoProduccion = estado;
    changedLocal = true;
  }
  if (changedLocal) writeResponses(list);

  const sheets = await fetchSheetsItems().catch(() => null);
  const row = (sheets || []).find((item) => item.id === id || item.folio === id);
  folio = folio || row?.folio || "";
  const previousEstado = String(row?.estadoProduccion || "");
  patchSheetEstado(id, folio, estado);

  const sheetsResult = await postToSheetsRaw(
    JSON.stringify({ action: "setEstado", id, folio, estado }),
  );
  if (!sheetsResult.ok || sheetsResult.body?.ok === false) {
    patchSheetEstado(id, folio, previousEstado);
    return res.status(502).json({
      ok: false,
      error: "No se pudo guardar el semáforo en el registro",
      sheets: sheetsResult,
    });
  }
  res.json({ ok: true, id, folio, estado, sheets: sheetsResult.body || { ok: true } });
});

app.delete("/api/responses/:id", requireBoard, async (req, res) => {
  if (!req.boardRole.canDelete) {
    return res.status(403).json({ ok: false, error: "Tu acceso no permite eliminar solicitudes" });
  }
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
    invalidateSheetsCache();
    if (Array.isArray(sheetsListCache.items)) {
      const byId = sheetsListCache.items.filter((it) => String(it.id || "") !== id);
      const folio = match?.folio || id;
      sheetsListCache.items =
        byId.length !== sheetsListCache.items.length
          ? byId
          : sheetsListCache.items.filter((it) => String(it.folio || "") !== folio);
    }

    res.json({
      ok: true,
      removedLocal: remaining.length !== before.length,
      sheets: sheetsResult,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || "Error al eliminar" });
  }
});

app.get("/api/export.xlsx", requireBoard, async (req, res) => {
  try {
    const items = scopeItems((await boardItems()).items, req.boardRole);
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

app.get("/api/export.csv", requireBoard, async (req, res) => {
  const items = scopeItems((await boardItems()).items, req.boardRole);
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
      return res.status(400).json({ ok: false, error: uploadErrorMessage(err) });
    }
    try {
      const body = parseSubmitBody(req);
      if (body.answers?.website) {
        return res.json({ ok: true, ignored: true });
      }
      const sheetItems = await sheetsItemsForSubmit();
      if (SHEETS_WEBHOOK_URL && !sheetItems && readResponses().length === 0) {
        return res.status(503).json({
          ok: false,
          error: "No pudimos conectar con el registro. Espera unos segundos e inténtalo de nuevo.",
        });
      }
      const entry = normalize(body, sheetItems);
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
      logLine("error", "Submit failed", { error: e?.message || String(e) });
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: "No se pudo guardar la solicitud" });
      }
    }
  });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get(["/resultados", "/resultados.html"], (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(publicDir, boardRole(req) ? "resultados.html" : "acceso.html"));
});

app.use("/uploads", requireBoard, (req, res, next) => {
  if (req.boardRole.seesAll) return next();
  const entryId = decodeURIComponent(req.path.split("/")[1] || "");
  const entry = readResponses().find((e) => e.id === entryId);
  if (entry && isRotulacionItem(entry.answers || entry)) return next();
  res.status(404).json({ ok: false, error: "Not found" });
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
  if (SHEETS_WEBHOOK_URL) {
    loadSheetsItems().catch((err) =>
      logLine("error", "Sheets prefetch failed", { error: err?.message || String(err) }),
    );
    setTimeout(resyncMissingMedia, 60 * 1000);
    setInterval(resyncMissingMedia, 10 * 60 * 1000);
  }
});
