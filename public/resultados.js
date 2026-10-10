(() => {
  const statsEl = document.getElementById("stats");
  const listEl = document.getElementById("requestList");
  const detailEl = document.getElementById("detail");
  const liveStatus = document.getElementById("liveStatus");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const lightboxClose = document.getElementById("lightboxClose");
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");
  const lightboxDownload = document.getElementById("lightboxDownload");

  let items = [];
  let index = 0;
  let lastTotal = -1;
  let sheetsConfigured = false;
  let lightboxMedia = [];
  let lightboxIndex = 0;
  let materialFilter = "all";
  let productoUploadBusy = false;
  let statusFilter = "all";
  let lastFingerprint = null;
  let refreshInFlight = false;
  let session = null;

  const ESTADOS = [
    { key: "En diseño", tone: "diseno" },
    { key: "En proceso", tone: "proceso" },
    { key: "En revisión", tone: "revision" },
    { key: "Terminado", tone: "terminado" },
  ];
  const ESTADO_RANK = {
    "En diseño": 1,
    "En proceso": 2,
    "En revisión": 3,
    Terminado: 4,
  };

  function normalizeEstado(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (value === "en diseño" || value === "en diseno") return "En diseño";
    if (value === "en proceso") return "En proceso";
    if (value === "en revisión" || value === "en revision") return "En revisión";
    if (value === "terminado") return "Terminado";
    return "";
  }

  function estadoOf(item) {
    return normalizeEstado(item?.estadoProduccion);
  }

  function estadoTone(estado) {
    return ESTADOS.find((item) => item.key === estado)?.tone || "";
  }

  const MATERIAL_FILTERS = [
    { key: "all", label: "Todos" },
    { key: "lona", label: "Lona" },
    { key: "toldo", label: "Toldo" },
    { key: "caballete", label: "Caballete" },
    { key: "rotulacion", label: "Rotulación" },
  ];

  function itemsForSession(list) {
    const rows = Array.isArray(list) ? list : [];
    if (session?.seesAll) return rows;
    return rows.filter((it) => materialKind(it) === "rotulacion");
  }

  function mergeKeptProducto(prev, next) {
    if (!Array.isArray(prev) || !prev.length) return next;
    const previous = new Map(prev.map((it) => [it.id || it.folio, it]));
    return next.map((it) => {
      const old = previous.get(it.id || it.folio);
      if (!old) return it;
      const incoming = new Set(productoFinalOf(it).map((file) => String(file.storedAs || file.url || "")));
      const extra = productoFinalOf(old).filter((file) => !incoming.has(String(file.storedAs || file.url || "")));
      if (!extra.length) return it;
      return { ...it, media: [...(Array.isArray(it.media) ? it.media : []), ...extra] };
    });
  }

  function materialKind(item) {
    const m = String(item?.material || "").toLowerCase();
    if (m.includes("toldo")) return "toldo";
    if (m.includes("caballete")) return "caballete";
    if (m.includes("rotul")) return "rotulacion";
    if (m.includes("lona")) return "lona";
    return "lona";
  }

  function materialCounts() {
    const counts = { all: items.length, lona: 0, toldo: 0, caballete: 0, rotulacion: 0 };
    for (const it of items) {
      const kind = materialKind(it);
      if (counts[kind] != null) counts[kind] += 1;
    }
    return counts;
  }

  function filteredItems() {
    const byMaterial =
      materialFilter === "all" ? items : items.filter((it) => materialKind(it) === materialFilter);
    const byStatus =
      statusFilter === "all"
        ? byMaterial
        : byMaterial.filter((it) => estadoOf(it) === statusFilter);
    if (!session?.seesAll) return byStatus;
    return [...byStatus].sort((a, b) => {
      const rankA = ESTADO_RANK[estadoOf(a)] || 0;
      const rankB = ESTADO_RANK[estadoOf(b)] || 0;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.receivedAt || 0).getTime() - new Date(a.receivedAt || 0).getTime();
    });
  }

  function statusCounts() {
    const base = materialFilter === "all" ? items : items.filter((it) => materialKind(it) === materialFilter);
    const counts = { all: base.length };
    for (const estado of ESTADOS) counts[estado.key] = 0;
    for (const item of base) {
      const estado = estadoOf(item);
      if (counts[estado] != null) counts[estado] += 1;
    }
    return counts;
  }

  function renderStatusFilters() {
    const nav = document.getElementById("statusFilters");
    if (!nav) return;
    const show = Boolean(session?.seesAll);
    nav.hidden = !show;
    if (!show) return;
    const counts = statusCounts();
    nav.querySelectorAll(".status-filter").forEach((btn) => {
      const key = btn.dataset.status || "all";
      btn.classList.toggle("is-active", key === statusFilter);
      const countEl = btn.querySelector("[data-status-count]");
      if (countEl) countEl.textContent = String(counts[key] ?? 0);
    });
  }

  function semaphoreHtml(item, { compact = false } = {}) {
    const current = estadoOf(item);
    const tone = estadoTone(current);
    if (!session?.canManage) {
      if (!current) return "";
      return `<p class="estado-pill" data-tone="${tone}"><span class="status-light" aria-hidden="true"></span>${escapeHtml(current)}</p>`;
    }
    const choices = ESTADOS.map(
      (estado) => `
        <button
          type="button"
          class="semaphore-choice${current === estado.key ? " is-on" : ""}"
          data-tone="${estado.tone}"
          data-estado="${escapeAttr(estado.key)}"
          data-id="${escapeAttr(item.id || item.folio || "")}"
          aria-pressed="${current === estado.key ? "true" : "false"}"
        >
          <span class="status-light" aria-hidden="true"></span>
          ${escapeHtml(estado.key)}
        </button>`,
    ).join("");
    const hint = current ? `Va en: ${current}` : "Elige el estado:";
    return `
      <section class="semaphore${compact ? " is-compact" : ""}" aria-label="Estado de la solicitud">
        <p class="semaphore-hint">${escapeHtml(hint)}</p>
        <div class="semaphore-choices">${choices}</div>
      </section>`;
  }

  function filterLabel() {
    return MATERIAL_FILTERS.find((f) => f.key === materialFilter)?.label || "Todos";
  }

  function renderMaterialFilters() {
    const counts = materialCounts();
    document.querySelectorAll(".material-filter").forEach((btn) => {
      const key = btn.dataset.filter;
      btn.classList.toggle("is-active", key === materialFilter);
      const countEl = btn.querySelector("[data-count]");
      if (countEl && key) countEl.textContent = String(counts[key] ?? 0);
    });
  }

  const SECTIONS = [
    {
      title: "Ejecutivo de ventas",
      fields: [
        ["ejecutivoNombre", "Nombre"],
        ["ejecutivoTelefono", "Teléfono"],
        ["ejecutivoCorreo", "Correo"],
      ],
    },
    {
      title: "Gerente",
      fields: [
        ["autorizada", "Autorización"],
        ["gerenteTerritorial", "Gerente territorial"],
        ["territorioGerente", "Gerente regional"],
        ["gerenteTelefono", "Teléfono gerente"],
      ],
    },
    {
      title: "YAAVSER",
      fields: [
        ["yaavserNombre", "Nombre"],
        ["claveYaavser", "Clave"],
        ["yaavserTelefono", "Teléfono"],
      ],
    },
    {
      title: "Punto de venta",
      fields: [
        ["puntoVenta", "Nombre"],
        ["puntoVentaUbicacion", "Ubicación"],
        ["puntoVentaUbicacionMaps", "Google Maps"],
        ["tipoEstablecimiento", "Tipo"],
        ["tipoEstablecimientoOtro", "Tipo (otro)"],
        ["objetivoLona", "Objetivo"],
        ["observacionesAdicionales", "Observaciones adicionales"],
      ],
    },
  ];

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function formatDate(iso) {
    const d = new Date(iso || "");
    if (Number.isNaN(d.getTime())) return String(iso || "—");
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  }

  function formatTime(iso) {
    const d = new Date(iso || Date.now());
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
  }

  function materialLabel(item) {
    const m = String(item?.material || "").trim();
    return m || "Sin material";
  }

  function isImageMime(mime, name) {
    const m = String(mime || "").toLowerCase();
    if (m.startsWith("image/")) return true;
    return /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(String(name || ""));
  }

  function isPdf(mime, name) {
    const m = String(mime || "").toLowerCase();
    return m.includes("pdf") || /\.pdf$/i.test(String(name || ""));
  }

  function isProductoFinal(file) {
    const kind = String(file?.kind || "").toLowerCase();
    const field = String(file?.field || "").toLowerCase();
    const group = String(file?.group || "").toLowerCase();
    return kind === "productofinal" || field === "producto_final" || group.includes("producto terminado");
  }

  function productoFinalOf(item) {
    return mediaOf(item).filter((file) => isProductoFinal(file));
  }

  function normalizeMediaFile(file, item) {
    if (!file || typeof file !== "object") return null;
    const kind = String(file.kind || "").toLowerCase();
    const labelRaw = String(file.label || "").toLowerCase();
    const groupRaw = String(file.group || "").toLowerCase();
    const field = String(file.field || "").toLowerCase();
    if (kind === "productofinal" || field === "producto_final" || groupRaw.includes("producto terminado")) {
      return {
        ...file,
        kind: "productoFinal",
        group: "Producto terminado",
        label: "Producto terminado",
        field: file.field || "producto_final",
      };
    }
    const material = String(item?.material || "").toLowerCase();
    const isRotul =
      material.includes("rotul") || field.includes("rotulacion_foto") || field.includes("rotulacion_permiso");
    let nextKind = kind;
    let nextGroup = file.group || "";
    let nextLabel = file.label || "";

    if (
      nextKind === "permiso" ||
      field.includes("permiso") ||
      labelRaw.includes("permiso") ||
      groupRaw.includes("permiso")
    ) {
      nextKind = "permiso";
      nextGroup = "Permisos gubernamentales";
      nextLabel = "Evidencia de permiso";
    } else if (field.includes("foto_pv") || (labelRaw.includes("punto de venta") && !labelRaw.includes("fachada") && !groupRaw.includes("fachada"))) {
      nextKind = "foto";
      nextGroup = "Punto de venta";
      nextLabel = "Foto del punto de venta";
    } else if (
      nextKind === "foto" ||
      field.includes("foto") ||
      labelRaw.includes("punto de venta") ||
      labelRaw.includes("fachada") ||
      groupRaw.includes("punto de venta") ||
      groupRaw.includes("fachada")
    ) {
      nextKind = "foto";
      if (field.includes("foto_pv")) {
        nextGroup = "Punto de venta";
        nextLabel = "Foto del punto de venta";
      } else if (isRotul || field.includes("rotulacion_foto") || groupRaw.includes("fachada") || labelRaw.includes("fachada")) {
        nextGroup = "Fachada del punto de venta";
        if (field.includes("foto_2") || /(?:^|\s)2$/.test(String(file.label || "").trim())) {
          nextLabel = "Foto de fachada 2";
        } else {
          nextLabel = "Foto de fachada";
        }
      } else {
        nextGroup = nextGroup && !groupRaw.includes("rotul") ? nextGroup : "Punto de venta";
        nextLabel = nextLabel || "Foto del punto de venta";
      }
    } else if (nextKind === "logo" || labelRaw.includes("logo")) {
      nextKind = "logo";
      nextLabel = nextLabel || "Logotipo";
      nextGroup = nextGroup || "General";
    } else if (nextKind === "referencia" || labelRaw.includes("referencia")) {
      nextKind = "referencia";
      nextLabel = nextLabel || "Referencia de diseño";
      nextGroup = nextGroup || "General";
    } else {
      nextGroup = nextGroup || "General";
      nextLabel = nextLabel || file.name || "Archivo";
    }

    return {
      ...file,
      kind: nextKind || file.kind || "archivo",
      group: nextGroup,
      label: nextLabel,
    };
  }

  function mediaOf(item) {
    if (!Array.isArray(item?.media) || !item.media.length) return [];
    const out = [];
    const seen = new Set();
    for (const raw of item.media) {
      const file = normalizeMediaFile(raw, item);
      if (!file?.url) continue;
      const driveId = driveIdOf(file.url);
      const key =
        String(file.storedAs || "").trim().toLowerCase() ||
        (driveId ? `drive:${driveId}` : String(file.url).trim().toLowerCase());
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(file);
    }
    return out;
  }

  function mediaIndex(media, file) {
    if (!file) return -1;
    const byRef = media.indexOf(file);
    if (byRef >= 0) return byRef;
    const url = String(file.url || "");
    const stored = String(file.storedAs || "");
    return media.findIndex(
      (f) => (url && f.url === url) || (stored && f.storedAs === stored),
    );
  }

  function mediaGroupOrder(name) {
    const g = String(name || "").toLowerCase();
    if (g.includes("permiso")) return 0;
    if (g.includes("fachada") || g.includes("punto de venta")) return 1;
    if (g.includes("logo") || g.includes("referencia")) return 2;
    return 3;
  }

  function isPuntoVentaMedia(file, item) {
    const group = String(file?.group || "").toLowerCase();
    const label = String(file?.label || "").toLowerCase();
    const kind = String(file?.kind || "").toLowerCase();
    const field = String(file?.field || "").toLowerCase();
    const material = String(item?.material || "").toLowerCase();
    if (kind === "permiso" || field.includes("permiso")) return false;
    // Dedicated PV photo for rotulación
    if (field.includes("foto_pv") || (group === "punto de venta" && label.includes("punto de venta"))) {
      return true;
    }
    // Fachada evidence belongs to Rotulación panel, not the PV block
    if (field.includes("rotulacion_foto_1") || field.includes("rotulacion_foto_2") || group.includes("fachada") || label.includes("fachada")) {
      return material.includes("rotul") ? false : true;
    }
    if (field.includes("toldo_foto")) return true;
    if (group.includes("punto de venta")) return true;
    if (label.includes("punto de venta")) return true;
    if (kind === "foto" && material.includes("toldo")) return true;
    return false;
  }

  function isFachadaMedia(file, item) {
    const group = String(file?.group || "").toLowerCase();
    const label = String(file?.label || "").toLowerCase();
    const field = String(file?.field || "").toLowerCase();
    if (field.includes("foto_pv")) return false;
    if (field.includes("permiso")) return false;
    if (field.includes("rotulacion_foto_1") || field.includes("rotulacion_foto_2")) return true;
    if (group.includes("fachada") || label.includes("fachada")) return true;
    return false;
  }

  function mediaLabel(file, item) {
    if (file?.label) return file.label;
    const kind = String(file?.kind || "").toLowerCase();
    const field = String(file?.field || "").toLowerCase();
    if (kind === "logo") return "Logotipo";
    if (kind === "referencia") return "Referencia de diseño";
    if (kind === "permiso") return "Evidencia de permiso";
    if (field.includes("foto_pv")) return "Foto del punto de venta";
    if (field.includes("foto_2")) return "Foto del lateral derecho";
    if (field.includes("rotulacion_foto_1")) {
      return /lateral|izquierd/i.test(String(file.label || ""))
        ? "Foto del lateral izquierdo"
        : file.label || "Foto frontal de fachada";
    }
    if (field.includes("rotulacion_foto")) return file.label || "Foto de fachada";
    if (kind === "foto") return "Foto del punto de venta";
    return file?.name || "Archivo";
  }

  function driveIdOf(url) {
    const value = String(url || "");
    return value.includes("drive.google") ? value.match(/[?&]id=([\w-]+)/)?.[1] || "" : "";
  }

  // Drive ya no permite incrustar uc?export=view en <img>; la miniatura sí carga.
  function viewUrl(fileOrUrl) {
    const url = String(typeof fileOrUrl === "string" ? fileOrUrl : fileOrUrl?.url || "");
    const driveId = driveIdOf(url);
    return driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600` : url;
  }

  function downloadUrl(file) {
    const url = String(file?.url || "");
    const driveId = driveIdOf(url);
    return driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : url;
  }

  function downloadLink(file) {
    return `<a class="download-link" href="${escapeAttr(downloadUrl(file))}" download="${escapeAttr(file.name || "")}" target="_blank" rel="noopener">Descargar</a>`;
  }

  function renderMediaGallery(media, item) {
    if (!media.length) {
      return `
        <section class="panel media-panel">
          <div class="panel-head">
            <h3>Archivos adjuntos</h3>
          </div>
          <p class="empty-evidence">No hay archivos disponibles para esta solicitud.</p>
          <p class="empty-note">Los archivos nuevos se guardan en el servidor y en Google Drive; aparecen aquí automáticamente.</p>
        </section>`;
    }

    const groups = new Map();
    media.forEach((file) => {
      const key =
        file.group ||
        (file.kind === "permiso"
          ? "Permisos gubernamentales"
          : file.kind === "foto"
            ? "Fachada del punto de venta"
            : "General");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(file);
    });

    const blocks = [...groups.entries()]
      .sort((a, b) => mediaGroupOrder(a[0]) - mediaGroupOrder(b[0]) || a[0].localeCompare(b[0]))
      .map(([group, files]) => {
        const tiles = files
          .map((file) => {
            const globalIdx = mediaIndex(media, file);
            const kindLabel = mediaLabel(file);
            if (isImageMime(file.mime, file.name)) {
              return `
                <div class="evidence-tile-wrap">
                  <button type="button" class="evidence-item image-tile" data-media-index="${globalIdx}">
                    <img src="${escapeAttr(viewUrl(file))}" alt="${escapeAttr(file.name || kindLabel)}" loading="lazy" />
                    <span>${escapeHtml(kindLabel)}</span>
                    ${file.name ? `<small>${escapeHtml(file.name)}</small>` : ""}
                  </button>
                  ${downloadLink(file)}
                </div>`;
            }
            const badge = isPdf(file.mime, file.name) ? "PDF" : "DOC";
            return `
              <div class="evidence-tile-wrap">
                <a class="evidence-item file-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener">
                  <div class="evidence-file-tile">${badge}</div>
                  <span>${escapeHtml(kindLabel)}</span>
                  <small>${escapeHtml(file.name || "")}</small>
                </a>
                ${downloadLink(file)}
              </div>`;
          })
          .join("");
        return `
          <div class="evidence-block">
            <h4>${escapeHtml(group)} <em>${files.length}</em></h4>
            <div class="evidence-gallery">${tiles}</div>
          </div>`;
      })
      .join("");

    return `
      <section class="panel media-panel">
        <div class="panel-head">
          <h3>Archivos adjuntos</h3>
          <span class="pill">${media.length} archivo${media.length === 1 ? "" : "s"}</span>
          ${
            item
              ? `<a class="zip-link" href="./api/responses/${encodeURIComponent(item.id || item.folio || "")}/archivos.zip">Descargar todo (ZIP)</a>`
              : ""
          }
        </div>
        <p class="media-note">Se muestran todos los archivos enviados: permisos, fotos de fachada, logotipos y referencias.</p>
        <div class="evidence-blocks">${blocks}</div>
      </section>`;
  }

  function puntoVentaMedia(item) {
    return mediaOf(item).filter((f) => f?.url && isPuntoVentaMedia(f, item));
  }

  function firstThumb(item) {
    const preferred = puntoVentaMedia(item).find((f) => isImageMime(f.mime, f.name) && f.url);
    if (preferred?.url) return viewUrl(preferred);
    const img = mediaOf(item).find((f) => !isProductoFinal(f) && isImageMime(f.mime, f.name) && f.url);
    if (img?.url) return viewUrl(img);
    const render = productoFinalOf(item).find((f) => isImageMime(f.mime, f.name) && f.url);
    return render?.url ? viewUrl(render) : "";
  }

  function renderPuntoVentaPhotos(item, media) {
    const all = media || mediaOf(item);
    const files = all.filter((f) => f?.url && isPuntoVentaMedia(f, item) && (isImageMime(f.mime, f.name) || isPdf(f.mime, f.name)));
    if (!files.length) return "";
    const tiles = files
      .map((file) => {
        const globalIdx = mediaIndex(all, file);
        const kindLabel = mediaLabel(file, item);
        if (isImageMime(file.mime, file.name)) {
          return `
            <button type="button" class="evidence-item image-tile pv-photo" data-media-index="${globalIdx}">
              <img src="${escapeAttr(viewUrl(file))}" alt="${escapeAttr(file.name || kindLabel)}" loading="lazy" />
              <span>${escapeHtml(kindLabel)}</span>
            </button>`;
        }
        return `
          <a class="evidence-item file-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener">
            <div class="evidence-file-tile">PDF</div>
            <span>${escapeHtml(kindLabel)}</span>
          </a>`;
      })
      .join("");
    return `
      <div class="pv-photos">
        <span class="field-label">Foto del punto de venta</span>
        <div class="evidence-gallery">${tiles}</div>
      </div>`;
  }

  function renderFachadaPhotos(item, media) {
    const all = media || mediaOf(item);
    const files = all.filter((f) => f?.url && isFachadaMedia(f, item) && (isImageMime(f.mime, f.name) || isPdf(f.mime, f.name)));
    if (!files.length) return "";
    const tiles = files
      .map((file) => {
        const globalIdx = mediaIndex(all, file);
        const kindLabel = mediaLabel(file, item);
        if (isImageMime(file.mime, file.name)) {
          return `
            <button type="button" class="evidence-item image-tile pv-photo" data-media-index="${globalIdx}">
              <img src="${escapeAttr(viewUrl(file))}" alt="${escapeAttr(file.name || kindLabel)}" loading="lazy" />
              <span>${escapeHtml(kindLabel)}</span>
            </button>`;
        }
        return `
          <a class="evidence-item file-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener">
            <div class="evidence-file-tile">PDF</div>
            <span>${escapeHtml(kindLabel)}</span>
          </a>`;
      })
      .join("");
    return `
      <div class="pv-photos">
        <span class="field-label">Evidencia fotográfica de fachada</span>
        <div class="evidence-gallery">${tiles}</div>
      </div>`;
  }

  function parsePipeBlock(text) {
    const out = {};
    String(text || "")
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((part) => {
        const idx = part.indexOf(":");
        if (idx === -1) return;
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        out[key] = val;
      });
    return out;
  }

  function parseSpecsText(raw, labelKey) {
    return String(raw || "")
      .split("||")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk, i) => {
        const parsed = parsePipeBlock(chunk.replace(/^[^:]+:\s*/, ""));
        const titleMatch = chunk.match(/^[^:]+:\s*([^|]+)/);
        const title = parsed[labelKey] || (titleMatch ? titleMatch[1].trim() : `${labelKey} ${i + 1}`);
        return { title, ...parsed };
      });
  }

  function specsLonas(item) {
    if (Array.isArray(item.lonasDetail) && item.lonasDetail.length) {
      return item.lonasDetail.map((l) => ({
        title: l.lona || "Lona",
        ancho: l.ancho,
        alto: l.alto,
        orientacion: l.orientacion,
        acabados: Array.isArray(l.acabados) ? l.acabados.join(", ") : l.acabados,
        marcas: Array.isArray(l.marcas) ? l.marcas.join(", ") : l.marcas,
        textoPrincipal: l.textoPrincipal,
        datosContactoOpciones: Array.isArray(l.datosContactoOpciones)
          ? l.datosContactoOpciones.join(", ")
          : l.datosContactoOpciones,
        datosContactoDetalle: l.datosContactoDetalle,
        tieneReferencia: l.tieneReferencia,
      }));
    }
    return parseSpecsText(item.lonas, "lona");
  }

  function specsToldos(item) {
    if (Array.isArray(item.toldosDetail) && item.toldosDetail.length) {
      return item.toldosDetail.map((t) => ({
        title: t.toldo || "Toldo",
        tipo: t.tipo,
        ubicacionMaps: t.ubicacionMaps,
        ancho: t.ancho,
        largo: t.largo,
        alto: t.alto,
        incluyeEstructura: t.incluyeEstructura,
        marcas: Array.isArray(t.marcas) ? t.marcas.join(", ") : t.marcas,
        textoPrincipal: t.textoPrincipal,
        datosContactoOpciones: Array.isArray(t.datosContactoOpciones)
          ? t.datosContactoOpciones.join(", ")
          : t.datosContactoOpciones,
        datosContactoDetalle: t.datosContactoDetalle,
        tieneReferencia: t.tieneReferencia,
      }));
    }
    return parseSpecsText(item.toldos, "toldo");
  }

  function specsCaballetes(item) {
    if (Array.isArray(item.caballetesDetail) && item.caballetesDetail.length) {
      return item.caballetesDetail.map((c) => ({
        title: c.caballete || "Caballete",
        ancho: c.ancho,
        alto: c.alto,
        caras: c.caras,
        orientacion: c.orientacion,
        acabados: Array.isArray(c.acabados) ? c.acabados.join(", ") : c.acabados,
        marcas: Array.isArray(c.marcas) ? c.marcas.join(", ") : c.marcas,
        textoPrincipal: c.textoPrincipal,
        datosContactoOpciones: Array.isArray(c.datosContactoOpciones)
          ? c.datosContactoOpciones.join(", ")
          : c.datosContactoOpciones,
        datosContactoDetalle: c.datosContactoDetalle,
        tieneReferencia: c.tieneReferencia,
      }));
    }
    return parseSpecsText(item.caballetes, "caballete");
  }

  function specsRotulacion(item) {
    const r =
      item.rotulacionDetail && typeof item.rotulacionDetail === "object"
        ? item.rotulacionDetail
        : null;
    if (!r) {
      const text = String(item.rotulacion || "").trim();
      if (!text) return [];
      return [{ title: "Rotulación", detalle: text }];
    }
    return [
      {
        title: "Rotulación multimarca",
        permisos: r.permisos,
        clasificacion: r.clasificacion,
        color: r.color,
        versionBastidor: r.versionBastidor,
        evidenciaTipo:
          r.evidenciaTipo === "esquina"
            ? "Esquina / contraesquina (lateral izquierdo y derecho)"
            : r.evidenciaTipo === "frente"
              ? "Negocio de frente (1 foto)"
              : r.evidenciaTipo,
      },
    ];
  }

  function renderStats() {
    const visible = filteredItems();
    const latest = visible[0];
    const withMedia = visible.filter((it) => mediaOf(it).length).length;
    const counts = materialCounts();
    statsEl.innerHTML = `
      <div class="stat stat-accent">
        <span>${materialFilter === "all" ? "Solicitudes" : filterLabel()}</span>
        <strong>${visible.length}</strong>
      </div>
      <div class="stat">
        <span>Último folio</span>
        <strong class="stat-sm">${escapeHtml(latest?.folio || "—")}</strong>
      </div>
      <div class="stat">
        <span>Con archivos</span>
        <strong>${withMedia}</strong>
      </div>
      <div class="stat">
        ${
          session?.seesAll
            ? `<span>Por material</span>
               <strong class="stat-sm">L ${counts.lona} · T ${counts.toldo} · C ${counts.caballete} · R ${counts.rotulacion}</strong>`
            : `<span>Notas de Marketing</span>
               <strong>${visible.filter((it) => String(it.faltanteCliente || "").trim()).length}</strong>`
        }
      </div>
    `;
  }

  function renderList() {
    const visible = filteredItems();
    if (!items.length) {
      listEl.innerHTML = `<p class="list-empty">Sin solicitudes</p>`;
      return;
    }
    if (!visible.length) {
      listEl.innerHTML = `<p class="list-empty">No hay solicitudes de ${escapeHtml(filterLabel())}</p>`;
      return;
    }
    listEl.innerHTML = visible
      .map((item, i) => {
        const active = i === index ? " is-active" : "";
        const thumb = firstThumb(item);
        const kind = materialKind(item);
        const mediaCount = mediaOf(item).length;
        return `
          <article class="request-card${active}">
            <button type="button" class="request-card-open" data-index="${i}">
              <div class="request-card-thumb">
                ${
                  thumb
                    ? `<img src="${escapeAttr(thumb)}" alt="" loading="lazy" />`
                    : `<span class="request-card-placeholder ${kind}">${
                        kind === "toldo"
                          ? "T"
                          : kind === "caballete"
                            ? "C"
                            : kind === "rotulacion"
                              ? "R"
                              : "L"
                      }</span>`
                }
              </div>
              <div class="request-card-body">
                <div class="request-card-top">
                  <strong>${escapeHtml(item.folio || "Sin folio")}</strong>
                  <span class="badge ${kind}">${escapeHtml(materialLabel(item))}</span>
                </div>
                <p>${escapeHtml(item.puntoVenta || item.yaavserNombre || "—")}</p>
                <small>${escapeHtml(formatDate(item.receivedAt))}${mediaCount ? ` · ${mediaCount} archivo${mediaCount === 1 ? "" : "s"}` : ""}</small>
                ${
                  item.faltanteCliente && (session?.seesAll || materialKind(item) === "rotulacion")
                    ? `<p class="card-note">${session?.seesAll ? "" : "Marketing: "}${escapeHtml(item.faltanteCliente)}</p>`
                    : ""
                }
                ${
                  materialKind(item) === "rotulacion" && productoFinalOf(item).length
                    ? `<p class="card-producto">Producto terminado</p>`
                    : ""
                }
              </div>
            </button>
            ${session?.seesAll || session?.canManage ? semaphoreHtml(item, { compact: true }) : ""}
            ${productoCardHtml(item)}
            ${autorizacionCardHtml(item)}
          </article>`;
      })
      .join("");

    listEl.querySelectorAll(".request-card-open").forEach((btn) => {
      btn.onclick = () => {
        index = Number(btn.dataset.index) || 0;
        renderList();
        renderDetail();
      };
    });
    bindSemaphore(listEl);
    bindProductoCards(listEl);
    bindAutorizacion(listEl);
  }

  function isAuthorized(item) {
    return /^autorizada\b/i.test(String(item?.autorizada || "").trim());
  }

  function autorizacionCardHtml(item) {
    const ok = isAuthorized(item);
    const id = escapeAttr(item.id || item.folio || "");
    if (session?.canAuthorize && item?.enMiZona) {
      return `
        <div class="autorizacion-card">
          <button type="button" class="autorizacion-btn${ok ? " is-on" : ""}" data-id="${id}" data-aceptar="${ok ? "0" : "1"}">
            ${ok ? "Autorizada · quitar" : "Aceptar solicitud"}
          </button>
        </div>`;
    }
    return `<p class="autorizacion-flag${ok ? " is-on" : ""}">${ok ? "Autorizada" : "Pendiente de autorización"}</p>`;
  }

  function productoCardHtml(item) {
    if (!session?.canManage || materialKind(item) !== "rotulacion") return "";
    const count = productoFinalOf(item).length;
    const id = escapeAttr(item.id || item.folio || "");
    return `
      <div class="producto-card">
        <input class="producto-card-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,.pdf" multiple hidden data-id="${id}" />
        <button type="button" class="producto-card-btn" data-id="${id}">${count ? `Subir otro render · ${count}` : "Subir render"}</button>
      </div>`;
  }

  function bindProductoCards(root) {
    if (!session?.canManage || !root) return;
    root.querySelectorAll(".producto-card").forEach((wrap) => {
      const input = wrap.querySelector(".producto-card-input");
      const button = wrap.querySelector(".producto-card-btn");
      if (!input || !button) return;
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!productoUploadBusy) input.click();
      };
      input.onchange = () => {
        const chosen = [...(input.files || [])];
        input.value = "";
        if (!chosen.length) return;
        const id = input.dataset.id || "";
        const item = items.find((it) => it.id === id || it.folio === id);
        uploadProductoFinal(item, chosen, button);
      };
    });
  }

  function autorizacionDetailHtml(item) {
    const ok = isAuthorized(item);
    const quien = String(item?.autorizada || "")
      .split("·")
      .slice(1)
      .join("·")
      .trim();
    const id = escapeAttr(item.id || item.folio || "");
    const mine = session?.canAuthorize && item?.enMiZona;
    const action = mine
      ? `<button type="button" class="autorizacion-btn${ok ? " is-on" : ""}" data-id="${id}" data-aceptar="${ok ? "0" : "1"}">${ok ? "Quitar autorización" : "Aceptar para Marketing"}</button>`
      : "";
    const fuera = session?.canAuthorize && !item?.enMiZona ? " La autoriza el gerente de esta zona." : "";
    return `
      <section class="autorizacion-panel${ok ? " is-on" : ""}">
        <div>
          <p class="autorizacion-kicker">Autorización del gerente</p>
          <p class="autorizacion-state">${ok ? `Autorizada${quien ? ` · ${escapeHtml(quien)}` : ""}` : `Pendiente de autorización${fuera}`}</p>
        </div>
        ${action}
      </section>`;
  }

  function bindAutorizacion(root) {
    if (!session?.canAuthorize || !root) return;
    root.querySelectorAll(".autorizacion-btn").forEach((btn) => {
      btn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = btn.dataset.id || "";
        if (!id) return;
        setAutorizacion(id, btn.dataset.aceptar !== "0");
      };
    });
  }

  async function setAutorizacion(id, aceptar) {
    const item = items.find((it) => it.id === id || it.folio === id);
    if (!item || !session?.canAuthorize || !item.enMiZona) return;
    const previous = item.autorizada || "";
    item.autorizada = aceptar ? "Autorizada" : "";
    renderList();
    renderDetail();
    try {
      const res = await fetch(`/api/responses/${encodeURIComponent(id)}/autorizacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aceptar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo guardar");
      item.autorizada = data.autorizada || "";
      lastFingerprint = boardFingerprint(items);
      renderList();
      renderDetail();
    } catch (err) {
      item.autorizada = previous;
      renderList();
      renderDetail();
      window.alert(err.message || "No se pudo guardar la autorización");
    }
  }

  function fieldValueHtml(key, val) {
    const text = String(val ?? "").trim();
    if (!text) return "";
    if (key === "puntoVentaUbicacionMaps" && /^https?:\/\//i.test(text)) {
      return `<a href="${escapeHtml(text)}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>`;
    }
    return escapeHtml(text);
  }

  function fieldGrid(fields, item) {
    const rows = fields
      .map(([key, label]) => {
        const val = item[key];
        if (val == null || String(val).trim() === "") return "";
        return `
          <div class="field">
            <span class="field-label">${escapeHtml(label)}</span>
            <span class="field-value">${fieldValueHtml(key, val)}</span>
          </div>`;
      })
      .filter(Boolean)
      .join("");
    return rows ? `<div class="field-grid">${rows}</div>` : "";
  }

  function renderSpecCards(specs, type) {
    if (!specs.length) return "";
    const labels =
      type === "toldo"
        ? [
            ["tipo", "Tipo"],
            ["ubicacionMaps", "Ubicación Maps"],
            ["ancho", "Ancho (m)"],
            ["largo", "Largo (m)"],
            ["alto", "Alto (m)"],
            ["incluyeEstructura", "Estructura"],
            ["marcas", "Marcas"],
            ["textoPrincipal", "Texto principal"],
            ["datosContactoOpciones", "Contacto"],
            ["datosContactoDetalle", "Detalle contacto"],
            ["tieneReferencia", "Referencia previa"],
          ]
        : type === "caballete"
          ? [
              ["ancho", "Ancho (cm)"],
              ["alto", "Alto (cm)"],
              ["caras", "Caras"],
              ["orientacion", "Orientación"],
              ["marcas", "Marcas"],
              ["textoPrincipal", "Texto principal"],
              ["datosContactoOpciones", "Contacto"],
              ["datosContactoDetalle", "Detalle contacto"],
              ["tieneReferencia", "Referencia previa"],
            ]
          : type === "rotulacion"
            ? [
                ["permisos", "Permisos"],
                ["clasificacion", "Clasificación"],
                ["color", "Color"],
                ["versionBastidor", "Versión de bastidor"],
                ["evidenciaTipo", "Evidencia fotográfica"],
                ["detalle", "Detalle"],
              ]
            : [
                ["ancho", "Ancho (cm)"],
                ["alto", "Alto (cm)"],
                ["orientacion", "Orientación"],
                ["acabados", "Acabados"],
                ["marcas", "Marcas"],
                ["textoPrincipal", "Texto principal"],
                ["datosContactoOpciones", "Contacto"],
                ["datosContactoDetalle", "Detalle contacto"],
                ["tieneReferencia", "Referencia previa"],
              ];

    return `
      <div class="spec-grid">
        ${specs
          .map(
            (spec) => `
          <article class="spec-card">
            <h4>${escapeHtml(
              spec.title ||
                (type === "toldo"
                  ? "Toldo"
                  : type === "caballete"
                    ? "Caballete"
                    : type === "rotulacion"
                      ? "Rotulación"
                      : "Lona"),
            )}</h4>
            <div class="field-grid compact">
              ${labels
                .map(([key, label]) => {
                  const val = spec[key];
                  if (val == null || String(val).trim() === "") return "";
                  return `
                    <div class="field">
                      <span class="field-label">${escapeHtml(label)}</span>
                      <span class="field-value">${escapeHtml(val)}</span>
                    </div>`;
                })
                .join("")}
            </div>
          </article>`,
          )
          .join("")}
      </div>`;
  }

  function noteHistoryHtml(historial) {
    const cards = String(historial || "")
      .split(/\n\n+/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const splitAt = block.indexOf("\n");
        const head = splitAt === -1 ? "Nota" : block.slice(0, splitAt);
        const body = splitAt === -1 ? block : block.slice(splitAt + 1).trim();
        return `
          <article class="note-card">
            <small>${escapeHtml(head.replace(/^.*?—\s*/, ""))}</small>
            <p>${escapeHtml(body || head)}</p>
          </article>`;
      });
    if (!cards.length) return "";
    return `<div class="note-stack"><span>Notas guardadas</span>${cards.join("")}</div>`;
  }

  function productoTile(file, idx) {
    const kindLabel = "Producto terminado";
    if (isImageMime(file.mime, file.name)) {
      return `
        <div class="evidence-tile-wrap">
          <button type="button" class="evidence-item image-tile" data-producto-index="${idx}">
            <img src="${escapeAttr(viewUrl(file))}" alt="${escapeAttr(file.name || kindLabel)}" loading="lazy" />
            <span>${escapeHtml(kindLabel)}</span>
            ${file.name ? `<small>${escapeHtml(file.name)}</small>` : ""}
          </button>
          ${downloadLink(file)}
        </div>`;
    }
    const badge = isPdf(file.mime, file.name) ? "PDF" : "DOC";
    return `
      <div class="evidence-tile-wrap">
        <a class="evidence-item file-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener">
          <div class="evidence-file-tile">${badge}</div>
          <span>${escapeHtml(kindLabel)}</span>
          <small>${escapeHtml(file.name || "")}</small>
        </a>
        ${downloadLink(file)}
      </div>`;
  }

  function productoFinalHtml(item) {
    if (materialKind(item) !== "rotulacion") return "";
    const files = productoFinalOf(item);
    if (!session?.canManage && !files.length) return "";
    const tiles = files.map((file, idx) => productoTile(file, idx)).join("");
    const uploader = session?.canManage
      ? `
        <div class="producto-upload">
          <p>Sube aquí el render o el producto terminado.</p>
          <input id="productoFinalInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,.pdf" multiple hidden />
          <button type="button" class="producto-send" id="productoFinalBtn">Subir render</button>
        </div>`
      : "";
    return `
      <section class="panel producto-panel" aria-label="Producto terminado">
        <div class="panel-head">
          <h3>Producto terminado</h3>
          ${files.length ? `<span class="pill">${files.length}</span>` : ""}
        </div>
        ${
          tiles
            ? `<div class="evidence-gallery">${tiles}</div>`
            : `<p class="empty-evidence">Todavía no hay render ni producto terminado.</p>`
        }
        ${uploader}
      </section>`;
  }

  function faltanteHtml(item) {
    const texto = String(item?.faltanteCliente || "");
    const historial = String(item?.faltanteHistorial || "");
    const notes = noteHistoryHtml(historial);
    if (!session?.canManage) {
      if (!texto && !historial) return "";
      if (!session?.seesAll && materialKind(item) !== "rotulacion") return "";
      const title = session?.seesAll ? "Nota" : "Nota de Marketing";
      return `
        <section class="faltante" aria-label="${title}">
          <h3>${title}</h3>
          <p>${session?.seesAll ? "Observación de Marketing." : "Observación de Marketing sobre esta rotulación."}</p>
          ${notes || (texto ? `<p class="faltante-text">${escapeHtml(texto)}</p>` : "")}
        </section>`;
    }
    return `
      <section class="faltante" aria-label="Nota de la solicitud">
        <h3>Nota</h3>
        <p>${texto ? "Si te equivocaste, corrige el texto y guarda de nuevo." : "Escribe las observaciones. Se guardan en el tablero y no se envían a nadie."}</p>
        <textarea id="faltanteTexto" rows="4" maxlength="800" placeholder="El proyecto está mal. Hay que corregir el texto y faltó el logotipo.">${escapeHtml(texto)}</textarea>
        <div class="faltante-row">
          <button type="button" class="faltante-send" id="faltanteGuardar" data-id="${escapeAttr(item.id || item.folio || "")}">${texto ? "Guardar cambios" : "Guardar nota"}</button>
        </div>
        ${notes}
      </section>`;
  }

  function bindFaltante(item) {
    const box = document.getElementById("faltanteTexto");
    const saveBtn = document.getElementById("faltanteGuardar");
    if (!box || !saveBtn || !session?.canManage) return;
    saveBtn.onclick = async () => {
      const texto = box.value.trim();
      if (!texto) {
        window.alert("Escribe la observación en la nota.");
        box.focus();
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando…";
      try {
        const res = await fetch(`/api/responses/${encodeURIComponent(saveBtn.dataset.id || item.id || item.folio || "")}/faltante`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texto }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo guardar la nota");
        item.faltanteCliente = data.faltanteCliente || texto;
        item.faltanteHistorial = data.faltanteHistorial || item.faltanteHistorial || "";
        lastFingerprint = boardFingerprint(items);
        renderList();
        renderDetail();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar nota";
        window.alert(err.message || "No se pudo guardar la nota");
      }
    };
  }

  function renderDetail() {
    const visible = filteredItems();
    if (!items.length) {
      detailEl.innerHTML = `
        <section class="card empty-card">
          <div class="empty-icon" aria-hidden="true">◎</div>
          <h2>Aún no hay solicitudes</h2>
          <p class="empty-note">
            El tablero está en vivo y se actualiza solo. Cuando envíes una solicitud desde el
            formulario aparecerá aquí (Lona, Toldo, Caballete o Rotulación).
          </p>
          <p class="empty-note">
            Si acabas de desplegar en Render, el disco temporal se reinicia: las respuestas
            nuevas se guardan otra vez al enviar el formulario y también en Google Sheets.
          </p>
          <a class="cta-link" href="./">Ir al formulario</a>
        </section>`;
      return;
    }

    if (!visible.length) {
      detailEl.innerHTML = `
        <section class="card empty-card">
          <div class="empty-icon" aria-hidden="true">◎</div>
          <h2>Sin solicitudes de ${escapeHtml(filterLabel())}</h2>
          <p class="empty-note">
            Hay ${items.length} solicitud${items.length === 1 ? "" : "es"} en total.
            Cambia el filtro de material para verlas.
          </p>
        </section>`;
      return;
    }

    const item = visible[index] || visible[0];
    const kind = materialKind(item);
    const media = mediaOf(item).filter((file) => !isProductoFinal(file));
    const producto = productoFinalOf(item);
    const lonas = specsLonas(item);
    const toldos = specsToldos(item);
    const caballetes = specsCaballetes(item);
    const rotulaciones = specsRotulacion(item);
    const confirmaciones = String(item.confirmaciones || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    detailEl.innerHTML = `
      <article class="detail-card">
        <header class="detail-hero">
          <div>
            <p class="detail-kicker">${escapeHtml(filterLabel())} · Solicitud ${index + 1} de ${visible.length}</p>
            <h2>${escapeHtml(item.folio || "Sin folio")}</h2>
            <p class="detail-meta">${escapeHtml(formatDate(item.receivedAt))}</p>
          </div>
          <div class="detail-hero-actions">
            <span class="badge large ${kind}">${escapeHtml(materialLabel(item))}</span>
            <div class="nav">
              <button type="button" id="prevBtn">← Anterior</button>
              <button type="button" id="nextBtn">Siguiente →</button>
              ${session?.canDelete ? `<button type="button" id="deleteBtn" class="delete-btn">Eliminar</button>` : ""}
            </div>
          </div>
        </header>

        ${autorizacionDetailHtml(item)}

        ${productoFinalHtml(item)}

        ${semaphoreHtml(item)}

        ${faltanteHtml(item)}

        <div class="chip-row">
          ${item.puntoVenta ? `<span class="chip">${escapeHtml(item.puntoVenta)}</span>` : ""}
          ${item.claveYaavser ? `<span class="chip">${escapeHtml(item.claveYaavser)}</span>` : ""}
          ${item.gerenteTerritorial ? `<span class="chip">${escapeHtml(item.gerenteTerritorial)}</span>` : ""}
        </div>

        ${renderMediaGallery(media, item)}

        ${SECTIONS.map((section) => {
          const body = fieldGrid(section.fields, item);
          if (!body) return "";
          return `
            <section class="panel">
              <div class="panel-head"><h3>${escapeHtml(section.title)}</h3></div>
              ${body}
            </section>`;
        }).join("")}

        ${
          lonas.length
            ? `<section class="panel">
                <div class="panel-head"><h3>Lonas (${lonas.length})</h3></div>
                ${renderSpecCards(lonas, "lona")}
              </section>`
            : ""
        }

        ${
          toldos.length
            ? `<section class="panel">
                <div class="panel-head"><h3>Toldos (${toldos.length})</h3></div>
                ${renderSpecCards(toldos, "toldo")}
              </section>`
            : ""
        }

        ${
          caballetes.length
            ? `<section class="panel">
                <div class="panel-head"><h3>Caballetes (${caballetes.length})</h3></div>
                ${renderSpecCards(caballetes, "caballete")}
              </section>`
            : ""
        }

        ${
          rotulaciones.length
            ? `<section class="panel">
                <div class="panel-head"><h3>Rotulación</h3></div>
                ${renderSpecCards(rotulaciones, "rotulacion")}
              </section>`
            : ""
        }

        ${
          confirmaciones.length
            ? `<section class="panel">
                <div class="panel-head"><h3>Confirmaciones</h3></div>
                <ul class="confirm-list">
                  ${confirmaciones.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
                </ul>
              </section>`
            : ""
        }
      </article>
    `;

    bindSemaphore(detailEl);
    bindFaltante(item);
    bindProductoFinal(item, producto);
    bindAutorizacion(detailEl);

    document.getElementById("prevBtn").onclick = () => {
      const visible = filteredItems();
      if (!visible.length) return;
      index = (index - 1 + visible.length) % visible.length;
      renderList();
      renderDetail();
    };
    document.getElementById("nextBtn").onclick = () => {
      const visible = filteredItems();
      if (!visible.length) return;
      index = (index + 1) % visible.length;
      renderList();
      renderDetail();
    };

    const deleteBtn = document.getElementById("deleteBtn");
    if (deleteBtn) deleteBtn.onclick = async () => {
      const label = item.folio || item.puntoVenta || "esta solicitud";
      if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
      const btn = document.getElementById("deleteBtn");
      btn.disabled = true;
      btn.textContent = "Eliminando…";
      try {
        const res = await fetch(`/api/responses/${encodeURIComponent(item.id)}`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || "No se pudo eliminar");
        }
        index = 0;
        await refresh();
      } catch (err) {
        window.alert(`Error al eliminar: ${err.message || err}`);
        btn.disabled = false;
        btn.textContent = "Eliminar";
      }
    };

    detailEl.querySelectorAll("[data-media-index]").forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.mediaIndex);
        openLightbox(media, Number.isFinite(idx) && idx >= 0 ? idx : 0);
      };
    });
    detailEl.querySelectorAll("[data-producto-index]").forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.productoIndex);
        openLightbox(producto, Number.isFinite(idx) && idx >= 0 ? idx : 0);
      };
    });
  }

  async function uploadProductoFinal(item, files, button) {
    if (!item || !files?.length || productoUploadBusy || !session?.canManage) return;
    productoUploadBusy = true;
    const previous = button?.textContent || "Subir render";
    if (button) {
      button.disabled = true;
      button.textContent = "Subiendo…";
    }
    try {
      const body = new FormData();
      for (const file of files) body.append("producto", file);
      const res = await fetch(
        `/api/responses/${encodeURIComponent(item.id || item.folio || "")}/producto-final`,
        { method: "POST", body },
      );
      const data = await res.json().catch(() => ({}));
      if (!data.media?.length) throw new Error(data.error || "No se pudo subir el producto terminado");
      const current = Array.isArray(item.media) ? item.media : [];
      item.media = current.concat(data.media);
      lastFingerprint = boardFingerprint(items);
      if (data.error) window.alert(data.error);
      renderList();
      renderDetail();
    } catch (err) {
      if (button) {
        button.disabled = false;
        button.textContent = previous;
      }
      window.alert(err.message || "No se pudo subir el producto terminado");
    } finally {
      productoUploadBusy = false;
    }
  }

  function bindProductoFinal(item) {
    const input = document.getElementById("productoFinalInput");
    const send = document.getElementById("productoFinalBtn");
    if (!input || !send || !session?.canManage) return;
    send.onclick = () => {
      if (!productoUploadBusy) input.click();
    };
    input.onchange = () => {
      const chosen = [...(input.files || [])];
      input.value = "";
      if (!chosen.length) return;
      uploadProductoFinal(item, chosen, send);
    };
  }

  async function setEstado(id, estado) {
    const item = items.find((it) => it.id === id || it.folio === id);
    if (!item || !session?.canManage) return;
    const previous = item.estadoProduccion || "";
    item.estadoProduccion = estado;
    renderStatusFilters();
    renderList();
    renderDetail();
    try {
      const res = await fetch(`/api/responses/${encodeURIComponent(id)}/estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || "No se pudo guardar");
      item.estadoProduccion = data.estado || estado;
      lastFingerprint = boardFingerprint(items);
    } catch (err) {
      item.estadoProduccion = previous;
      renderStatusFilters();
      renderList();
      renderDetail();
      window.alert(err.message || "No se pudo guardar el semáforo");
    }
  }

  function bindSemaphore(root) {
    if (!session?.canManage) return;
    root.querySelectorAll(".semaphore-choice").forEach((btn) => {
      btn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = btn.dataset.id || "";
        const estado = btn.dataset.estado || "";
        if (!id || !estado) return;
        setEstado(id, estado);
      };
    });
  }

  function openLightbox(media, startIndex) {
    lightboxMedia = media.filter((f) => isImageMime(f.mime, f.name) && f.url);
    if (!lightboxMedia.length) return;
    const start = media[startIndex];
    lightboxIndex = lightboxMedia.findIndex(
      (f) => f === start || (start?.url && f.url === start.url),
    );
    if (lightboxIndex < 0) lightboxIndex = 0;
    updateLightbox();
    lightbox.hidden = false;
    lightbox.classList.add("is-open");
    document.body.classList.add("lightbox-open");
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightbox.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
    lightboxImg.removeAttribute("src");
    lightboxCaption.textContent = "";
  }

  function updateLightbox() {
    const file = lightboxMedia[lightboxIndex];
    if (!file) return closeLightbox();
    lightboxImg.src = viewUrl(file);
    lightboxImg.alt = file.name || "Imagen adjunta";
    const kind =
      file.label || (file.kind === "logo" ? "Logotipo" : file.kind === "referencia" ? "Referencia" : "Archivo");
    lightboxCaption.textContent = `${kind}${file.group ? ` · ${file.group}` : ""}${file.name ? ` · ${file.name}` : ""}`;
    if (lightboxDownload) {
      lightboxDownload.href = downloadUrl(file);
      lightboxDownload.setAttribute("download", file.name || "");
    }
    lightboxPrev.disabled = lightboxMedia.length <= 1;
    lightboxNext.disabled = lightboxMedia.length <= 1;
  }

  lightboxClose.onclick = closeLightbox;
  lightbox.onclick = (e) => {
    if (e.target === lightbox) closeLightbox();
  };
  lightboxPrev.onclick = () => {
    lightboxIndex = (lightboxIndex - 1 + lightboxMedia.length) % lightboxMedia.length;
    updateLightbox();
  };
  lightboxNext.onclick = () => {
    lightboxIndex = (lightboxIndex + 1) % lightboxMedia.length;
    updateLightbox();
  };
  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") lightboxPrev.click();
    if (e.key === "ArrowRight") lightboxNext.click();
  });

  async function refresh() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      const res = await fetch(`/api/responses?ts=${Date.now()}`, { cache: "no-store" });
      if (res.status === 401) {
        location.replace("/resultados");
        return;
      }
      const data = await res.json();
      const next = mergeKeptProducto(items, itemsForSession(data.items));
      sheetsConfigured = Boolean(data.sheetsConfigured);

      const fingerprint = boardFingerprint(next);
      const dataChanged = lastFingerprint === null || fingerprint !== lastFingerprint;
      const lightboxOpen = lightbox.classList.contains("is-open");
      const hadNew =
        dataChanged && lastFingerprint !== null && next.length > lastTotal && lastTotal >= 0;

      if (dataChanged) {
        const prevId = items[index]?.id || items[index]?.folio || "";
        if (hadNew) index = 0;
        lastTotal = next.length;
        items = next;
        lastFingerprint = fingerprint;

        if (!hadNew) {
          const visible = filteredItems();
          if (prevId) {
            const kept = visible.findIndex((it) => it.id === prevId || it.folio === prevId);
            index = kept >= 0 ? kept : Math.min(index, Math.max(0, visible.length - 1));
          } else if (index >= visible.length) {
            index = 0;
          }
        }
      } else {
        lastTotal = next.length;
      }

      const source = data.source || (sheetsConfigured ? "sheets" : "local");
      const sourceLabel =
        source === "sheets+local"
          ? " · Tablero + Sheets"
          : sheetsConfigured
            ? " · Solo local"
            : "";
      const errLabel = data.sheetsError ? ` · Sync Sheets: ${data.sheetsError}` : "";
      liveStatus.textContent = `En vivo · ${items.length} solicitud${
        items.length === 1 ? "" : "es"
      } · ${formatTime(new Date().toISOString())}${sourceLabel}${errLabel}`;
      liveStatus.dataset.live = "1";

      // Keep UI stable while lightbox is open; apply queued data on close via next tick
      const noteBox = document.getElementById("faltanteTexto");
      const openItem = filteredItems()[index];
      const writingNotice = Boolean(
        noteBox &&
          (document.activeElement === noteBox ||
            noteBox.value.trim() !== String(openItem?.faltanteCliente || "").trim()),
      );
      if (dataChanged && !lightboxOpen && !writingNotice && !productoUploadBusy) {
        renderMaterialFilters();
        renderStatusFilters();
        renderStats();
        renderList();
        renderDetail();
        if (hadNew) {
          detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else if (!dataChanged) {
        renderMaterialFilters();
      }
    } catch (_) {
      liveStatus.textContent = "Sin conexión · reintentando…";
      liveStatus.dataset.live = "0";
    } finally {
      refreshInFlight = false;
    }
  }

  function boardFingerprint(list) {
    return (list || [])
      .map((it) => {
        const media = (it.media || [])
          .map((m) => `${m.url || ""}|${m.kind || ""}|${m.size || 0}|${m.label || ""}`)
          .join(",");
        return [
          it.id || "",
          it.folio || "",
          it.receivedAt || "",
          it.material || "",
          it.puntoVenta || "",
          it.estadoProduccion || "",
          it.autorizada || "",
          it.faltanteCliente || "",
          it.faltanteHistorial || "",
          media,
          typeof it.rotulacion === "string"
            ? it.rotulacion
            : JSON.stringify(it.rotulacionDetail || it.rotulacion || ""),
        ].join("~");
      })
      .join("||");
  }

  document.getElementById("materialFilters")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".material-filter");
    if (!btn) return;
    const next = btn.dataset.filter || "all";
    if (next === materialFilter) return;
    materialFilter = next;
    index = 0;
    renderMaterialFilters();
    renderStats();
    renderList();
    renderDetail();
  });

  async function loadSession() {
    const res = await fetch("/api/session", { cache: "no-store" });
    if (!res.ok) {
      location.replace("/resultados");
      return false;
    }
    session = await res.json();
    const roleChip = document.getElementById("roleChip");
    if (roleChip) {
      roleChip.textContent = session.label || "";
      roleChip.hidden = false;
    }
    if (!session.seesAll) {
      const filters = document.getElementById("materialFilters");
      if (filters) filters.hidden = true;
    }
    renderStatusFilters();
    document.getElementById("statusFilters")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".status-filter");
      if (!btn || !session?.seesAll) return;
      const next = btn.dataset.status || "all";
      if (next === statusFilter) return;
      statusFilter = next;
      index = 0;
      renderStatusFilters();
      renderStats();
      renderList();
      renderDetail();
    });
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      await fetch("/api/logout", { method: "POST" }).catch(() => {});
      location.replace("/resultados");
    });
    return true;
  }

  loadSession().then((ok) => {
    if (!ok) return;
    refresh();
    setInterval(refresh, 1000);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
})();
