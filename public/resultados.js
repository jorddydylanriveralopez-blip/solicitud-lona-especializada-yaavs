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
        ["tipoEstablecimiento", "Tipo"],
        ["tipoEstablecimientoOtro", "Tipo (otro)"],
        ["objetivoLona", "Objetivo"],
        ["resultadoEsperado", "Resultado esperado"],
        ["serviciosActuales", "Servicios actuales"],
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

  function materialKind(item) {
    const m = String(item?.material || "").toLowerCase();
    if (m.includes("toldo")) return "toldo";
    if (m.includes("caballete")) return "caballete";
    return "lona";
  }

  function materialLabel(item) {
    const m = String(item?.material || "").trim();
    return m || "Sin material";
  }

  function isImageMime(mime, name) {
    const m = String(mime || "").toLowerCase();
    if (m.startsWith("image/")) return true;
    return /\.(jpe?g|png|webp|gif)$/i.test(String(name || ""));
  }

  function isPdf(mime, name) {
    const m = String(mime || "").toLowerCase();
    return m.includes("pdf") || /\.pdf$/i.test(String(name || ""));
  }

  function mediaOf(item) {
    if (Array.isArray(item?.media) && item.media.length) return item.media;
    return [];
  }

  function firstThumb(item) {
    const img = mediaOf(item).find((f) => isImageMime(f.mime, f.name) && f.url);
    return img?.url || "";
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

  function renderStats() {
    const latest = items[0];
    const withMedia = items.filter((it) => mediaOf(it).length).length;
    statsEl.innerHTML = `
      <div class="stat stat-accent">
        <span>Solicitudes</span>
        <strong>${items.length}</strong>
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
        <span>Punto de venta</span>
        <strong class="stat-sm">${escapeHtml(latest?.puntoVenta || "—")}</strong>
      </div>
    `;
  }

  function renderList() {
    if (!items.length) {
      listEl.innerHTML = `<p class="list-empty">Sin solicitudes</p>`;
      return;
    }
    listEl.innerHTML = items
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
                  : `<span class="request-card-placeholder ${kind}">${kind === "toldo" ? "T" : kind === "caballete" ? "C" : "L"}</span>`
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

  function fieldGrid(fields, item) {
    const rows = fields
      .map(([key, label]) => {
        const val = item[key];
        if (val == null || String(val).trim() === "") return "";
        return `
          <div class="field">
            <span class="field-label">${escapeHtml(label)}</span>
            <span class="field-value">${escapeHtml(val)}</span>
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
              ["acabados", "Acabados"],
              ["marcas", "Marcas"],
              ["textoPrincipal", "Texto principal"],
              ["datosContactoOpciones", "Contacto"],
              ["datosContactoDetalle", "Detalle contacto"],
              ["tieneReferencia", "Referencia previa"],
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
            <h4>${escapeHtml(spec.title || (type === "toldo" ? "Toldo" : type === "caballete" ? "Caballete" : "Lona"))}</h4>
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

  function renderMediaGallery(media) {
    if (!media.length) {
      return `
        <section class="panel media-panel">
          <div class="panel-head">
            <h3>Archivos adjuntos</h3>
          </div>
          <p class="empty-evidence">No hay archivos disponibles para esta solicitud.</p>
          <p class="empty-note">Los archivos nuevos se guardan en Google Drive y aparecen aquí automáticamente.</p>
        </section>`;
    }

    const groups = new Map();
    media.forEach((file) => {
      const key = file.group || "General";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(file);
    });

    const blocks = [...groups.entries()]
      .map(([group, files]) => {
        const tiles = files
          .map((file, i) => {
            const globalIdx = media.indexOf(file);
            const kindLabel =
              file.label || (file.kind === "logo" ? "Logotipo" : file.kind === "referencia" ? "Referencia" : "Archivo");
            if (isImageMime(file.mime, file.name)) {
              return `
                <button type="button" class="evidence-item image-tile" data-media-index="${globalIdx}">
                  <img src="${escapeAttr(file.url)}" alt="${escapeAttr(file.name)}" loading="lazy" />
                  <span>${escapeHtml(kindLabel)}</span>
                </button>`;
            }
            if (isPdf(file.mime, file.name)) {
              return `
                <a class="evidence-item file-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener">
                  <div class="evidence-file-tile">PDF</div>
                  <span>${escapeHtml(file.name || kindLabel)}</span>
                </a>`;
            }
            return `
              <a class="evidence-item file-tile" href="${escapeAttr(file.url)}" target="_blank" rel="noopener">
                <div class="evidence-file-tile">DOC</div>
                <span>${escapeHtml(file.name || kindLabel)}</span>
              </a>`;
          })
          .join("");
        return `
          <div class="evidence-block">
            <h4>${escapeHtml(group)}</h4>
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
        <div class="evidence-blocks">${blocks}</div>
      </section>`;
  }

  function renderDetail() {
    if (!items.length) {
      detailEl.innerHTML = `
        <section class="card empty-card">
          <div class="empty-icon" aria-hidden="true">◎</div>
          <h2>Aún no hay solicitudes</h2>
          <p class="empty-note">
            Este tablero se actualiza cada 2 segundos leyendo Google Sheets y respuestas locales.
            Cuando llegue una nueva solicitud aparecerá aquí con sus imágenes.
          </p>
          <a class="cta-link" href="./">Ir al formulario</a>
        </section>`;
      return;
    }

    const item = items[index] || items[0];
    const kind = materialKind(item);
    const media = mediaOf(item);
    const lonas = specsLonas(item);
    const toldos = specsToldos(item);
    const caballetes = specsCaballetes(item);
    const confirmaciones = String(item.confirmaciones || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    detailEl.innerHTML = `
      <article class="detail-card">
        <header class="detail-hero">
          <div>
            <p class="detail-kicker">Solicitud ${index + 1} de ${items.length}</p>
            <h2>${escapeHtml(item.folio || "Sin folio")}</h2>
            <p class="detail-meta">${escapeHtml(formatDate(item.receivedAt))}</p>
          </div>
          <div class="detail-hero-actions">
            <span class="badge large ${kind}">${escapeHtml(materialLabel(item))}</span>
            <div class="nav">
              <button type="button" id="prevBtn">← Anterior</button>
              <button type="button" id="nextBtn">Siguiente →</button>
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
      index = (index - 1 + items.length) % items.length;
      renderList();
      renderDetail();
    };
    document.getElementById("nextBtn").onclick = () => {
      index = (index + 1) % items.length;
      renderList();
      renderDetail();
    };

    detailEl.querySelectorAll("[data-media-index]").forEach((btn) => {
      btn.onclick = () => openLightbox(media, Number(btn.dataset.mediaIndex) || 0);
    });
  }

  function openLightbox(media, startIndex) {
    lightboxMedia = media.filter((f) => isImageMime(f.mime, f.name) && f.url);
    if (!lightboxMedia.length) return;
    lightboxIndex = lightboxMedia.findIndex((f) => f === media[startIndex]);
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
      if (index >= items.length) index = 0;

      const source = data.source || (sheetsConfigured ? "sheets" : "local");
      const sourceLabel =
        source === "sheets+local"
          ? " · Tablero + Sheets"
          : sheetsConfigured
            ? " · Solo local"
            : "";
      const errLabel = data.sheetsError ? " · Sync Sheets pendiente" : "";
      liveStatus.textContent = `En vivo · ${items.length} solicitud${
        items.length === 1 ? "" : "es"
      } · ${formatTime(data.updatedAt)}${sourceLabel}${errLabel}`;

      renderStats();
      renderList();
      renderDetail();
    } catch (_) {
      liveStatus.textContent = "Sin conexión · reintentando…";
    }
  }

  refresh();
  setInterval(refresh, 2000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
})();
