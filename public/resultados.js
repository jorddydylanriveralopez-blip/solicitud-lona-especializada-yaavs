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

  let items = [];
  let index = 0;
  let lastTotal = -1;
  let sheetsConfigured = false;
  let lightboxMedia = [];
  let lightboxIndex = 0;
  let materialFilter = "all";

  const MATERIAL_FILTERS = [
    { key: "all", label: "Todos" },
    { key: "lona", label: "Lona" },
    { key: "toldo", label: "Toldo" },
    { key: "caballete", label: "Caballete" },
    { key: "rotulacion", label: "Rotulación" },
  ];

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
    if (materialFilter === "all") return items;
    return items.filter((it) => materialKind(it) === materialFilter);
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
      title: "Autorización",
      fields: [
        ["autorizada", "Estado"],
        ["gerenteTerritorial", "Gerente"],
        ["gerenteTelefono", "Teléfono gerente"],
        ["territorioGerente", "Territorio"],
      ],
    },
    {
      title: "Ejecutivo de ventas",
      fields: [
        ["ejecutivoNombre", "Nombre"],
        ["ejecutivoTelefono", "Teléfono"],
        ["ejecutivoCorreo", "Correo"],
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

  function normalizeMediaFile(file, item) {
    if (!file || typeof file !== "object") return null;
    const kind = String(file.kind || "").toLowerCase();
    const labelRaw = String(file.label || "").toLowerCase();
    const groupRaw = String(file.group || "").toLowerCase();
    const field = String(file.field || "").toLowerCase();
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
    } else if (
      nextKind === "foto" ||
      field.includes("foto") ||
      labelRaw.includes("punto de venta") ||
      labelRaw.includes("fachada") ||
      groupRaw.includes("punto de venta") ||
      groupRaw.includes("fachada")
    ) {
      nextKind = "foto";
      nextGroup = isRotul ? "Fachada del punto de venta" : "Punto de venta";
      if (field.includes("foto_2") || /(?:^|\s)2$/.test(String(file.label || "").trim())) {
        nextLabel = isRotul ? "Foto de fachada 2" : "Foto del punto de venta 2";
      } else {
        nextLabel = isRotul ? "Foto de fachada" : "Foto del punto de venta";
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
    return item.media.map((f) => normalizeMediaFile(f, item)).filter((f) => f && f.url);
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
    if (field.includes("rotulacion_foto") || field.includes("toldo_foto")) return true;
    if (group.includes("punto de venta") || group.includes("fachada")) return true;
    if (label.includes("punto de venta") || label.includes("fachada")) return true;
    if (kind === "foto" && (material.includes("rotul") || material.includes("toldo"))) return true;
    return false;
  }

  function mediaLabel(file, item) {
    if (file?.label && !/punto de venta/i.test(file.label)) return file.label;
    const kind = String(file?.kind || "").toLowerCase();
    const field = String(file?.field || "").toLowerCase();
    const material = String(item?.material || "").toLowerCase();
    const isRotul = material.includes("rotul") || field.includes("rotulacion_foto");
    if (kind === "logo") return "Logotipo";
    if (kind === "referencia") return "Referencia de diseño";
    if (kind === "permiso") return "Evidencia de permiso";
    if (kind === "foto" || field.includes("foto")) {
      if (field.includes("foto_2")) return isRotul ? "Foto de fachada 2" : "Foto del punto de venta 2";
      if (field.includes("foto_1")) return isRotul ? "Foto de fachada" : "Foto del punto de venta";
      if (isRotul) {
        if (/2$/.test(String(file.label || ""))) return "Foto de fachada 2";
        return "Foto de fachada";
      }
      return file?.label || "Foto del punto de venta";
    }
    return file?.name || "Archivo";
  }

  function renderMediaGallery(media) {
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
                <button type="button" class="evidence-item image-tile" data-media-index="${globalIdx}">
                  <img src="${escapeAttr(file.url)}" alt="${escapeAttr(file.name || kindLabel)}" loading="lazy" />
                  <span>${escapeHtml(kindLabel)}</span>
                </button>`;
            }
            if (isPdf(file.mime, file.name)) {
              return `
                <a class="evidence-item file-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener">
                  <div class="evidence-file-tile">PDF</div>
                  <span>${escapeHtml(kindLabel)}</span>
                  <small>${escapeHtml(file.name || "")}</small>
                </a>`;
            }
            return `
              <a class="evidence-item file-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener">
                <div class="evidence-file-tile">DOC</div>
                <span>${escapeHtml(kindLabel)}</span>
                <small>${escapeHtml(file.name || "")}</small>
              </a>`;
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
    if (preferred?.url) return preferred.url;
    const img = mediaOf(item).find((f) => isImageMime(f.mime, f.name) && f.url);
    return img?.url || "";
  }

  function renderPuntoVentaPhotos(item, media) {
    const all = media || mediaOf(item);
    const files = all.filter((f) => f?.url && isPuntoVentaMedia(f, item) && (isImageMime(f.mime, f.name) || isPdf(f.mime, f.name)));
    if (!files.length) return "";
    const isRotul = materialKind(item) === "rotulacion";
    const heading = isRotul ? "Foto de fachada" : "Foto del punto de venta";
    const tiles = files
      .map((file) => {
        const globalIdx = mediaIndex(all, file);
        const kindLabel = mediaLabel(file, item);
        if (isImageMime(file.mime, file.name)) {
          return `
            <button type="button" class="evidence-item image-tile pv-photo" data-media-index="${globalIdx}">
              <img src="${escapeAttr(file.url)}" alt="${escapeAttr(file.name || kindLabel)}" loading="lazy" />
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
        <span class="field-label">${escapeHtml(heading)}</span>
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
    const d = r.dimensiones || {};
    return [
      {
        title: "Rotulación multimarca",
        permisos: r.permisos,
        clasificacion: r.clasificacion,
        color: r.color,
        versionBastidor: r.versionBastidor,
        cortinaAcceso: d.cortinaAcceso
          ? `${d.cortinaAcceso.alto || "—"} × ${d.cortinaAcceso.ancho || "—"} cm`
          : "",
        paredDerecha: d.paredDerecha
          ? `${d.paredDerecha.alto || "—"} × ${d.paredDerecha.ancho || "—"} cm`
          : "",
        paredIzquierda: d.paredIzquierda
          ? `${d.paredIzquierda.alto || "—"} × ${d.paredIzquierda.ancho || "—"} cm`
          : "",
        marquesina: d.marquesina
          ? `${d.marquesina.alto || "—"} × ${d.marquesina.ancho || "—"} cm`
          : "",
        evidenciaTipo:
          r.evidenciaTipo === "esquina"
            ? "Esquina / contraesquina (2 fotos)"
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
        <span>Por material</span>
        <strong class="stat-sm">L ${counts.lona} · T ${counts.toldo} · C ${counts.caballete} · R ${counts.rotulacion}</strong>
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
          <button type="button" class="request-card${active}" data-index="${i}">
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
            </div>
          </button>`;
      })
      .join("");

    listEl.querySelectorAll(".request-card").forEach((btn) => {
      btn.onclick = () => {
        index = Number(btn.dataset.index) || 0;
        renderList();
        renderDetail();
      };
    });
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
                ["cortinaAcceso", "Cortina / acceso"],
                ["paredDerecha", "Pared derecha"],
                ["paredIzquierda", "Pared izquierda"],
                ["marquesina", "Marquesina"],
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

  function renderDetail() {
    const visible = filteredItems();
    if (!items.length) {
      detailEl.innerHTML = `
        <section class="card empty-card">
          <div class="empty-icon" aria-hidden="true">◎</div>
          <h2>Aún no hay solicitudes</h2>
          <p class="empty-note">
            Este tablero se actualiza cada 2 segundos con las respuestas del formulario
            (Google Sheets + respaldo local). Cuando llegue una solicitud aparecerá aquí
            agrupable por Lona, Toldo, Caballete o Rotulación.
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
    const media = mediaOf(item);
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
              <button type="button" id="deleteBtn" class="delete-btn">Eliminar</button>
            </div>
          </div>
        </header>

        <div class="chip-row">
          ${item.puntoVenta ? `<span class="chip">${escapeHtml(item.puntoVenta)}</span>` : ""}
          ${item.claveYaavser ? `<span class="chip">${escapeHtml(item.claveYaavser)}</span>` : ""}
          ${item.gerenteTerritorial ? `<span class="chip">${escapeHtml(item.gerenteTerritorial)}</span>` : ""}
        </div>

        ${renderMediaGallery(media)}

        ${SECTIONS.map((section) => {
          const body = fieldGrid(section.fields, item);
          const showPvHere =
            section.title === "Punto de venta" && materialKind(item) !== "rotulacion";
          const pvPhotos = showPvHere ? renderPuntoVentaPhotos(item, media) : "";
          if (!body && !pvPhotos) return "";
          return `
            <section class="panel">
              <div class="panel-head"><h3>${escapeHtml(section.title)}</h3></div>
              ${body}
              ${pvPhotos}
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
                ${renderPuntoVentaPhotos(item, media)}
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

    document.getElementById("deleteBtn").onclick = async () => {
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
    lightboxImg.src = file.url;
    lightboxImg.alt = file.name || "Imagen adjunta";
    const kind =
      file.label || (file.kind === "logo" ? "Logotipo" : file.kind === "referencia" ? "Referencia" : "Archivo");
    lightboxCaption.textContent = `${kind}${file.group ? ` · ${file.group}` : ""}${file.name ? ` · ${file.name}` : ""}`;
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
    try {
      const res = await fetch(`/api/responses?ts=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      const next = Array.isArray(data.items) ? data.items : [];
      sheetsConfigured = Boolean(data.sheetsConfigured);

      if (next.length > lastTotal && lastTotal >= 0) index = 0;
      lastTotal = next.length;
      items = next;
      const visible = filteredItems();
      if (index >= visible.length) index = 0;

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
      } · ${formatTime(data.updatedAt)}${sourceLabel}${errLabel}`;

      renderMaterialFilters();
      renderStats();
      renderList();
      renderDetail();
    } catch (_) {
      liveStatus.textContent = "Sin conexión · reintentando…";
    }
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

  refresh();
  setInterval(refresh, 2000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
})();
