(() => {
  const form = document.getElementById("lonaForm");
  const afterMaterial = document.getElementById("afterMaterial");
  const formRest = document.getElementById("formRest");
  const blockNoAuth = document.getElementById("blockNoAuth");
  const flowLona = document.getElementById("flowLona");
  const flowToldo = document.getElementById("flowToldo");
  const flowCaballete = document.getElementById("flowCaballete");
  const successPanel = document.getElementById("successPanel");
  const toast = document.getElementById("toast");
  const hint = document.getElementById("formHint");
  const submitBtn = document.getElementById("submitBtn");
  const lonasSpecs = document.getElementById("lonasSpecs");
  const toldosSpecs = document.getElementById("toldosSpecs");
  const caballetesSpecs = document.getElementById("caballetesSpecs");
  const heroTitle = document.getElementById("heroTitle");
  const heroLede = document.getElementById("heroLede");
  const objetivoLegend = document.getElementById("objetivoLegend");

  const ACABADOS = ["Dobladillo", "Ojillos", "Dobladillo y ojillos", "Sin acabados"];
  const ORIENTACIONES = ["Horizontal", "Vertical", "Cuadrada"];
  const TIPOS_TOLDO = ["Toldo", "Cortina desplegable"];
  const CARAS_CABALLETE = ["Una cara", "Dos caras"];

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

  function selectedMaterial() {
    return form.querySelector('input[name="material"]:checked')?.value || "";
  }

  function isLona() {
    return selectedMaterial() === "Lona";
  }

  function isToldo() {
    return selectedMaterial() === "Toldo";
  }

  function isCaballete() {
    return selectedMaterial() === "Caballete";
  }

  function materialCopy() {
    const mat = selectedMaterial();
    if (mat === "Toldo") {
      return {
        title: "Solicitud de diseño y producción de toldo",
        objetivo: '¿Cuál es el objetivo principal del toldo? <span class="req">*</span>',
      };
    }
    if (mat === "Caballete") {
      return {
        title: "Solicitud de diseño y producción de caballete",
        objetivo: '¿Cuál es el objetivo principal del caballete? <span class="req">*</span>',
      };
    }
    return {
      title: "Solicitud de diseño y producción de lona especializada",
      objetivo: '¿Cuál es el objetivo principal de la lona? <span class="req">*</span>',
    };
  }

  function isAuthorized() {
    const v = form.querySelector('input[name="autorizada"]:checked')?.value || "";
    return v.startsWith("Sí");
  }

  function syncMaterial() {
    const mat = selectedMaterial();
    afterMaterial.hidden = !mat;
    if (!mat) {
      formRest.hidden = true;
      return;
    }

    const copy = materialCopy();
    if (heroTitle) heroTitle.textContent = copy.title;
    if (heroLede) {
      heroLede.textContent =
        "Completa este formulario el ejecutivo de ventas YAAVSTAR junto con el YAAVSER. Verifica medidas exactas, información vigente y autorización del gerente territorial.";
    }
    if (objetivoLegend) objetivoLegend.innerHTML = copy.objetivo;

    flowLona.hidden = mat !== "Lona";
    flowToldo.hidden = mat !== "Toldo";
    flowCaballete.hidden = mat !== "Caballete";
    renderLonas();
    renderToldos();
    renderCaballetes();
    syncAuthGate();
  }

  function syncAuthGate() {
    if (!selectedMaterial()) {
      blockNoAuth.hidden = true;
      formRest.hidden = true;
      return;
    }
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
    return Number(form.querySelector('input[name="cantidadLonas"]:checked')?.value || 1) === 2 ? 2 : 1;
  }

  function toldoCount() {
    return Number(form.querySelector('input[name="cantidadToldos"]:checked')?.value || 1) === 2 ? 2 : 1;
  }

  function caballeteCount() {
    return Number(form.querySelector('input[name="cantidadCaballetes"]:checked')?.value || 1) === 2 ? 2 : 1;
  }

  const MARCAS = ["AT&T", "Movistar", "Unefon", "BAIT", "Telcel"];
  const CONTACTO_OPTS = [
    "Número telefónico",
    "WhatsApp",
    "Redes sociales",
    "Dirección",
    "Ninguno",
  ];

  function fileFieldHtml(label, name, required = false, accept = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf") {
    return `
      <label class="field file-field">
        <span>${label}${required ? ' <span class="req">*</span>' : ""}</span>
        <div class="file-drop">
          <input type="file" name="${name}" accept="${accept}" data-preview />
          <div class="file-drop-copy">
            <strong>Sube o selecciona un archivo</strong>
            <small>JPG, PNG o PDF</small>
          </div>
          <div class="file-preview" hidden>
            <div class="file-preview-media"></div>
            <div class="file-preview-meta">
              <strong class="file-preview-name"></strong>
              <small class="file-preview-size"></small>
            </div>
          </div>
        </div>
      </label>
    `;
  }

  function designFieldsHtml(prefix, i) {
    return `
      <div class="design-block">
        <h4>Contenido y diseño</h4>
        ${fileFieldHtml("Logotipo del punto de venta", `logo_${prefix}_${i}`, true)}
        <fieldset class="choice-group" data-multi="true">
          <legend>Marcas principales que deberán aparecer <span class="req">*</span></legend>
          <p class="multi-hint">Puedes elegir más de una respuesta.</p>
          ${MARCAS.map(
            (m) =>
              `<label class="choice"><input type="checkbox" name="marcas_${prefix}_${i}" value="${escapeHtml(m)}" /><span>${escapeHtml(m)}</span></label>`,
          ).join("")}
        </fieldset>
        <label class="field">
          <span>Texto principal o mensaje que se desea comunicar</span>
          <textarea name="texto_${prefix}_${i}" rows="3" placeholder="Opcional. Mercadotecnia podrá ajustar el texto."></textarea>
        </label>
        <fieldset class="choice-group" data-multi="true">
          <legend>Datos de contacto que deberán aparecer <span class="req">*</span></legend>
          <p class="multi-hint">Puedes elegir más de una respuesta.</p>
          ${CONTACTO_OPTS.map(
            (c) =>
              `<label class="choice"><input type="checkbox" name="contacto_${prefix}_${i}" value="${escapeHtml(c)}" data-contacto="${prefix}_${i}" /><span>${escapeHtml(c)}</span></label>`,
          ).join("")}
        </fieldset>
        <label class="field" data-contacto-detalle="${prefix}_${i}" hidden>
          <span>Captura los datos de contacto <span class="req">*</span></span>
          <textarea name="contactoDetalle_${prefix}_${i}" rows="3" placeholder="Teléfono, WhatsApp, redes, dirección…"></textarea>
        </label>
        <fieldset class="choice-group compact">
          <legend>¿Existe un diseño anterior como referencia? <span class="req">*</span></legend>
          <label class="choice"><input type="radio" name="referencia_${prefix}_${i}" value="Sí" data-ref="${prefix}_${i}" /><span>Sí</span></label>
          <label class="choice"><input type="radio" name="referencia_${prefix}_${i}" value="No" checked data-ref="${prefix}_${i}" /><span>No</span></label>
        </fieldset>
        <div data-ref-wrap="${prefix}_${i}" hidden>
          ${fileFieldHtml("Adjunta el diseño o referencia anterior", `referenciaFile_${prefix}_${i}`, true)}
        </div>
      </div>
    `;
  }

  function formatBytes(n) {
    if (!n && n !== 0) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function bindFilePreviews(root = form) {
    root.querySelectorAll('input[type="file"][data-preview]').forEach((input) => {
      if (input.dataset.previewBound === "1") return;
      input.dataset.previewBound = "1";
      const drop = input.closest(".file-drop");
      const preview = drop?.querySelector(".file-preview");
      const copy = drop?.querySelector(".file-drop-copy");
      const media = preview?.querySelector(".file-preview-media");
      const nameEl = preview?.querySelector(".file-preview-name");
      const sizeEl = preview?.querySelector(".file-preview-size");
      let objectUrl = "";

      const clearPreview = () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = "";
        }
        if (media) media.innerHTML = "";
        if (preview) preview.hidden = true;
        if (copy) copy.hidden = false;
        drop?.classList.remove("has-file");
      };

      input.addEventListener("change", () => {
        clearPreview();
        const file = input.files?.[0];
        if (!file || !preview || !media || !nameEl || !sizeEl) return;
        nameEl.textContent = file.name;
        sizeEl.textContent = formatBytes(file.size);
        const isImage = /^image\//.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        if (isImage) {
          objectUrl = URL.createObjectURL(file);
          media.innerHTML = `<img src="${objectUrl}" alt="Vista previa" />`;
        } else if (isPdf) {
          media.innerHTML = `<div class="file-doc-badge" aria-hidden="true">PDF</div>`;
        } else {
          media.innerHTML = `<div class="file-doc-badge" aria-hidden="true">DOC</div>`;
        }
        preview.hidden = false;
        if (copy) copy.hidden = true;
        drop?.classList.add("has-file");
      });
    });
  }

  function renderLonas() {
    if (!lonasSpecs) return;
    const count = lonaCount();
    const blocks = [];
    for (let i = 1; i <= count; i += 1) {
      const title = count === 1 ? "Lona" : `Lona ${i}`;
      blocks.push(`
        <div class="lona-block" data-lona="${i}">
          <h3>${escapeHtml(title)}</h3>
          <div class="grid-2">
            <label class="field">
              <span>Ancho (cm) <span class="req">*</span></span>
              <input type="number" min="1" step="1" inputmode="numeric" data-k="ancho" />
            </label>
            <label class="field">
              <span>Alto (cm) <span class="req">*</span></span>
              <input type="number" min="1" step="1" inputmode="numeric" data-k="alto" />
            </label>
          </div>
          <fieldset class="choice-group compact">
            <legend>Orientación del diseño <span class="req">*</span></legend>
            ${ORIENTACIONES.map(
              (o) =>
                `<label class="choice"><input type="radio" name="orientacion_${i}" value="${escapeHtml(o)}" /><span>${escapeHtml(o)}</span></label>`,
            ).join("")}
          </fieldset>
          <fieldset class="choice-group" data-multi="true">
            <legend>Acabados requeridos <span class="req">*</span></legend>
            <p class="multi-hint">Puedes elegir más de una respuesta.</p>
            ${ACABADOS.map(
              (a) =>
                `<label class="choice"><input type="checkbox" name="acabados_${i}" value="${escapeHtml(a)}" /><span>${escapeHtml(a)}</span></label>`,
            ).join("")}
          </fieldset>
          ${designFieldsHtml("lona", i)}
        </div>
      `);
    }
    lonasSpecs.innerHTML = blocks.join("");
    bindFilePreviews(lonasSpecs);
  }

  function renderToldos() {
    if (!toldosSpecs) return;
    const count = toldoCount();
    const blocks = [];
    for (let i = 1; i <= count; i += 1) {
      const title = count === 1 ? "Toldo / cortina" : `Toldo / cortina ${i}`;
      blocks.push(`
        <div class="lona-block" data-toldo="${i}">
          <h3>${escapeHtml(title)}</h3>
          <div class="design-block">
            <h4>Ubicación del toldo</h4>
            <label class="field">
              <span>Enlace de Google Maps <span class="req">*</span></span>
              <input
                type="url"
                name="ubicacionMaps_${i}"
                data-k="ubicacionMaps"
                inputmode="url"
                placeholder="Pega aquí el link de Google Maps"
              />
              <small class="help">Abre Google Maps, comparte la ubicación del punto de venta y pega el enlace.</small>
            </label>
            ${fileFieldHtml(
              "Foto del punto de venta o ubicación del toldo",
              `fotoUbicacion_toldo_${i}`,
              true,
              ".jpg,.jpeg,.png,image/jpeg,image/png",
            )}
          </div>
          <fieldset class="choice-group compact">
            <legend>Tipo <span class="req">*</span></legend>
            ${TIPOS_TOLDO.map(
              (t) =>
                `<label class="choice"><input type="radio" name="tipoToldo_${i}" value="${escapeHtml(t)}" /><span>${escapeHtml(t)}</span></label>`,
            ).join("")}
          </fieldset>
          <div class="grid-2">
            <label class="field">
              <span>Ancho (cm) <span class="req">*</span></span>
              <input type="number" min="1" step="1" inputmode="numeric" data-k="ancho" />
            </label>
            <label class="field">
              <span>Profundidad / largo (cm) <span class="req">*</span></span>
              <input type="number" min="1" step="1" inputmode="numeric" data-k="largo" />
            </label>
            <label class="field">
              <span>Alto (cm) <span class="req">*</span></span>
              <input type="number" min="1" step="1" inputmode="numeric" data-k="alto" />
            </label>
            <fieldset class="choice-group compact">
              <legend>¿Incluye estructura? <span class="req">*</span></legend>
              <label class="choice"><input type="radio" name="estructura_${i}" value="Sí" /><span>Sí</span></label>
              <label class="choice"><input type="radio" name="estructura_${i}" value="No" checked /><span>No</span></label>
            </fieldset>
          </div>
          ${designFieldsHtml("toldo", i)}
        </div>
      `);
    }
    toldosSpecs.innerHTML = blocks.join("");
    bindFilePreviews(toldosSpecs);
  }

  function renderCaballetes() {
    if (!caballetesSpecs) return;
    const count = caballeteCount();
    const blocks = [];
    for (let i = 1; i <= count; i += 1) {
      const title = count === 1 ? "Caballete" : `Caballete ${i}`;
      blocks.push(`
        <div class="lona-block" data-caballete="${i}">
          <h3>${escapeHtml(title)}</h3>
          <div class="grid-2">
            <label class="field">
              <span>Ancho (cm) <span class="req">*</span></span>
              <input type="number" min="1" step="1" inputmode="numeric" data-k="ancho" />
            </label>
            <label class="field">
              <span>Alto (cm) <span class="req">*</span></span>
              <input type="number" min="1" step="1" inputmode="numeric" data-k="alto" />
            </label>
          </div>
          <fieldset class="choice-group compact">
            <legend>Caras a imprimir <span class="req">*</span></legend>
            ${CARAS_CABALLETE.map(
              (c) =>
                `<label class="choice"><input type="radio" name="caras_${i}" value="${escapeHtml(c)}" /><span>${escapeHtml(c)}</span></label>`,
            ).join("")}
          </fieldset>
          <fieldset class="choice-group compact">
            <legend>Orientación del diseño <span class="req">*</span></legend>
            ${ORIENTACIONES.map(
              (o) =>
                `<label class="choice"><input type="radio" name="orientacionCab_${i}" value="${escapeHtml(o)}" /><span>${escapeHtml(o)}</span></label>`,
            ).join("")}
          </fieldset>
          <fieldset class="choice-group" data-multi="true">
            <legend>Acabados requeridos <span class="req">*</span></legend>
            <p class="multi-hint">Puedes elegir más de una respuesta.</p>
            ${ACABADOS.map(
              (a) =>
                `<label class="choice"><input type="checkbox" name="acabadosCab_${i}" value="${escapeHtml(a)}" /><span>${escapeHtml(a)}</span></label>`,
            ).join("")}
          </fieldset>
          ${designFieldsHtml("caballete", i)}
        </div>
      `);
    }
    caballetesSpecs.innerHTML = blocks.join("");
    bindFilePreviews(caballetesSpecs);
  }

  function collectDesign(prefix, i) {
    const marcas = [...form.querySelectorAll(`input[name="marcas_${prefix}_${i}"]:checked`)].map(
      (el) => el.value,
    );
    const contacto = [...form.querySelectorAll(`input[name="contacto_${prefix}_${i}"]:checked`)].map(
      (el) => el.value,
    );
    return {
      marcas,
      textoPrincipal: String(form[`texto_${prefix}_${i}`]?.value || "").trim(),
      datosContactoOpciones: contacto,
      datosContactoDetalle: String(form[`contactoDetalle_${prefix}_${i}`]?.value || "").trim(),
      tieneReferencia:
        form.querySelector(`input[name="referencia_${prefix}_${i}"]:checked`)?.value || "No",
    };
  }

  function collectLonas() {
    if (!isLona()) return [];
    const count = lonaCount();
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
        lona: count === 1 ? "Lona 1" : `Lona ${i}`,
        ancho: Number(ancho),
        alto: Number(alto),
        orientacion,
        acabados,
        ...collectDesign("lona", i),
      });
    }
    return out;
  }

  function collectToldos() {
    if (!isToldo()) return [];
    const count = toldoCount();
    const out = [];
    for (let i = 1; i <= count; i += 1) {
      const block = toldosSpecs.querySelector(`[data-toldo="${i}"]`);
      if (!block) continue;
      const tipo = form.querySelector(`input[name="tipoToldo_${i}"]:checked`)?.value || "";
      out.push({
        toldo: count === 1 ? "Toldo 1" : `Toldo ${i}`,
        tipo,
        ubicacionMaps: String(block.querySelector('[data-k="ubicacionMaps"]')?.value || "").trim(),
        ancho: Number(block.querySelector('[data-k="ancho"]')?.value || 0),
        largo: Number(block.querySelector('[data-k="largo"]')?.value || 0),
        alto: Number(block.querySelector('[data-k="alto"]')?.value || 0),
        incluyeEstructura:
          form.querySelector(`input[name="estructura_${i}"]:checked`)?.value || "",
        ...collectDesign("toldo", i),
      });
    }
    return out;
  }

  function collectCaballetes() {
    if (!isCaballete()) return [];
    const count = caballeteCount();
    const out = [];
    for (let i = 1; i <= count; i += 1) {
      const block = caballetesSpecs.querySelector(`[data-caballete="${i}"]`);
      if (!block) continue;
      const acabados = [...form.querySelectorAll(`input[name="acabadosCab_${i}"]:checked`)].map(
        (el) => el.value,
      );
      out.push({
        caballete: count === 1 ? "Caballete 1" : `Caballete ${i}`,
        ancho: Number(block.querySelector('[data-k="ancho"]')?.value || 0),
        alto: Number(block.querySelector('[data-k="alto"]')?.value || 0),
        caras: form.querySelector(`input[name="caras_${i}"]:checked`)?.value || "",
        orientacion: form.querySelector(`input[name="orientacionCab_${i}"]:checked`)?.value || "",
        acabados,
        ...collectDesign("caballete", i),
      });
    }
    return out;
  }

  function syncTipoOtro() {
    const on = document.getElementById("tipoOtroChk")?.checked;
    document.getElementById("tipoOtroWrap").hidden = !on;
  }

  function syncContacto() {
    const keys = new Set();
    form.querySelectorAll("[data-contacto]").forEach((el) => keys.add(el.getAttribute("data-contacto")));
    keys.forEach((key) => {
      const vals = [...form.querySelectorAll(`input[data-contacto="${key}"]:checked`)].map(
        (el) => el.value,
      );
      if (vals.includes("Ninguno")) {
        form.querySelectorAll(`input[data-contacto="${key}"]`).forEach((el) => {
          if (el.value !== "Ninguno") el.checked = false;
        });
      }
      const needs = [...form.querySelectorAll(`input[data-contacto="${key}"]:checked`)].some(
        (el) => el.value !== "Ninguno",
      );
      const wrap = form.querySelector(`[data-contacto-detalle="${key}"]`);
      if (wrap) wrap.hidden = !needs;
    });
  }

  function syncReferencia() {
    form.querySelectorAll("[data-ref]").forEach((el) => {
      const key = el.getAttribute("data-ref");
      const yes =
        form.querySelector(`input[name="referencia_${key}"]:checked`)?.value === "Sí";
      const wrap = form.querySelector(`[data-ref-wrap="${key}"]`);
      if (wrap) wrap.hidden = !yes;
    });
  }

  function validateDesign(prefix, i, label, errors) {
    const logoInput = form.querySelector(`input[name="logo_${prefix}_${i}"]`);
    if (!logoInput?.files?.length) {
      errors.push(`Adjunta el logotipo de ${label}.`);
      markInvalid(logoInput);
    }
    const marcas = [...form.querySelectorAll(`input[name="marcas_${prefix}_${i}"]:checked`)];
    if (!marcas.length) {
      errors.push(`Selecciona marcas de ${label}.`);
      markInvalid(form.querySelector(`input[name="marcas_${prefix}_${i}"]`));
    }
    const contacto = [...form.querySelectorAll(`input[name="contacto_${prefix}_${i}"]:checked`)].map(
      (el) => el.value,
    );
    if (!contacto.length) {
      errors.push(`Selecciona datos de contacto de ${label}.`);
      markInvalid(form.querySelector(`input[name="contacto_${prefix}_${i}"]`));
    }
    if (contacto.some((v) => v !== "Ninguno")) {
      if (!String(form[`contactoDetalle_${prefix}_${i}`]?.value || "").trim()) {
        errors.push(`Captura los datos de contacto de ${label}.`);
        markInvalid(form[`contactoDetalle_${prefix}_${i}`]);
      }
    }
    const ref = form.querySelector(`input[name="referencia_${prefix}_${i}"]:checked`)?.value;
    if (!ref) {
      errors.push(`Indica si hay referencia de diseño en ${label}.`);
      markInvalid(form.querySelector(`input[name="referencia_${prefix}_${i}"]`));
    }
    if (ref === "Sí") {
      const refFile = form.querySelector(`input[name="referenciaFile_${prefix}_${i}"]`);
      if (!refFile?.files?.length) {
        errors.push(`Adjunta la referencia de ${label}.`);
        markInvalid(refFile);
      }
    }
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

    if (!selectedMaterial()) {
      errors.push("Selecciona el material a solicitar.");
      markInvalid(form.querySelector('input[name="material"]'));
      return errors;
    }

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
      ["yaavserNombre", "Captura el nombre del YAAVSER."],
      ["claveYaavser", "Captura la clave YAAVSER."],
      ["puntoVenta", "Captura el nombre del punto de venta."],
    ];
    for (const [name, msg] of requiredText) {
      const el = form.elements[name];
      if (!el || !String(el.value || "").trim()) {
        errors.push(msg);
        markInvalid(el);
      }
    }

    const multiRequired = [
      ["tipoEstablecimiento", "Selecciona el tipo de establecimiento."],
      ["objetivoLona", "Selecciona el objetivo del material."],
      ["resultadoEsperado", "Selecciona el resultado esperado."],
      ["serviciosActuales", "Selecciona los servicios actuales."],
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

    if (isLona()) {
      if (!form.querySelector('input[name="cantidadLonas"]:checked')) {
        errors.push("Selecciona si solicitas 1 o 2 lonas.");
        markInvalid(form.querySelector('input[name="cantidadLonas"]'));
      }
      const lonas = collectLonas();
      if (!lonas.length) errors.push("Completa las especificaciones de la lona.");
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
        validateDesign("lona", i, l.lona, errors);
      });
    }

    if (isToldo()) {
      if (!form.querySelector('input[name="cantidadToldos"]:checked')) {
        errors.push("Selecciona si solicitas 1 o 2 toldos.");
        markInvalid(form.querySelector('input[name="cantidadToldos"]'));
      }
      const toldos = collectToldos();
      if (!toldos.length) errors.push("Completa las especificaciones del toldo.");
      toldos.forEach((t, idx) => {
        const i = idx + 1;
        const block = toldosSpecs.querySelector(`[data-toldo="${i}"]`);
        if (!t.tipo) {
          errors.push(`Selecciona el tipo de ${t.toldo}.`);
          markInvalid(block);
        }
        if (!t.ubicacionMaps) {
          errors.push(`Captura la ubicación de Google Maps de ${t.toldo}.`);
          markInvalid(block?.querySelector('[data-k="ubicacionMaps"]'));
        }
        const fotoUbicacion = form.querySelector(`input[name="fotoUbicacion_toldo_${i}"]`);
        if (!fotoUbicacion?.files?.length) {
          errors.push(`Adjunta la foto de ubicación de ${t.toldo}.`);
          markInvalid(fotoUbicacion);
        }
        if (!t.ancho || !t.largo || !t.alto) {
          errors.push(`Captura medidas de ${t.toldo}.`);
          markInvalid(block);
        }
        if (!t.incluyeEstructura) {
          errors.push(`Indica si ${t.toldo} incluye estructura.`);
          markInvalid(block);
        }
        validateDesign("toldo", i, t.toldo, errors);
      });
    }

    if (isCaballete()) {
      if (!form.querySelector('input[name="cantidadCaballetes"]:checked')) {
        errors.push("Selecciona si solicitas 1 o 2 caballetes.");
        markInvalid(form.querySelector('input[name="cantidadCaballetes"]'));
      }
      const caballetes = collectCaballetes();
      if (!caballetes.length) errors.push("Completa las especificaciones del caballete.");
      caballetes.forEach((c, idx) => {
        const i = idx + 1;
        const block = caballetesSpecs.querySelector(`[data-caballete="${i}"]`);
        if (!c.ancho || !c.alto) {
          errors.push(`Captura ancho y alto de ${c.caballete}.`);
          markInvalid(block);
        }
        if (!c.caras) {
          errors.push(`Selecciona las caras a imprimir de ${c.caballete}.`);
          markInvalid(block);
        }
        if (!c.orientacion) {
          errors.push(`Selecciona la orientación de ${c.caballete}.`);
          markInvalid(block);
        }
        if (!c.acabados.length) {
          errors.push(`Selecciona acabados de ${c.caballete}.`);
          markInvalid(block);
        }
        validateDesign("caballete", i, c.caballete, errors);
      });
    }

    return [...new Set(errors)];
  }

  function buildAnswers() {
    const mat = selectedMaterial();
    const base = {
      material: mat,
      autorizada: form.querySelector('input[name="autorizada"]:checked')?.value || "",
      ejecutivoNombre: String(form.ejecutivoNombre.value || "").trim(),
      ejecutivoTelefono: String(form.ejecutivoTelefono.value || "").trim(),
      yaavserNombre: String(form.yaavserNombre.value || "").trim(),
      claveYaavser: String(form.claveYaavser.value || "").trim().toUpperCase(),
      puntoVenta: String(form.puntoVenta.value || "").trim(),
      tipoEstablecimiento: checkedValues("tipoEstablecimiento"),
      tipoEstablecimientoOtro: String(form.tipoEstablecimientoOtro.value || "").trim(),
      objetivoLona: checkedValues("objetivoLona"),
      resultadoEsperado: checkedValues("resultadoEsperado"),
      serviciosActuales: checkedValues("serviciosActuales"),
      confirmaciones: checkedValues("confirmaciones"),
    };

    if (mat === "Lona") {
      return {
        ...base,
        cantidadLonas: lonaCount(),
        lonas: collectLonas(),
      };
    }

    if (mat === "Caballete") {
      return {
        ...base,
        cantidadCaballetes: caballeteCount(),
        caballetes: collectCaballetes(),
      };
    }

    return {
      ...base,
      cantidadToldos: toldoCount(),
      toldos: collectToldos(),
    };
  }

  function appendItemFiles(fd, prefix, count) {
    for (let i = 1; i <= count; i += 1) {
      const logo = form.querySelector(`input[name="logo_${prefix}_${i}"]`);
      if (logo?.files?.[0]) fd.append(`logo_${prefix}_${i}`, logo.files[0]);
      const refYes =
        form.querySelector(`input[name="referencia_${prefix}_${i}"]:checked`)?.value === "Sí";
      const refFile = form.querySelector(`input[name="referenciaFile_${prefix}_${i}"]`);
      if (refYes && refFile?.files?.[0]) {
        fd.append(`referenciaFile_${prefix}_${i}`, refFile.files[0]);
      }
      const fotoUbicacion = form.querySelector(`input[name="fotoUbicacion_${prefix}_${i}"]`);
      if (fotoUbicacion?.files?.[0]) {
        fd.append(`fotoUbicacion_${prefix}_${i}`, fotoUbicacion.files[0]);
      }
    }
  }

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.name === "material") syncMaterial();
    if (t.name === "autorizada") syncAuthGate();
    if (t.name === "cantidadLonas") {
      renderLonas();
      syncContacto();
      syncReferencia();
    }
    if (t.name === "cantidadToldos") {
      renderToldos();
      syncContacto();
      syncReferencia();
    }
    if (t.name === "cantidadCaballetes") {
      renderCaballetes();
      syncContacto();
      syncReferencia();
    }
    if (t.name === "tipoEstablecimiento") syncTipoOtro();
    if (t.hasAttribute("data-contacto")) syncContacto();
    if (t.hasAttribute("data-ref") || t.name?.startsWith("referencia_")) syncReferencia();
  });

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
      if (isLona()) appendItemFiles(fd, "lona", lonaCount());
      if (isToldo()) appendItemFiles(fd, "toldo", toldoCount());
      if (isCaballete()) appendItemFiles(fd, "caballete", caballeteCount());
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
  renderToldos();
  renderCaballetes();
  syncMaterial();
  syncTipoOtro();
  syncContacto();
  syncReferencia();
})();
