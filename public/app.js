(() => {
  const form = document.getElementById("lonaForm");
  const formRest = document.getElementById("formRest");
  const blockNoAuth = document.getElementById("blockNoAuth");
  const successPanel = document.getElementById("successPanel");
  const toast = document.getElementById("toast");
  const hint = document.getElementById("formHint");
  const submitBtn = document.getElementById("submitBtn");
  const lonasSpecs = document.getElementById("lonasSpecs");
  const gerenteInput = document.getElementById("gerenteTerritorial");
  const gerenteHint = document.getElementById("gerenteHint");
  const coordinadorInput = document.getElementById("coordinador");
  const territorioInput = document.getElementById("territorioGerente");
  const yaavserNombre = document.getElementById("yaavserNombre");
  const claveInput = document.getElementById("claveYaavser");
  const yaavserCard = document.getElementById("yaavserCard");
  const lookupDetail = document.getElementById("lookupDetail");

  const ACABADOS = ["Dobladillo", "Ojillos", "Dobladillo y ojillos", "Sin acabados"];
  const ORIENTACIONES = ["Horizontal", "Vertical", "Cuadrada"];

  let lookupTimer = null;
  let lastLookupClave = "";

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function checkedValues(name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((el) => el.value);
  }

  function isAuthorized() {
    const v = form.querySelector('input[name="autorizada"]:checked')?.value || "";
    return v.startsWith("Sí");
  }

  function syncAuthGate() {
    const selected = form.querySelector('input[name="autorizada"]:checked');
    if (!selected) {
      blockNoAuth.hidden = true;
      formRest.hidden = false;
      return;
    }
    if (isAuthorized()) {
      blockNoAuth.hidden = true;
      formRest.hidden = false;
    } else {
      blockNoAuth.hidden = false;
      formRest.hidden = true;
    }
  }

  function lonaCount() {
    const n = Number(form.cantidadLonas.value || 1);
    return Math.min(10, Math.max(1, Number.isFinite(n) ? n : 1));
  }

  function sameDesign() {
    return (form.querySelector('input[name="mismoDiseno"]:checked')?.value || "Sí") === "Sí";
  }

  function renderLonas() {
    const count = sameDesign() ? 1 : lonaCount();
    const blocks = [];
    for (let i = 1; i <= count; i += 1) {
      const title = sameDesign() ? "Especificaciones de la lona" : `Lona ${i}`;
      blocks.push(`
        <div class="lona-block" data-lona="${i}">
          <h3>${escapeHtml(title)}</h3>
          <div class="grid-2">
            <label class="field">
              <span>Ancho (cm) <span class="req">*</span></span>
              <input type="number" min="1" step="1" inputmode="numeric" data-k="ancho" required />
            </label>
            <label class="field">
              <span>Alto (cm) <span class="req">*</span></span>
              <input type="number" min="1" step="1" inputmode="numeric" data-k="alto" required />
            </label>
          </div>
          <fieldset class="choice-group compact" data-required="true">
            <legend>Orientación del diseño <span class="req">*</span></legend>
            ${ORIENTACIONES.map(
              (o) =>
                `<label class="choice"><input type="radio" name="orientacion_${i}" value="${escapeHtml(o)}" required /><span>${escapeHtml(o)}</span></label>`,
            ).join("")}
          </fieldset>
          <fieldset class="choice-group" data-multi="true" data-required="true">
            <legend>Acabados requeridos <span class="req">*</span></legend>
            ${ACABADOS.map(
              (a) =>
                `<label class="choice"><input type="checkbox" name="acabados_${i}" value="${escapeHtml(a)}" /><span>${escapeHtml(a)}</span></label>`,
            ).join("")}
          </fieldset>
        </div>
      `);
    }
    lonasSpecs.innerHTML = blocks.join("");
  }

  function collectLonas() {
    const count = sameDesign() ? 1 : lonaCount();
    const out = [];
    for (let i = 1; i <= count; i += 1) {
      const block = lonasSpecs.querySelector(`[data-lona="${i}"]`);
      if (!block) continue;
      const ancho = block.querySelector('[data-k="ancho"]')?.value;
      const alto = block.querySelector('[data-k="alto"]')?.value;
      const orientacion = form.querySelector(`input[name="orientacion_${i}"]:checked`)?.value || "";
      const acabados = [...form.querySelectorAll(`input[name="acabados_${i}"]:checked`)].map(
        (el) => el.value,
      );
      out.push({
        lona: sameDesign() ? "Única" : `Lona ${i}`,
        ancho: Number(ancho),
        alto: Number(alto),
        orientacion,
        acabados,
      });
    }
    return out;
  }

  async function lookupClave() {
    const raw = String(claveInput.value || "").trim();
    if (raw.length < 5) {
      yaavserCard.hidden = true;
      gerenteHint.textContent = "Al escribir la clave YAAVSER se asigna automáticamente.";
      gerenteHint.classList.remove("ok", "warn");
      return;
    }
    if (raw === lastLookupClave) return;
    lastLookupClave = raw;
    gerenteHint.textContent = "Buscando gerente territorial…";
    gerenteHint.classList.remove("ok", "warn");
    try {
      const res = await fetch(`/api/yaavser/${encodeURIComponent(raw)}`);
      const data = await res.json();
      if (!res.ok || !data.found) {
        yaavserCard.hidden = true;
        if (coordinadorInput) coordinadorInput.value = "";
        if (territorioInput) territorioInput.value = "";
        gerenteHint.textContent =
          "Clave no encontrada en el catálogo. Captura el gerente territorial manualmente.";
        gerenteHint.classList.add("warn");
        gerenteHint.classList.remove("ok");
        return;
      }
      gerenteInput.value = data.gerente || "";
      if (coordinadorInput) coordinadorInput.value = data.coordinador || "";
      if (territorioInput) {
        territorioInput.value = [data.municipio, data.estado].filter(Boolean).join(", ");
      }
      if (data.nombre && !String(yaavserNombre.value || "").trim()) {
        yaavserNombre.value = data.nombre;
      }
      yaavserCard.hidden = false;
      lookupDetail.textContent = [
        data.nombre,
        data.municipio && data.estado ? `${data.municipio}, ${data.estado}` : data.estado || data.municipio,
        data.coordinador ? `Coord.: ${data.coordinador}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      gerenteHint.textContent = "Gerente territorial asignado desde la clave YAAVSER.";
      gerenteHint.classList.add("ok");
      gerenteHint.classList.remove("warn");
    } catch (_) {
      gerenteHint.textContent = "No se pudo consultar el catálogo. Captura el gerente manualmente.";
      gerenteHint.classList.add("warn");
    }
  }

  function scheduleLookup() {
    window.clearTimeout(lookupTimer);
    lookupTimer = window.setTimeout(lookupClave, 350);
  }

  function syncTipoOtro() {
    const on = document.getElementById("tipoOtroChk")?.checked;
    document.getElementById("tipoOtroWrap").hidden = !on;
  }

  function syncContacto() {
    const vals = checkedValues("datosContactoOpciones");
    const ninguno = vals.includes("Ninguno");
    if (ninguno) {
      form.querySelectorAll('input[name="datosContactoOpciones"]').forEach((el) => {
        if (el.value !== "Ninguno") el.checked = false;
      });
    }
    const needs = checkedValues("datosContactoOpciones").some((v) => v !== "Ninguno");
    document.getElementById("contactoDetalleWrap").hidden = !needs;
  }

  function syncReferencia() {
    const yes = form.querySelector('input[name="tieneReferencia"]:checked')?.value === "Sí";
    document.getElementById("referenciaWrap").hidden = !yes;
    document.getElementById("referenciaFile").required = yes;
  }

  function clearInvalid() {
    form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  }

  function markInvalid(el) {
    if (!el) return;
    el.classList.add("is-invalid");
    const group = el.closest(".choice-group, .field, .lona-block");
    if (group) group.classList.add("is-invalid");
  }

  function validate() {
    clearInvalid();
    const errors = [];

    if (!form.querySelector('input[name="autorizada"]:checked')) {
      errors.push("Indica si la solicitud ya fue autorizada.");
      markInvalid(form.querySelector('input[name="autorizada"]'));
    }
    if (!isAuthorized()) {
      errors.push("La solicitud debe estar autorizada para continuar.");
      return errors;
    }

    const requiredText = [
      ["ejecutivoNombre", "Captura el nombre del ejecutivo."],
      ["ejecutivoTelefono", "Captura el teléfono del ejecutivo."],
      ["ejecutivoCorreo", "Captura el correo del ejecutivo."],
      ["yaavserNombre", "Captura el nombre del YAAVSER."],
      ["claveYaavser", "Captura la clave YAAVSER."],
      ["gerenteTerritorial", "Captura o confirma el gerente territorial."],
      ["yaavserTelefono", "Captura el teléfono del YAAVSER."],
      ["puntoVenta", "Captura el nombre del punto de venta."],
    ];
    for (const [name, msg] of requiredText) {
      const el = form.elements[name];
      if (!el || !String(el.value || "").trim()) {
        errors.push(msg);
        markInvalid(el);
      }
    }

    const email = String(form.ejecutivoCorreo.value || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Revisa el correo electrónico corporativo.");
      markInvalid(form.ejecutivoCorreo);
    }

    const multiRequired = [
      ["tipoEstablecimiento", "Selecciona el tipo de establecimiento."],
      ["objetivoLona", "Selecciona el objetivo de la lona."],
      ["resultadoEsperado", "Selecciona el resultado esperado."],
      ["serviciosActuales", "Selecciona los servicios actuales."],
      ["marcas", "Selecciona al menos una marca."],
      ["datosContactoOpciones", "Selecciona los datos de contacto a mostrar."],
      ["confirmaciones", "Debes aceptar las tres confirmaciones."],
    ];
    for (const [name, msg] of multiRequired) {
      const vals = checkedValues(name);
      if (!vals.length) {
        errors.push(msg);
        markInvalid(form.querySelector(`input[name="${name}"]`));
      }
    }

    if (checkedValues("confirmaciones").length < 3) {
      errors.push("Debes aceptar las tres confirmaciones.");
    }

    if (document.getElementById("tipoOtroChk")?.checked) {
      if (!String(form.tipoEstablecimientoOtro.value || "").trim()) {
        errors.push("Especifica el tipo de establecimiento.");
        markInvalid(form.tipoEstablecimientoOtro);
      }
    }

    const contactoNeeds = checkedValues("datosContactoOpciones").some((v) => v !== "Ninguno");
    if (contactoNeeds && !String(form.datosContactoDetalle.value || "").trim()) {
      errors.push("Captura los datos de contacto que deben aparecer.");
      markInvalid(form.datosContactoDetalle);
    }

    const lonas = collectLonas();
    if (!lonas.length) {
      errors.push("Completa las especificaciones de la lona.");
    }
    lonas.forEach((l, idx) => {
      const i = idx + 1;
      const block = lonasSpecs.querySelector(`[data-lona="${i}"]`);
      if (!l.ancho || !l.alto) {
        errors.push(`Captura ancho y alto de ${l.lona}.`);
        markInvalid(block);
      }
      if (!l.orientacion) {
        errors.push(`Selecciona la orientación de ${l.lona}.`);
        markInvalid(block);
      }
      if (!l.acabados.length) {
        errors.push(`Selecciona acabados de ${l.lona}.`);
        markInvalid(block);
      }
    });

    if (!form.logo.files?.length) {
      errors.push("Adjunta el logotipo del punto de venta.");
      markInvalid(form.logo);
    }

    if (form.querySelector('input[name="tieneReferencia"]:checked')?.value === "Sí") {
      if (!form.referencia.files?.length) {
        errors.push("Adjunta el diseño o referencia anterior.");
        markInvalid(form.referencia);
      }
    }

    return [...new Set(errors)];
  }

  function buildAnswers() {
    return {
      autorizada: form.querySelector('input[name="autorizada"]:checked')?.value || "",
      gerenteTerritorial: String(form.gerenteTerritorial.value || "").trim(),
      coordinador: String(form.coordinador?.value || "").trim(),
      territorioGerente: String(form.territorioGerente?.value || "").trim(),
      ejecutivoNombre: String(form.ejecutivoNombre.value || "").trim(),
      ejecutivoTelefono: String(form.ejecutivoTelefono.value || "").trim(),
      ejecutivoCorreo: String(form.ejecutivoCorreo.value || "").trim(),
      yaavserNombre: String(form.yaavserNombre.value || "").trim(),
      claveYaavser: String(form.claveYaavser.value || "").trim().toUpperCase(),
      yaavserTelefono: String(form.yaavserTelefono.value || "").trim(),
      puntoVenta: String(form.puntoVenta.value || "").trim(),
      tipoEstablecimiento: checkedValues("tipoEstablecimiento"),
      tipoEstablecimientoOtro: String(form.tipoEstablecimientoOtro.value || "").trim(),
      objetivoLona: checkedValues("objetivoLona"),
      resultadoEsperado: checkedValues("resultadoEsperado"),
      serviciosActuales: checkedValues("serviciosActuales"),
      cantidadLonas: lonaCount(),
      mismoDiseno: sameDesign() ? "Sí" : "No",
      lonas: collectLonas(),
      marcas: checkedValues("marcas"),
      textoPrincipal: String(form.textoPrincipal.value || "").trim(),
      datosContactoOpciones: checkedValues("datosContactoOpciones"),
      datosContactoDetalle: String(form.datosContactoDetalle.value || "").trim(),
      tieneReferencia: form.querySelector('input[name="tieneReferencia"]:checked')?.value || "No",
      confirmaciones: checkedValues("confirmaciones"),
    };
  }

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.name === "autorizada") syncAuthGate();
    if (t.name === "mismoDiseno" || t.name === "cantidadLonas") renderLonas();
    if (t.name === "tipoEstablecimiento") syncTipoOtro();
    if (t.name === "datosContactoOpciones") syncContacto();
    if (t.name === "tieneReferencia") syncReferencia();
  });

  form.cantidadLonas.addEventListener("input", renderLonas);
  claveInput.addEventListener("input", scheduleLookup);
  claveInput.addEventListener("blur", lookupClave);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (hint) hint.textContent = "";
    const errors = validate();
    if (errors.length) {
      if (hint) hint.textContent = errors[0];
      showToast(errors[0]);
      const first = form.querySelector(".is-invalid");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";
    try {
      const fd = new FormData();
      fd.append("answers", JSON.stringify(buildAnswers()));
      if (form.logo.files?.[0]) fd.append("logo", form.logo.files[0]);
      if (
        form.querySelector('input[name="tieneReferencia"]:checked')?.value === "Sí" &&
        form.referencia.files?.[0]
      ) {
        fd.append("referencia", form.referencia.files[0]);
      }
      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo enviar");
      form.hidden = true;
      successPanel.hidden = false;
      document.getElementById("successFolio").textContent = data.folio || "—";
      successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showToast(err.message || "Error al enviar");
      if (hint) hint.textContent = err.message || "Error al enviar";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar solicitud";
    }
  });

  document.getElementById("newRequestBtn")?.addEventListener("click", () => {
    window.location.reload();
  });

  renderLonas();
  syncAuthGate();
  syncTipoOtro();
  syncContacto();
  syncReferencia();
})();
