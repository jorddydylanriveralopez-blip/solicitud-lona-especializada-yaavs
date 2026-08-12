(() => {
  const statsEl = document.getElementById("stats");
  const detailEl = document.getElementById("detail");
  const liveStatus = document.getElementById("liveStatus");
  let items = [];
  let index = 0;

  const LABELS = [
    ["folio", "Folio"],
    ["receivedAt", "Fecha y hora"],
    ["material", "Material"],
    ["autorizada", "Autorizada"],
    ["gerenteTerritorial", "Gerente territorial"],
    ["coordinador", "Coordinador"],
    ["territorioGerente", "Territorio / estado"],
    ["ejecutivoNombre", "Ejecutivo"],
    ["ejecutivoTelefono", "Tel. ejecutivo"],
    ["ejecutivoCorreo", "Correo ejecutivo"],
    ["yaavserNombre", "YAAVSER"],
    ["claveYaavser", "Clave YAAVSER"],
    ["yaavserTelefono", "Tel. YAAVSER"],
    ["puntoVenta", "Punto de venta"],
    ["tipoEstablecimiento", "Tipo establecimiento"],
    ["tipoEstablecimientoOtro", "Tipo (otro)"],
    ["objetivoLona", "Objetivo"],
    ["resultadoEsperado", "Resultado esperado"],
    ["serviciosActuales", "Servicios"],
    ["cantidadLonas", "Cantidad lonas"],
    ["lonas", "Especificaciones"],
    ["cantidadToldos", "Cantidad toldos"],
    ["toldos", "Especificaciones toldos"],
    ["confirmaciones", "Confirmaciones"],
  ];

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    const d = new Date(iso || "");
    if (Number.isNaN(d.getTime())) return String(iso || "—");
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  }

  function renderStats() {
    statsEl.innerHTML = `
      <div class="stat"><span>Solicitudes</span><strong>${items.length}</strong></div>
      <div class="stat"><span>Último folio</span><strong style="font-size:1.05rem">${escapeHtml(
        items[0]?.folio || "—",
      )}</strong></div>
      <div class="stat"><span>Última clave</span><strong style="font-size:1.05rem">${escapeHtml(
        items[0]?.claveYaavser || "—",
      )}</strong></div>
      <div class="stat"><span>Último gerente</span><strong style="font-size:1.05rem">${escapeHtml(
        items[0]?.gerenteTerritorial || "—",
      )}</strong></div>
    `;
  }

  function renderDetail() {
    if (!items.length) {
      detailEl.innerHTML = `<section class="card"><p class="empty">Aún no hay solicitudes.</p></section>`;
      return;
    }
    const item = items[index] || items[0];
    const rows = LABELS.map(([key, label]) => {
      let val = item[key];
      if (key === "receivedAt") val = formatDate(val);
      if (val == null || String(val).trim() === "") return "";
      return `<div class="row"><b>${escapeHtml(label)}</b><span>${escapeHtml(val)}</span></div>`;
    }).join("");

    detailEl.innerHTML = `
      <section class="card">
        <h2>Solicitud ${index + 1} de ${items.length}</h2>
        <div class="nav">
          <button type="button" id="prevBtn">Anterior</button>
          <button type="button" id="nextBtn">Siguiente</button>
        </div>
        <p class="meta">${escapeHtml(formatDate(item.receivedAt))} · ${escapeHtml(item.id || "")}</p>
        <div class="rows">${rows}</div>
      </section>
    `;

    document.getElementById("prevBtn").onclick = () => {
      index = (index - 1 + items.length) % items.length;
      renderDetail();
    };
    document.getElementById("nextBtn").onclick = () => {
      index = (index + 1) % items.length;
      renderDetail();
    };
  }

  async function refresh() {
    try {
      const res = await fetch("/api/responses", { cache: "no-store" });
      const data = await res.json();
      items = Array.isArray(data.items) ? data.items : [];
      if (index >= items.length) index = 0;
      liveStatus.textContent = `En vivo · ${items.length} solicitud${items.length === 1 ? "" : "es"}`;
      renderStats();
      renderDetail();
    } catch (_) {
      liveStatus.textContent = "Sin conexión";
    }
  }

  refresh();
  setInterval(refresh, 4000);
})();
