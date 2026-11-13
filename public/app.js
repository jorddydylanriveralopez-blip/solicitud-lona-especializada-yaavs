(() => {
  const form = document.getElementById("lonaForm");
  const afterZona = document.getElementById("afterZona");
  const afterMaterial = document.getElementById("afterMaterial");
  const formRest = document.getElementById("formRest");
  const flowLona = document.getElementById("flowLona");
  const flowToldo = document.getElementById("flowToldo");
  const toldoPuntoVentaExtra = document.getElementById("toldoPuntoVentaExtra");
  const flowCaballete = document.getElementById("flowCaballete");
  const flowRotulacion = document.getElementById("flowRotulacion");
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
  const SUBMITTED_KEY = "yaavs_lona_form_submitted";
  const MAX_PREVIEW_EDGE = 900;
  const WARN_FILE_MB = 8;
  let syncStepsTimer = 0;
  let lastScrolledStep = null;

  function scheduleSyncFormSteps(immediate = false) {
    if (immediate) {
      if (syncStepsTimer) {
        clearTimeout(syncStepsTimer);
        syncStepsTimer = 0;
      }
      syncFormSteps();
      return;
    }
    if (syncStepsTimer) clearTimeout(syncStepsTimer);
    syncStepsTimer = setTimeout(() => {
      syncStepsTimer = 0;
      syncFormSteps();
    }, 160);
  }


  // Matriz ventas (ACTUALIZADO OCT 2026 - NACIONAL / BBDD): [ejecutivo, gerente territorial, gerente regional]
  const MATRIZ_VENTAS = [
    ["Abel Rosas Diaz", "Jesus Redonda Perez", "Rodolfo Reynoso Castelan"],
    ["Angel Odiseo Salvatierra Fragoso", "Juan Fernando Garcia Aguilar", "Jesus Castaneda Totozintle"],
    ["Carlos Alberto Silva Razo", "Rodolfo Reynoso Castelan", "Rodolfo Reynoso Castelan"],
    ["Carlos Ignacio Salazar Leyva", "Jesus Redonda Perez", "Rodolfo Reynoso Castelan"],
    ["Celso Hernandez Hernandez", "Rodolfo Reynoso Castelan", "Rodolfo Reynoso Castelan"],
    ["Cesar Alberto Banderilla Gonzalez", "Jesus Redonda Perez", "Rodolfo Reynoso Castelan"],
    ["Christian Alan Ramirez Meza", "Juan Fernando Garcia Aguilar", "Jesus Castaneda Totozintle"],
    ["Daniel De Jesus Chapa Mendoza", "Jesus Redonda Perez", "Rodolfo Reynoso Castelan"],
    ["Daniel Perez De Jesus", "Juan Fernando Garcia Aguilar", "Jesus Castaneda Totozintle"],
    ["David Santiago Enciso Velazquez", "Luis Daniel Ugalde Welsh", "Rodolfo Reynoso Castelan"],
    ["Diego Fernando Solorio Anaya", "Jesus Redonda Perez", "Rodolfo Reynoso Castelan"],
    ["Edgar David Reyes Plata", "Rodolfo Reynoso Castelan", "Rodolfo Reynoso Castelan"],
    ["Emerson Mauricio Cordova Lopez", "Luis Daniel Ugalde Welsh", "Rodolfo Reynoso Castelan"],
    ["Enrique Robledo Montero", "Rodolfo Reynoso Castelan", "Rodolfo Reynoso Castelan"],
    ["Esteban Gomez Luis", "Juan Fernando Garcia Aguilar", "Jesus Castaneda Totozintle"],
    ["Fernando Jimenez Vazquez", "Luis Eduardo Vazquez Hernandez", "Jesus Castaneda Totozintle"],
    ["Fernando Noria Hernandez", "Luis Eduardo Vazquez Hernandez", "Jesus Castaneda Totozintle"],
    ["Ivan Martin Gamero Hernandez", "Juan Fernando Garcia Aguilar", "Jesus Castaneda Totozintle"],
    ["Jazmin Valenzuela Santana", "Manuel Vazquez Aguila", "Jesus Castaneda Totozintle"],
    ["Jean Eduardo Romero Romero", "Jesus Redonda Perez", "Rodolfo Reynoso Castelan"],
    ["Jesus Sanchez Enriquez", "Erick Perez Galindo", "Rodolfo Reynoso Castelan"],
    ["Jorge Mandujano Martinez", "Manuel Vazquez Aguila", "Jesus Castaneda Totozintle"],
    ["Jose Alejandro Reyes Santos", "Manuel Vazquez Aguila", "Jesus Castaneda Totozintle"],
    ["Jose Alva Mireles", "Manuel Vazquez Aguila", "Jesus Castaneda Totozintle"],
    ["Jose Arzaluz Mejia", "Erick Perez Galindo", "Rodolfo Reynoso Castelan"],
    ["Jose Carlos Martinez Miranda", "Luis Eduardo Vazquez Hernandez", "Jesus Castaneda Totozintle"],
    ["Jose Luis Lopez Gonzalez", "Erick Perez Galindo", "Rodolfo Reynoso Castelan"],
    ["Jose Luis Ramirez Araujo", "Luis Daniel Ugalde Welsh", "Rodolfo Reynoso Castelan"],
    ["Juan Carlos Suarez Hernandez", "Luis Daniel Ugalde Welsh", "Rodolfo Reynoso Castelan"],
    ["Juan Carlos Utrera Hernandez", "Luis Eduardo Vazquez Hernandez", "Jesus Castaneda Totozintle"],
    ["Lizett Karina Mendez Corona", "Manuel Vazquez Aguila", "Jesus Castaneda Totozintle"],
    ["Luis Enrique Najera Hernandez", "Manuel Vazquez Aguila", "Jesus Castaneda Totozintle"],
    ["Luis Fernando Rosales Ortega", "Erick Perez Galindo", "Rodolfo Reynoso Castelan"],
    ["Marco Antonio Salgado Perez", "Luis Daniel Ugalde Welsh", "Rodolfo Reynoso Castelan"],
    ["Norma Cristina Miravete Montoya", "Manuel Vazquez Aguila", "Jesus Castaneda Totozintle"],
    ["Octavio Arturo Flores Nieto", "Luis Daniel Ugalde Welsh", "Rodolfo Reynoso Castelan"],
    ["Omar David Sanchez Jaramillo", "Juan Fernando Garcia Aguilar", "Jesus Castaneda Totozintle"],
    ["Yeimi Lizama Mendoza", "Jesus Redonda Perez", "Rodolfo Reynoso Castelan"],
  ];
  // Foráneo (oct 2026): regionales = Cesar / Rigoberto; subdirección = Henonin.
  const FORANEO_REGIONAL_CESAR = "Cesar Gutierrez Escarcega";
  const FORANEO_REGIONAL_RIGOBERTO = "Rigoberto Rios Mercado";
  // Misma forma que Centro: [ejecutivo, territorial, regional]
  const MATRIZ_FORANEO = [
    ["Alberto Ivan Vazquez Martinez", "Alan Alarcon Morales", FORANEO_REGIONAL_CESAR],
    ["Alejandro Salazar Chumacero", "Cesar Gutierrez Escarcega", FORANEO_REGIONAL_CESAR],
    ["Alfredo Barajas Navarro", "Erendira Trujillo Aleman", FORANEO_REGIONAL_RIGOBERTO],
    ["Carlos Antonio Hernandez", "Alan Alarcon Morales", FORANEO_REGIONAL_CESAR],
    ["Carlos Ignacio Rodriguez Mendoza", "Alan Alarcon Morales", FORANEO_REGIONAL_CESAR],
    ["Cinthya Leonor Garcia Duran", "Cesar Gutierrez Escarcega", FORANEO_REGIONAL_CESAR],
    ["Dan Eloi Osuna Hernandez", "Erendira Trujillo Aleman", FORANEO_REGIONAL_RIGOBERTO],
    ["Daniela Irene Gonzalez Buelna", "Olyver Alain Guerrero Lozano", FORANEO_REGIONAL_RIGOBERTO],
    ["Diego Aguilar Juarez", "Cesar Gutierrez Escarcega", FORANEO_REGIONAL_CESAR],
    ["Edgar Silverio Garcia", "Alan Alarcon Morales", FORANEO_REGIONAL_CESAR],
    ["Eduardo Perez Mundo", "Leon Perez Zamudio", FORANEO_REGIONAL_CESAR],
    ["Fernando Cervantes Perez", "Marco Antonio Calderon Martinez", FORANEO_REGIONAL_RIGOBERTO],
    ["Gilberto Hernandez Rodriguez", "Leon Perez Zamudio", FORANEO_REGIONAL_CESAR],
    ["Guadalupe Alor Martinez", "Olyver Alain Guerrero Lozano", FORANEO_REGIONAL_RIGOBERTO],
    ["Guillermo Canul Castro", "Leon Perez Zamudio", FORANEO_REGIONAL_CESAR],
    ["Javier Ivan Fernandez Yanez", "Olyver Alain Guerrero Lozano", FORANEO_REGIONAL_RIGOBERTO],
    ["Jesus Alejandro Uruchurtu Becerra", "Alan Alarcon Morales", FORANEO_REGIONAL_CESAR],
    ["Jorge Camacho Calderon", "Cesar Gutierrez Escarcega", FORANEO_REGIONAL_CESAR],
    ["Jorge Luis Espinosa Flores", "Leon Perez Zamudio", FORANEO_REGIONAL_CESAR],
    ["Jose Narciso Hernandez Ruiz", "Olyver Alain Guerrero Lozano", FORANEO_REGIONAL_RIGOBERTO],
    ["Juan Carlos Marquez Hernandez", "Cesar Gutierrez Escarcega", FORANEO_REGIONAL_CESAR],
    ["Juan Carlos Martinez Betancourt", "Erendira Trujillo Aleman", FORANEO_REGIONAL_RIGOBERTO],
    ["Lidia Isabel Vargas Garcia", "Olyver Alain Guerrero Lozano", FORANEO_REGIONAL_RIGOBERTO],
    ["Marco Antonio Calderon Santacruz", "Erendira Trujillo Aleman", FORANEO_REGIONAL_RIGOBERTO],
    ["Marco Aurelio Uribe Zimmermann", "Erendira Trujillo Aleman", FORANEO_REGIONAL_RIGOBERTO],
    ["Maria Del Rocio Tapia Conde", "Cesar Gutierrez Escarcega", FORANEO_REGIONAL_CESAR],
    ["Miguel Angel Palomares Caselis", "Marco Antonio Calderon Martinez", FORANEO_REGIONAL_RIGOBERTO],
    ["Nancy Gabriela Guerrero Dominguez", "Cesar Gutierrez Escarcega", FORANEO_REGIONAL_CESAR],
    ["Rafael Jimenez Cabrera", "Marco Antonio Calderon Martinez", FORANEO_REGIONAL_RIGOBERTO],
    ["Victor Adan Sanchez Arvizu", "Olyver Alain Guerrero Lozano", FORANEO_REGIONAL_RIGOBERTO],
  ];

  const ejecutivoSelect = document.getElementById("ejecutivoNombre");
  const gerenteTerritorialInput = document.getElementById("gerenteTerritorial");
  const gerenteRegionalInput = document.getElementById("territorioGerente");

  function selectedZonaComercial() {
    return String(form?.querySelector('input[name="zonaComercial"]:checked')?.value || "").trim();
  }

  function matrizActiva() {
    return selectedZonaComercial() === "Foráneo" ? MATRIZ_FORANEO : MATRIZ_VENTAS;
  }

  function fillEjecutivoOptions() {
    if (!ejecutivoSelect) return;
    const zona = selectedZonaComercial();
    const matriz = matrizActiva();
    const prev = ejecutivoSelect.value;
    ejecutivoSelect.innerHTML = "";
    ejecutivoSelect.add(new Option(zona === "Foráneo" ? "Selecciona el ejecutivo foráneo" : "Selecciona tu nombre", ""));
    if (!zona) {
      ejecutivoSelect.disabled = true;
      ejecutivoSelect.required = false;
      if (gerenteTerritorialInput) gerenteTerritorialInput.value = "";
      if (gerenteRegionalInput) gerenteRegionalInput.value = "";
      return;
    }
    ejecutivoSelect.disabled = false;
    ejecutivoSelect.required = true;
    [...matriz]
      .sort((a, b) => a[0].localeCompare(b[0], "es"))
      .forEach(([nombre]) => ejecutivoSelect.add(new Option(nombre, nombre)));
    if (prev && [...ejecutivoSelect.options].some((o) => o.value === prev)) {
      ejecutivoSelect.value = prev;
    } else {
      ejecutivoSelect.value = "";
    }
    applyEjecutivoGerentes();
  }

  function applyEjecutivoGerentes() {
    const row = matrizActiva().find((r) => r[0] === ejecutivoSelect?.value);
    if (gerenteTerritorialInput) gerenteTerritorialInput.value = row ? row[1] : "";
    if (gerenteRegionalInput) gerenteRegionalInput.value = row ? row[2] : "";
  }

  function applyMaterialOptionsForZona() {
    const isForaneo = selectedZonaComercial() === "Foráneo";
    form?.querySelectorAll("[data-material-option]").forEach((label) => {
      const value = label.getAttribute("data-material-option");
      const input = label.querySelector('input[name="material"]');
      // Foráneo: Lona especializada y Rotulación. Centro: todos.
      const allowed = !isForaneo || value === "Lona" || value === "Rotulación";
      label.hidden = !allowed;
      if (input) {
        input.disabled = !allowed;
        if (!allowed && input.checked) input.checked = false;
      }
    });
  }

  function syncZona() {
    const zona = selectedZonaComercial();
    if (afterZona) afterZona.hidden = !zona;
    applyMaterialOptionsForZona();
    fillEjecutivoOptions();
    if (!zona) {
      form?.querySelectorAll('input[name="material"]').forEach((input) => {
        input.checked = false;
      });
    }
    syncMaterial();
  }

  function applyZonaComercial() {
    syncZona();
  }

  if (ejecutivoSelect) {
    ejecutivoSelect.addEventListener("change", applyEjecutivoGerentes);
  }

  form?.querySelectorAll('input[name="zonaComercial"]').forEach((input) => {
    input.addEventListener("change", applyZonaComercial);
  });

  form?.querySelectorAll("input[data-digits]").forEach((input) => {
    input.addEventListener("input", () => {
      const max = Number(input.dataset.digits) || 10;
      const clean = input.value.replace(/\D/g, "").slice(0, max);
      if (clean !== input.value) input.value = clean;
    });
  });

  function showThanks(folio) {
    if (form) form.hidden = true;
    if (successPanel) {
      successPanel.hidden = false;
      const folioEl = document.getElementById("successFolio");
      if (folioEl) {
        folioEl.textContent =
          folio || sessionStorage.getItem(SUBMITTED_KEY) || "—";
      }
      successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (sessionStorage.getItem(SUBMITTED_KEY)) {
    showThanks(sessionStorage.getItem(SUBMITTED_KEY));
    return;
  }

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

  function isRotulacion() {
    return selectedMaterial() === "Rotulación";
  }

  function materialCopy() {
    const mat = selectedMaterial();
    if (mat === "Toldo") {
      return {
        title: "Solicitud de diseño y producción de toldo",
        objetivo:
          '¿Cuál es el objetivo que se requiere obtener del toldo? <span class="req">*</span>',
      };
    }
    if (mat === "Caballete") {
      return {
        title: "Solicitud de diseño y producción de caballete",
        objetivo:
          '¿Cuál es el objetivo que se requiere obtener del caballete? <span class="req">*</span>',
      };
    }
    if (mat === "Rotulación") {
      return {
        title: "Solicitud de rotulación",
        lede:
          "Completa correctamente este formulario. Verifica las respuestas exactas e información vigente y contéstalo correctamente.",
        objetivo:
          '¿Cuál es el objetivo que se requiere obtener de la rotulación? <span class="req">*</span>',
      };
    }
    return {
      title: "Solicitud de diseño y producción de lona especializada",
      objetivo:
        '¿Cuál es el objetivo que se requiere obtener de la lona? <span class="req">*</span>',
    };
  }

  const ROTULACION_CLASIF_ESQUINA =
    "Negocio en esquina / contraesquina con doble entrada.";

  function rotulacionEvidenciaTipo() {
    const clasif =
      form.querySelector('input[name="rotulacionClasificacion"]:checked')?.value || "";
    if (!clasif) return "";
    if (clasif === ROTULACION_CLASIF_ESQUINA || /contraesquina|esquina/i.test(clasif)) {
      return "esquina";
    }
    return "frente";
  }

  function syncRotulacionUi() {
    if (!flowRotulacion) return;
    const permisos = form.querySelector('input[name="rotulacionPermisos"]:checked')?.value || "";
    const permisoNo = document.getElementById("rotulacionPermisoNo");
    if (permisoNo) permisoNo.hidden = permisos !== "No";

    const evidencia = rotulacionEvidenciaTipo();
    const fotosWrap = document.getElementById("rotulacionFotosWrap");
    const foto1Wrap = document.getElementById("rotulacionFoto1Wrap");
    const foto2Wrap = document.getElementById("rotulacionFoto2Wrap");
    const foto1Label = document.getElementById("rotulacionFoto1Label");
    const foto2Label = document.getElementById("rotulacionFoto2Label");
    const foto1Input = form.querySelector('input[name="rotulacion_foto_1"]');
    const foto2Input = form.querySelector('input[name="rotulacion_foto_2"]');
    const showFotos = evidencia === "frente" || evidencia === "esquina";
    const showFoto2 = evidencia === "esquina";

    if (fotosWrap) {
      fotosWrap.hidden = !showFotos;
      fotosWrap.classList.toggle("is-single", evidencia === "frente");
    }
    if (foto1Wrap) foto1Wrap.hidden = !showFotos;
    if (foto2Wrap) foto2Wrap.hidden = !showFoto2;
    if (foto1Input) foto1Input.required = showFotos;
    if (foto2Input) foto2Input.required = showFoto2;
    if (foto1Label) {
      foto1Label.innerHTML =
        evidencia === "esquina"
          ? 'Sube la foto del lateral izquierdo <span class="req">*</span>'
          : 'Sube la fotografía frontal completa <span class="req">*</span>';
    }
    if (foto2Label) {
      foto2Label.innerHTML = 'Sube la foto del lateral derecho <span class="req">*</span>';
    }
    const evidenciaHint = document.getElementById("rotulacionEvidenciaHint");
    if (evidenciaHint) {
      if (!evidencia) {
        evidenciaHint.hidden = false;
        evidenciaHint.textContent =
          "Selecciona primero la clasificación del punto de venta para ver qué fotos debes subir.";
      } else if (evidencia === "esquina") {
        evidenciaHint.hidden = false;
        evidenciaHint.textContent =
          "Por la clasificación de esquina / contraesquina, sube dos fotos: lateral izquierdo y lateral derecho.";
      } else {
        evidenciaHint.hidden = false;
        evidenciaHint.textContent =
          "Por la clasificación seleccionada, sube una fotografía frontal completa del negocio.";
      }
    }
    syncRotulacionColorPreviews();
    syncFormSteps();
  }

  const ROTULACION_CLASSIF_PREVIEW = {
    "Negocio sin espacio en paredes laterales (derecha e izquierda).": {
      key: "2",
      label: "Sin laterales",
      hint: "Ejemplo según tu clasificación: fachada frontal sin laterales.",
    },
    "Negocio con poco espacio en paredes laterales (derecha e izquierda).": {
      key: "3",
      label: "Poco espacio lateral",
      hint: "Ejemplo según tu clasificación: fachada con laterales estrechos.",
    },
    "Negocio con espacio amplio / considerable en paredes laterales (derecha e izquierda).": {
      key: "4",
      label: "Laterales amplios",
      hint: "Ejemplo según tu clasificación: fachada con laterales amplios.",
    },
    "Negocio en esquina / contraesquina con doble entrada.": {
      key: "5",
      label: "Esquina / doble entrada",
      hint: "Ejemplo según tu clasificación: negocio en esquina con doble entrada.",
    },
    "Puesto de lámina.": {
      key: "6",
      label: "Puesto de lámina",
      hint: "Ejemplo de referencia para puesto de lámina.",
    },
  };

  function syncRotulacionColorPreviews() {
    const clasif =
      form.querySelector('input[name="rotulacionClasificacion"]:checked')?.value || "";
    const preview = ROTULACION_CLASSIF_PREVIEW[clasif] || {
      key: "2",
      label: "Vista de ejemplo",
      hint: "Selecciona primero la clasificación del punto de venta para ver el ejemplo que corresponde.",
    };
    const hintEl = document.getElementById("rotulacionColorHint");
    if (hintEl) hintEl.textContent = preview.hint;

    document.querySelectorAll(".color-option[data-color]").forEach((opt) => {
      const color = opt.getAttribute("data-color");
      const img = opt.querySelector(".color-preview-img");
      const label = opt.querySelector("[data-preview-label]");
      if (img && color) {
        const next = `./assets/rotulacion-colores/${color}/${preview.key}.jpg?v=20261005a`;
        if (img.getAttribute("src") !== next) {
          img.setAttribute("decoding", "async");
          img.setAttribute("loading", "lazy");
          img.setAttribute("src", next);
        }
      }
      if (label) label.textContent = preview.label;
    });
  }

  function syncMaterial() {
    const mat = selectedMaterial();
    afterMaterial.hidden = !mat;
    if (!mat) {
      syncFormSteps();
      return;
    }

    const copy = materialCopy();
    if (heroTitle) heroTitle.textContent = copy.title;
    if (heroLede) {
      heroLede.textContent =
        copy.lede ||
        "Completa este formulario el ejecutivo de ventas YAAVSTAR junto con el YAAVSER. Verifica medidas exactas e información vigente.";
    }
    if (objetivoLegend) objetivoLegend.innerHTML = copy.objetivo;

    const secObjetivo = document.getElementById("secObjetivo");
    if (secObjetivo) secObjetivo.hidden = mat === "Rotulación";
    if (mat === "Rotulación") {
      form.querySelectorAll('input[name="objetivoLona"]').forEach((el) => {
        el.checked = false;
      });
    }

    flowLona.hidden = mat !== "Lona";
    flowToldo.hidden = mat !== "Toldo";
    flowCaballete.hidden = mat !== "Caballete";
    if (flowRotulacion) flowRotulacion.hidden = mat !== "Rotulación";
    if (toldoPuntoVentaExtra) {
      toldoPuntoVentaExtra.hidden = mat !== "Toldo" && mat !== "Rotulación";
    }
    const toldoFotoPvField = document.getElementById("toldoFotoPvField");
    if (toldoFotoPvField) toldoFotoPvField.hidden = mat !== "Toldo";
    renderLonas();
    renderToldos();
    renderCaballetes();
    syncRotulacionUi();
    syncFormSteps();
  }

  function isForaneo() {
    return selectedZonaComercial() === "Foráneo";
  }

  function isStepApplicable(section) {
    if (!section) return false;
    if (section.id === "secObjetivo" && isRotulacion()) return false;
    if (section.id === "secXrayForaneoLona") return isLona();
    if (section.id === "secXrayForaneoRotul") return isRotulacion();
    if (section.closest("#flowLona") && (!flowLona || flowLona.hidden)) return false;
    if (section.closest("#flowToldo") && (!flowToldo || flowToldo.hidden)) return false;
    if (section.closest("#flowCaballete") && (!flowCaballete || flowCaballete.hidden)) return false;
    if (section.closest("#flowRotulacion") && (!flowRotulacion || flowRotulacion.hidden)) return false;
    return true;
  }

  function isSectionComplete(section) {
    if (!section || !isStepApplicable(section)) return true;
    if (section.getAttribute("data-step-optional") === "true") return true;

    const visible = (el) => el && !el.disabled && !el.hidden && !el.closest("[hidden]");

    for (const file of section.querySelectorAll('input[type="file"]')) {
      if (!visible(file)) continue;
      if (!file.files?.length) return false;
    }

    for (const el of section.querySelectorAll("input, textarea, select")) {
      if (!visible(el)) continue;
      if (el.type === "radio" || el.type === "checkbox") continue;
      if (!(el.required || el.getAttribute("aria-required") === "true")) continue;
      if (el.type === "file") {
        if (!el.files?.length) return false;
        continue;
      }
      if (!String(el.value || "").trim()) return false;
      if (el.dataset.digits && !new RegExp(`^\\d{${el.dataset.digits}}$`).test(el.value)) return false;
    }

    const radioNames = new Set();
    section.querySelectorAll('input[type="radio"]').forEach((r) => {
      if (!visible(r)) return;
      if (r.required || r.closest('fieldset[data-required="true"]')) radioNames.add(r.name);
    });
    for (const name of radioNames) {
      if (!section.querySelector(`input[name="${CSS.escape(name)}"]:checked`)) return false;
    }

    for (const fs of section.querySelectorAll('fieldset[data-required="true"][data-multi="true"]')) {
      if (fs.hidden || fs.closest("[hidden]")) continue;
      const box = fs.querySelector('input[type="checkbox"]');
      if (!box) continue;
      if (!section.querySelector(`input[name="${CSS.escape(box.name)}"]:checked`)) return false;
    }

    // Ubicación (Toldo / Rotulación) y foto solo Toldo
    if ((isToldo() || isRotulacion()) && section.querySelector("#toldoPuntoVentaExtra")) {
      if (!hasUbicacionPuntoVenta()) return false;
      const foto = section.querySelector('input[name="toldo_foto"]');
      if (isToldo() && foto && visible(foto) && !foto.files?.length) return false;
    }

    // Specs blocks: require at least one filled dimension + logo when present
    const logo = section.querySelector('input[type="file"][name^="logo_"]');
    if (logo && visible(logo) && !logo.files?.length) return false;
    const firstAncho = section.querySelector('input[data-k="ancho"]');
    const firstAlto = section.querySelector('input[data-k="alto"], input[data-k="largo"]');
    if (firstAncho && visible(firstAncho) && !String(firstAncho.value || "").trim()) return false;
    if (firstAlto && visible(firstAlto) && !String(firstAlto.value || "").trim()) return false;

    // Rotulación evidencia files (required toggled dynamically)
    const f1 = section.querySelector('input[name="rotulacion_foto_1"]');
    if (f1 && visible(f1) && f1.required && !f1.files?.length) return false;
    const f2 = section.querySelector('input[name="rotulacion_foto_2"]');
    if (f2 && visible(f2) && f2.required && !f2.files?.length) return false;

    return true;
  }

  function syncFormSteps() {
    const actions = document.getElementById("formActions");
    const steps = [...form.querySelectorAll("[data-form-step]")].filter(isStepApplicable);
    let unlockNext = true;
    let number = 1;
    let lastVisible = null;
    let newlyOpened = null;

    steps.forEach((section) => {
      const wasHidden = section.hidden;
      if (!unlockNext) {
        section.hidden = true;
        section.classList.remove("is-step-active");
        return;
      }

      section.hidden = false;
      section.classList.add("is-step-active");
      const badge = section.querySelector(".section-head > span");
      if (badge) badge.textContent = String(number++);
      lastVisible = section;
      if (wasHidden) newlyOpened = section;

      const complete = isSectionComplete(section);
      if (!complete) unlockNext = false;
    });

    form.querySelectorAll("[data-form-step]").forEach((section) => {
      if (!isStepApplicable(section) && section.id !== "secZona" && section.id !== "secMaterial") {
        section.hidden = true;
        section.classList.remove("is-step-active");
      }
    });

    // Solo un input xray activo: el del paso visible (Lona o Rotulación).
    form.querySelectorAll('input[name="xray_cliente"]').forEach((input) => {
      const section = input.closest("[data-form-step]");
      const on = Boolean(section && isStepApplicable(section) && !section.hidden);
      // Preferir readonly/required sobre disabled: disabled bloquea el picker en algunos móviles.
      input.disabled = false;
      input.required = on;
      if (on) {
        input.removeAttribute("tabindex");
        input.style.pointerEvents = "";
      } else {
        input.required = false;
        input.value = "";
        input.style.pointerEvents = "none";
        input.setAttribute("tabindex", "-1");
      }
    });

    if (actions) {
      const showActions = Boolean(
        lastVisible && lastVisible.getAttribute("data-step-optional") === "true",
      );
      actions.hidden = !showActions;
    }

    if (newlyOpened && newlyOpened !== lastScrolledStep) {
      lastScrolledStep = newlyOpened;
      // Instant scroll avoids jank on mid-range Android while typing/selecting.
      newlyOpened.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }

  const ubicacionInput = document.getElementById("puntoVentaUbicacionInput");
  const ubicacionMaps = document.getElementById("puntoVentaUbicacionMaps");
  const ubicacionLat = document.getElementById("puntoVentaLat");
  const ubicacionLng = document.getElementById("puntoVentaLng");
  const ubicacionLatVisible = document.getElementById("puntoVentaLatVisible");
  const ubicacionLngVisible = document.getElementById("puntoVentaLngVisible");
  const ubicacionPreview = document.getElementById("ubicacionPreview");
  const btnDetectarUbicacion = document.getElementById("btnDetectarUbicacion");
  const btnAbrirGoogleMaps = document.getElementById("btnAbrirGoogleMaps");
  const btnUsarCoordenadas = document.getElementById("btnUsarCoordenadas");

  let ubicacionTimer = 0;
  let ubicacionRequest = 0;
  let lastPreviewKey = "";
  let appliedUbicacionInput = "";

  function mapsUrlFromCoords(lat, lng) {
    const pair = `${lat},${lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pair)}`;
  }

  function decodeMapsText(text) {
    const value = String(text || "");
    try {
      return decodeURIComponent(value);
    } catch (_) {
      return value;
    }
  }

  function validCoord(lat, lng) {
    const a = Number(lat);
    const b = Number(lng);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
    return { lat: String(lat), lng: String(lng) };
  }

  function pastedMapsUrl(text) {
    const value = String(text || "");
    // Prefer Google / Apple Maps links inside WhatsApp messages or shared text.
    const preferred = value.match(
      /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|share\.google|maps\.google\.[^\s/]+|www\.google\.[^\s/]+\/maps|maps\.apple\.com)[^\s]*/i,
    );
    if (preferred) return preferred[0].replace(/[)\].,;>"']+$/g, "");
    const any = value.match(/https?:\/\/\S+/i);
    return any ? any[0].replace(/[)\].,;>"']+$/g, "") : "";
  }

  function isMapsUrl(value) {
    return /google\.[a-z.]{2,}\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|share\.google\/|maps\.apple\.com/i.test(
      String(value || ""),
    );
  }

  function isShortMapsUrl(url) {
    return /maps\.app\.goo\.gl|goo\.gl\/maps|share\.google\//i.test(String(url || ""));
  }

  function coordsFromText(text) {
    const value = decodeMapsText(text);
    const geo = value.match(/geo:(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i);
    if (geo) {
      const pin = validCoord(geo[1], geo[2]);
      if (pin) return pin;
    }
    const pins = [...value.matchAll(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/g)];
    if (pins.length) {
      const last = pins[pins.length - 1];
      const pin = validCoord(last[1], last[2]);
      if (pin) return pin;
    }
    const patterns = [
      /[?&](?:q|query|ll|center|destination)=(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
      /[?&]ll=(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
      /\/(?:place|search)\/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
      /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
      /(?:^|[^\d.-])(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)(?:[^\d.]|$)/,
    ];
    for (const re of patterns) {
      const match = value.match(re);
      if (!match) continue;
      const pin = validCoord(match[1], match[2]);
      if (pin) return pin;
    }
    return null;
  }

  function placeQueryFromUrl(url) {
    try {
      const parsed = new URL(url);
      const q = parsed.searchParams.get("q") || parsed.searchParams.get("query") || "";
      if (q && !coordsFromText(q)) return q.replace(/\+/g, " ");
      const place = decodeURIComponent(parsed.pathname).match(/\/place\/([^/]+)/);
      if (place) return place[1].replace(/\+/g, " ");
    } catch (_) {}
    return "";
  }

  function embedSrc(lat, lng) {
    if (!lat || !lng) return "";
    const pair = `${lat},${lng}`;
    return `https://maps.google.com/maps?q=${encodeURIComponent(pair)}&z=18&hl=es&output=embed`;
  }

  function renderUbicacionPreview(mapsUrl, label, extra = {}) {
    if (!ubicacionPreview) return;
    const lat = extra.lat || "";
    const lng = extra.lng || "";
    const src = embedSrc(lat, lng);
    const openUrl = lat && lng ? mapsUrlFromCoords(lat, lng) : mapsUrl;
    const key = `${openUrl}|${lat}|${lng}|${src}`;
    if (!openUrl && !src) {
      lastPreviewKey = "";
      ubicacionPreview.hidden = true;
      ubicacionPreview.innerHTML = "";
      ubicacionPreview.classList.remove("is-ready", "is-miss");
      return;
    }
    if (key === lastPreviewKey) return;
    lastPreviewKey = key;
    const nice = label && !/^https?:/i.test(label) ? label : "Ubicación del punto de venta";
    const ready = Boolean(lat && lng);
    ubicacionPreview.hidden = false;
    ubicacionPreview.classList.toggle("is-ready", ready);
    ubicacionPreview.classList.toggle("is-miss", !ready);
    ubicacionPreview.innerHTML = `
      <p class="ubicacion-ready-title">${ready ? "Listo: ya quedó marcada la ubicación" : "Revisando ubicación…"}</p>
      <p>${escapeHtml(nice)}</p>
      ${
        openUrl
          ? `<a href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer">Abrir este punto en Google Maps</a>`
          : ""
      }
      ${
        src
          ? `<iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${escapeHtml(src)}" title="Mapa del punto de venta"></iframe>`
          : `<p class="help">Aún no se ve el punto exacto. Pega el enlace de <strong>Compartir</strong> de Google Maps (el que empieza con maps.app.goo.gl).</p>`
      }
    `;
  }

  function syncVisibleCoords(lat = "", lng = "") {
    if (ubicacionLatVisible) ubicacionLatVisible.value = lat ? String(lat) : "";
    if (ubicacionLngVisible) ubicacionLngVisible.value = lng ? String(lng) : "";
  }

  function applyUbicacion({ mapsUrl, lat = "", lng = "", label = "" }) {
    const pinUrl = lat && lng ? mapsUrlFromCoords(lat, lng) : mapsUrl || "";
    appliedUbicacionInput = String(ubicacionInput?.value || "").trim();
    if (ubicacionMaps) ubicacionMaps.value = pinUrl;
    if (ubicacionLat) ubicacionLat.value = lat ? String(lat) : "";
    if (ubicacionLng) ubicacionLng.value = lng ? String(lng) : "";
    syncVisibleCoords(lat, lng);
    if (lat && lng && ubicacionInput) {
      const pair = `${lat}, ${lng}`;
      if (!String(ubicacionInput.value || "").trim() || /^https?:/i.test(ubicacionInput.value) || /^estoy aquí/i.test(ubicacionInput.value) || /^ubicación/i.test(ubicacionInput.value)) {
        ubicacionInput.value = pair;
        appliedUbicacionInput = pair;
      }
    }
    if (btnAbrirGoogleMaps) {
      btnAbrirGoogleMaps.href = pinUrl || "https://www.google.com/maps";
    }
    renderUbicacionPreview(pinUrl, label || (lat && lng ? `${lat}, ${lng}` : ""), { lat, lng });
    scheduleSyncFormSteps(true);
  }

  function setUbicacion({ label, mapsUrl, lat = "", lng = "" }) {
    if (ubicacionInput && label != null) ubicacionInput.value = label;
    applyUbicacion({ mapsUrl, lat, lng, label });
  }

  function applyCoordsFromFields(rawText = "") {
    const fromPair = coordsFromText(rawText);
    const lat = String(ubicacionLatVisible?.value || fromPair?.lat || "").trim().replace(",", ".");
    const lng = String(ubicacionLngVisible?.value || fromPair?.lng || "").trim().replace(",", ".");
    const pin = validCoord(lat, lng);
    if (!pin) {
      showToast("Escribe latitud y longitud válidas. Ejemplo: 19.432608 y -99.133209");
      showUbicacionMiss();
      return false;
    }
    setUbicacion({
      label: `${pin.lat}, ${pin.lng}`,
      mapsUrl: mapsUrlFromCoords(pin.lat, pin.lng),
      lat: pin.lat,
      lng: pin.lng,
    });
    showToast("Listo: coordenadas guardadas.");
    return true;
  }

  function showUbicacionLoading() {
    if (!ubicacionPreview) return;
    lastPreviewKey = "";
    ubicacionPreview.hidden = false;
    ubicacionPreview.classList.remove("is-ready");
    ubicacionPreview.classList.add("is-miss");
    ubicacionPreview.innerHTML = `<p class="ubicacion-ready-title">Buscando el punto en el mapa…</p><p>Espera un momento.</p>`;
  }

  function showUbicacionMiss() {
    if (!ubicacionPreview) return;
    lastPreviewKey = "";
    ubicacionPreview.hidden = false;
    ubicacionPreview.classList.remove("is-ready");
    ubicacionPreview.classList.add("is-miss");
    ubicacionPreview.innerHTML = `
      <p class="ubicacion-ready-title">No se pudo marcar el punto</p>
      <p class="help">
        Copia el enlace con <strong>Compartir → Copiar enlace</strong> en Google Maps
        (o la ubicación de WhatsApp) y pégalo con el botón <strong>Pegar enlace</strong>.
      </p>`;
  }

  async function readJson(res) {
    const rawBody = await res.text();
    try {
      return JSON.parse(rawBody);
    } catch (_) {
      return null;
    }
  }

  async function geocodeQuery(query) {
    const res = await fetch(`/api/maps-geocode?q=${encodeURIComponent(query)}`, {
      signal:
        typeof AbortSignal !== "undefined" && AbortSignal.timeout
          ? AbortSignal.timeout(8000)
          : undefined,
    });
    return readJson(res);
  }

  function applyPin(coords, label) {
    applyUbicacion({
      mapsUrl: mapsUrlFromCoords(coords.lat, coords.lng),
      lat: coords.lat,
      lng: coords.lng,
      label,
    });
  }

  async function syncUbicacionFromInput() {
    const raw = String(ubicacionInput?.value || "").trim();
    const visibleLat = String(ubicacionLatVisible?.value || "").trim();
    const visibleLng = String(ubicacionLngVisible?.value || "").trim();
    if (!raw && !(visibleLat && visibleLng)) {
      applyUbicacion({ mapsUrl: "" });
      return;
    }
    if (
      raw === appliedUbicacionInput &&
      String(ubicacionLat?.value || "").trim() &&
      String(ubicacionLng?.value || "").trim()
    ) {
      return;
    }

    // Prioridad: coordenadas pegadas o escritas (lat, lng).
    let coords =
      validCoord(visibleLat.replace(",", "."), visibleLng.replace(",", ".")) ||
      coordsFromText(raw) ||
      coordsFromText(`${visibleLat}, ${visibleLng}`);
    if (coords) {
      applyPin(coords, `${coords.lat}, ${coords.lng}`);
      return;
    }

    const foundUrl = pastedMapsUrl(raw);
    if (foundUrl && isMapsUrl(foundUrl)) {
      const reqId = ++ubicacionRequest;
      showUbicacionLoading();
      try {
        const res = await fetch(`/api/maps-resolve?url=${encodeURIComponent(foundUrl)}`, {
          signal:
            typeof AbortSignal !== "undefined" && AbortSignal.timeout
              ? AbortSignal.timeout(8000)
              : undefined,
        });
        const data = await readJson(res);
        if (reqId !== ubicacionRequest) return;
        if (data?.lat && data?.lng) coords = { lat: String(data.lat), lng: String(data.lng) };
        else if (data?.url) coords = coordsFromText(data.url);
        if (!coords && data?.query) {
          const geo = await geocodeQuery(data.query);
          if (reqId !== ubicacionRequest) return;
          if (geo?.ok && geo.lat && geo.lng) coords = { lat: String(geo.lat), lng: String(geo.lng) };
        }
      } catch (_) {}
      if (reqId !== ubicacionRequest) return;
      if (coords) {
        applyPin(coords, `${coords.lat}, ${coords.lng}`);
        return;
      }
      showUbicacionMiss();
      showToast("Ese texto no trae coordenadas. Pega latitud y longitud.");
      return;
    }

    showUbicacionMiss();
    showToast("Pega coordenadas como 19.432608, -99.133209");
  }

  function queueUbicacionSync(delay = 350) {
    if (ubicacionTimer) clearTimeout(ubicacionTimer);
    ubicacionTimer = setTimeout(() => {
      ubicacionTimer = 0;
      syncUbicacionFromInput();
    }, delay);
  }

  function hasUbicacionPuntoVenta() {
    const lat = String(ubicacionLat?.value || "").trim();
    const lng = String(ubicacionLng?.value || "").trim();
    return Boolean(lat && lng && validCoord(lat, lng));
  }

  function loadMapsPlaces(apiKey) {
    return new Promise((resolve, reject) => {
      if (window.google?.maps?.places) {
        resolve(window.google.maps);
        return;
      }
      const cb = `mapsInit_${Date.now()}`;
      window[cb] = () => {
        delete window[cb];
        resolve(window.google.maps);
      };
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${cb}`;
      script.async = true;
      script.onerror = () => reject(new Error("No se pudo cargar Google Maps"));
      document.head.appendChild(script);
    });
  }

  async function initUbicacionPicker() {
    if (!ubicacionInput) return;
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (!data.mapsApiKey) return;
      const maps = await loadMapsPlaces(data.mapsApiKey);
      const autocomplete = new maps.places.Autocomplete(ubicacionInput, {
        componentRestrictions: { country: "mx" },
        fields: ["formatted_address", "geometry", "name", "url"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const loc = place.geometry?.location;
        const lat = loc ? loc.lat() : "";
        const lng = loc ? loc.lng() : "";
        const label = place.name
          ? `${place.name}${place.formatted_address ? ` — ${place.formatted_address}` : ""}`
          : place.formatted_address || ubicacionInput.value;
        const mapsUrl =
          place.url || (lat !== "" && lng !== "" ? mapsUrlFromCoords(lat, lng) : String(ubicacionInput.value || ""));
        setUbicacion({ label, mapsUrl, lat, lng });
      });
    } catch (_) {
      // Sin autocomplete: siguen valiendo pegar enlace o detectar ubicación.
    }
  }

  const btnPegarUbicacion = document.getElementById("btnPegarUbicacion");

  btnDetectarUbicacion?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Tu navegador no permite detectar ubicación.");
      return;
    }
    btnDetectarUbicacion.disabled = true;
    const labelEl = btnDetectarUbicacion.querySelector("strong");
    const prev = labelEl?.textContent || "";
    if (labelEl) labelEl.textContent = "Detectando ubicación…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setUbicacion({
          label: `${lat}, ${lng}`,
          mapsUrl: mapsUrlFromCoords(lat, lng),
          lat,
          lng,
        });
        showToast("Listo: coordenadas detectadas.");
        btnDetectarUbicacion.disabled = false;
        if (labelEl) labelEl.textContent = prev || "Opción 1 · Usar mi ubicación ahora";
      },
      () => {
        showToast("No se pudo obtener tu ubicación. Escribe latitud y longitud.");
        btnDetectarUbicacion.disabled = false;
        if (labelEl) labelEl.textContent = prev || "Opción 1 · Usar mi ubicación ahora";
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });

  btnUsarCoordenadas?.addEventListener("click", () => {
    applyCoordsFromFields(String(ubicacionInput?.value || ""));
  });

  btnPegarUbicacion?.addEventListener("click", async () => {
    if (!ubicacionInput) return;
    try {
      const text = String((await navigator.clipboard.readText()) || "").trim();
      if (!text) {
        showToast("El portapapeles está vacío. Copia las coordenadas y vuelve a intentar.");
        return;
      }
      ubicacionInput.value = text;
      const pin = coordsFromText(text);
      if (pin) {
        syncVisibleCoords(pin.lat, pin.lng);
        applyPin(pin, `${pin.lat}, ${pin.lng}`);
        showToast("Coordenadas pegadas.");
        return;
      }
      ubicacionInput.focus();
      showToast("Pega un par como 19.432608, -99.133209");
      await syncUbicacionFromInput();
    } catch (_) {
      showToast("No se pudo pegar solo. Mantén presionado el cuadro y elige Pegar.");
      ubicacionInput.focus();
    }
  });

  function onVisibleCoordInput() {
    const lat = String(ubicacionLatVisible?.value || "").trim();
    const lng = String(ubicacionLngVisible?.value || "").trim();
    if (lat && lng) queueUbicacionSync(250);
  }
  ubicacionLatVisible?.addEventListener("input", onVisibleCoordInput);
  ubicacionLngVisible?.addEventListener("input", onVisibleCoordInput);
  ubicacionLatVisible?.addEventListener("blur", () => applyCoordsFromFields());
  ubicacionLngVisible?.addEventListener("blur", () => {
    if (String(ubicacionLatVisible?.value || "").trim() && String(ubicacionLngVisible?.value || "").trim()) {
      applyCoordsFromFields();
    }
  });

  ubicacionInput?.addEventListener("input", () => {
    const raw = String(ubicacionInput.value || "");
    const pin = coordsFromText(raw);
    if (pin) syncVisibleCoords(pin.lat, pin.lng);
    queueUbicacionSync(pin || pastedMapsUrl(raw) ? 120 : 700);
  });
  ubicacionInput?.addEventListener("paste", (event) => {
    const clip = event.clipboardData?.getData("text") || "";
    setTimeout(() => {
      if (clip && ubicacionInput && !String(ubicacionInput.value || "").trim()) {
        ubicacionInput.value = clip;
      }
      const pin = coordsFromText(String(ubicacionInput?.value || clip || ""));
      if (pin) syncVisibleCoords(pin.lat, pin.lng);
      queueUbicacionSync(60);
    }, 0);
  });
  ubicacionInput?.addEventListener("blur", () => syncUbicacionFromInput());
  ubicacionInput?.addEventListener("change", () => syncUbicacionFromInput());

  function lonaCount() {
    return 1;
  }

  function toldoCount() {
    return 1;
  }

  function caballeteCount() {
    return 1;
  }

  const CONTACTO_OPTS = [
    "Número telefónico",
    "WhatsApp",
    "Redes sociales",
    "Ninguno",
  ];

  function fileFieldHtml(label, name, required = false) {
    return `
      <label class="field file-field">
        <span>${label}${required ? ' <span class="req">*</span>' : ""}</span>
        <div class="file-drop">
          <input type="file" name="${name}" accept=".jpg,.jpeg,.png,.heic,.heif,.pdf,image/jpeg,image/png,image/heic,image/heif,application/pdf" data-preview multiple ${required ? "required" : ""} />
          <div class="file-drop-copy">
            <strong>Sube o selecciona las imágenes</strong>
            <small>Puedes elegir varias. JPG, PNG o PDF</small>
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

  function materialNombre(prefix) {
    if (prefix === "toldo") return "toldo";
    if (prefix === "caballete") return "caballete";
    return "lona";
  }

  function designFieldsHtml(prefix, i) {
    const mat = materialNombre(prefix);
    return `
      <div class="design-block">
        <h4>Contenido y diseño</h4>
        ${fileFieldHtml("Logotipo del punto de venta", `logo_${prefix}_${i}`, true)}
        <label class="field">
          <span>Ingresa el texto que quieres comunicar en tu ${mat}</span>
          <textarea name="texto_${prefix}_${i}" rows="3" placeholder="Opcional. Mercadotecnia podrá ajustar el texto."></textarea>
        </label>
        <fieldset class="choice-group" data-multi="true" data-required="true">
          <legend>Datos de contacto que deberán aparecer en tu ${mat} <span class="req">*</span></legend>
          <p class="multi-hint">Puedes elegir más de una respuesta.</p>
          ${CONTACTO_OPTS.map(
            (c) =>
              `<label class="choice"><input type="checkbox" name="contacto_${prefix}_${i}" value="${escapeHtml(c)}" data-contacto="${prefix}_${i}" /><span>${escapeHtml(c)}</span></label>`,
          ).join("")}
        </fieldset>
        <label class="field" data-contacto-detalle="${prefix}_${i}" hidden>
          <span>Captura los datos de contacto de tu ${mat} <span class="req">*</span></span>
          <textarea name="contactoDetalle_${prefix}_${i}" rows="3" required placeholder="Teléfono, WhatsApp, redes…"></textarea>
        </label>
        <fieldset class="choice-group compact">
          <legend>¿Existe un diseño anterior como referencia para tu ${mat}? <span class="req">*</span></legend>
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

  async function makeLightPreviewUrl(file) {
    // Phone cameras often shoot 3–12 MB; showing the original freezes mid-range Android.
    if (file.size < 350 * 1024) return URL.createObjectURL(file);
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch (_) {
      return URL.createObjectURL(file);
    }
    const scale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      bitmap.close?.();
      return URL.createObjectURL(file);
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
    if (!blob) return URL.createObjectURL(file);
    return URL.createObjectURL(blob);
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

      // El input cubre todo el .file-drop (CSS). No bloquear pointer-events:
      // el click sintético falla en Safari/Android y deja sin poder subir.
      input.style.pointerEvents = "";
      input.style.cursor = "pointer";

      input.addEventListener("change", async () => {
        clearPreview();
        const files = [...(input.files || [])];
        const file = files[0];
        if (!file || !preview || !media || !nameEl || !sizeEl) return;
        nameEl.textContent = files.length > 1 ? `${files.length} archivos` : file.name;
        sizeEl.textContent =
          files.length > 1
            ? files.map((item) => item.name).join(", ")
            : formatBytes(file.size);
        if (file.size > WARN_FILE_MB * 1024 * 1024) {
          showToast(`La foto pesa ${formatBytes(file.size)}. Si puedes, súbela más liviana para evitar traba en el celular.`);
        }
        const isImage =
          /^image\//.test(file.type) || /\.(jpe?g|png|heic|heif|webp)$/i.test(file.name);
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        if (isImage) {
          try {
            objectUrl = await makeLightPreviewUrl(file);
          } catch (_) {
            objectUrl = URL.createObjectURL(file);
          }
          media.innerHTML = `<img src="${objectUrl}" alt="Vista previa" decoding="async" />`;
        } else if (isPdf) {
          media.innerHTML = `<div class="file-doc-badge" aria-hidden="true">PDF</div>`;
        } else {
          media.innerHTML = `<div class="file-doc-badge" aria-hidden="true">DOC</div>`;
        }
        preview.hidden = false;
        if (copy) copy.hidden = true;
        drop?.classList.add("has-file");
        scheduleSyncFormSteps(true);
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
          <fieldset class="choice-group compact" data-required="true">
            <legend>Orientación del diseño <span class="req">*</span></legend>
            ${ORIENTACIONES.map(
              (o) =>
                `<label class="choice"><input type="radio" name="orientacion_${i}" value="${escapeHtml(o)}" /><span>${escapeHtml(o)}</span></label>`,
            ).join("")}
          </fieldset>
          <fieldset class="choice-group" data-multi="true" data-required="true">
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
          <fieldset class="choice-group compact" data-required="true">
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
            <fieldset class="choice-group compact" data-required="true">
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
          <fieldset class="choice-group compact" data-required="true">
            <legend>Caras a imprimir <span class="req">*</span></legend>
            ${CARAS_CABALLETE.map(
              (c) =>
                `<label class="choice"><input type="radio" name="caras_${i}" value="${escapeHtml(c)}" /><span>${escapeHtml(c)}</span></label>`,
            ).join("")}
          </fieldset>
          <fieldset class="choice-group compact" data-required="true">
            <legend>Orientación del diseño <span class="req">*</span></legend>
            ${ORIENTACIONES.map(
              (o) =>
                `<label class="choice"><input type="radio" name="orientacionCab_${i}" value="${escapeHtml(o)}" /><span>${escapeHtml(o)}</span></label>`,
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
    const contacto = [...form.querySelectorAll(`input[name="contacto_${prefix}_${i}"]:checked`)].map(
      (el) => el.value,
    );
    return {
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
      out.push({
        caballete: count === 1 ? "Caballete 1" : `Caballete ${i}`,
        ancho: Number(block.querySelector('[data-k="ancho"]')?.value || 0),
        alto: Number(block.querySelector('[data-k="alto"]')?.value || 0),
        caras: form.querySelector(`input[name="caras_${i}"]:checked`)?.value || "",
        orientacion: form.querySelector(`input[name="orientacionCab_${i}"]:checked`)?.value || "",
        ...collectDesign("caballete", i),
      });
    }
    return out;
  }

  function collectRotulacion() {
    if (!isRotulacion()) return null;
    return {
      permisos: form.querySelector('input[name="rotulacionPermisos"]:checked')?.value || "",
      clasificacion:
        form.querySelector('input[name="rotulacionClasificacion"]:checked')?.value || "",
      color: form.querySelector('input[name="rotulacionColor"]:checked')?.value || "",
      evidenciaTipo: rotulacionEvidenciaTipo(),
    };
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
    const group = el.closest(".choice-group, .field, .lona-block, .color-picker");
    if (group) group.classList.add("is-invalid");
  }

  function validate() {
    clearInvalid();
    const errors = [];

    if (!selectedZonaComercial()) {
      errors.push("Indica si la solicitud es de Centro o Foráneo.");
      markInvalid(form.querySelector('input[name="zonaComercial"]'));
      return errors;
    }

    if (!selectedMaterial()) {
      errors.push("Selecciona el material a solicitar.");
      markInvalid(form.querySelector('input[name="material"]'));
      return errors;
    }

    if (
      selectedZonaComercial() === "Foráneo" &&
      selectedMaterial() !== "Lona" &&
      selectedMaterial() !== "Rotulación"
    ) {
      errors.push("En Foráneo solo se puede solicitar Lona especializada o Rotulación.");
      markInvalid(form.querySelector('input[name="material"]'));
      return errors;
    }

    if (isLona() || isRotulacion()) {
      const xray = [...form.querySelectorAll('input[name="xray_cliente"]')].find((input) => {
        const step = input.closest("[data-form-step]");
        return Boolean(step && !step.hidden && isStepApplicable(step));
      });
      if (!xray?.files?.length) {
        errors.push("Sube la captura de X-ray por cliente.");
        markInvalid(xray);
        return errors;
      }
    }

    const requiredText = [
      ["ejecutivoNombre", "Captura el nombre del ejecutivo."],
      ["ejecutivoTelefono", "Captura el teléfono del ejecutivo."],
      ["gerenteTelefono", "Captura el teléfono del gerente."],
      ["yaavserNombre", "Captura el nombre del YAAVSER."],
      ["claveYaavser", "Captura la clave YAAVSER."],
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

    const ejecutivoTel = form.elements.ejecutivoTelefono;
    if (ejecutivoTel && ejecutivoTel.value && !/^\d{10}$/.test(ejecutivoTel.value)) {
      errors.push("El teléfono del ejecutivo debe tener 10 dígitos.");
      markInvalid(ejecutivoTel);
    }

    const gerenteTel = form.elements.gerenteTelefono;
    if (gerenteTel && gerenteTel.value && !/^\d{10}$/.test(gerenteTel.value)) {
      errors.push("El teléfono del gerente debe tener 10 dígitos.");
      markInvalid(gerenteTel);
    }

    const yaavserTel = form.elements.yaavserTelefono;
    if (yaavserTel && yaavserTel.value && !/^\d{10}$/.test(yaavserTel.value)) {
      errors.push("El teléfono del YAAVSER debe tener 10 dígitos.");
      markInvalid(yaavserTel);
    }

    const multiRequired = [
      ["tipoEstablecimiento", "Selecciona el tipo de establecimiento."],
    ];
    if (!isRotulacion()) {
      multiRequired.push(["objetivoLona", "Selecciona el objetivo del material."]);
    }
    for (const [name, msg] of multiRequired) {
      const vals = checkedValues(name);
      if (!vals.length) {
        errors.push(msg);
        markInvalid(form.querySelector(`input[name="${name}"]`));
      }
    }

    if (isToldo() || isRotulacion()) {
      if (!hasUbicacionPuntoVenta()) {
        errors.push(
          "Falta la ubicación. Usa “Usar mi ubicación ahora” o escribe latitud y longitud hasta que diga Listo.",
        );
        markInvalid(ubicacionInput);
        document.getElementById("toldoPuntoVentaExtra")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    if (isToldo()) {
      const foto = form.querySelector('input[name="toldo_foto"]');
      if (!foto?.files?.length) {
        errors.push("Sube la foto del punto de venta.");
        markInvalid(foto);
      }
    }

    form.querySelectorAll('input[type="file"]').forEach((input) => {
      if (input.closest("[hidden]")) return;
      if (input.style.pointerEvents === "none") return;
      if (input.files?.length) return;
      const label = String(input.closest("label")?.querySelector("span")?.textContent || "la foto")
        .replace(/\*/g, "")
        .trim();
      errors.push(`Sube ${label}. No se puede enviar si falta.`);
      markInvalid(input);
    });

    if (isLona()) {
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
      const toldos = collectToldos();
      if (!toldos.length) errors.push("Completa las especificaciones del toldo.");
      toldos.forEach((t, idx) => {
        const i = idx + 1;
        const block = toldosSpecs.querySelector(`[data-toldo="${i}"]`);
        if (!t.tipo) {
          errors.push(`Selecciona el tipo de ${t.toldo}.`);
          markInvalid(block);
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
        validateDesign("caballete", i, c.caballete, errors);
      });
    }

    if (isRotulacion()) {
      const r = collectRotulacion();
      if (!r?.permisos) {
        errors.push("Indica si el punto de venta cuenta con permisos gubernamentales.");
        markInvalid(form.querySelector('input[name="rotulacionPermisos"]'));
      }
      if (!r?.clasificacion) {
        errors.push("Selecciona la clasificación del punto de venta.");
        markInvalid(form.querySelector('input[name="rotulacionClasificacion"]'));
      }
      if (!r?.color) {
        errors.push("Selecciona el color de la rotulación.");
        markInvalid(form.querySelector('input[name="rotulacionColor"]'));
      }
      if (!r?.evidenciaTipo) {
        errors.push("Selecciona la clasificación del punto de venta para definir la evidencia fotográfica.");
        markInvalid(form.querySelector('input[name="rotulacionClasificacion"]'));
      } else {
        const f1 = form.querySelector('input[name="rotulacion_foto_1"]');
        if (!f1?.files?.length) {
          errors.push(
            r.evidenciaTipo === "esquina"
              ? "Sube la foto del lateral izquierdo."
              : "Sube la fotografía frontal completa.",
          );
          markInvalid(f1);
        }
        if (r.evidenciaTipo === "esquina") {
          const f2 = form.querySelector('input[name="rotulacion_foto_2"]');
          if (!f2?.files?.length) {
            errors.push("Sube la foto del lateral derecho.");
            markInvalid(f2);
          }
        }
      }
    }

    return [...new Set(errors)];
  }

  function buildAnswers() {
    const mat = selectedMaterial();
    const base = {
      material: mat,
      zonaComercial: selectedZonaComercial(),
      ejecutivoNombre: String(form.elements.ejecutivoNombre?.value || "").trim(),
      ejecutivoTelefono: String(form.ejecutivoTelefono.value || "").trim(),
      gerenteTerritorial: String(form.elements.gerenteTerritorial?.value || "").trim(),
      territorioGerente: String(form.territorioGerente?.value || "").trim(),
      gerenteTelefono: String(form.gerenteTelefono?.value || "").trim(),
      yaavserNombre: String(form.yaavserNombre.value || "").trim(),
      claveYaavser: String(form.claveYaavser.value || "").trim().toUpperCase(),
      yaavserTelefono: String(form.yaavserTelefono?.value || "").trim(),
      puntoVenta: String(form.puntoVenta.value || "").trim(),
      puntoVentaUbicacion: String(form.puntoVentaUbicacion?.value || "").trim(),
      puntoVentaUbicacionMaps: String(form.puntoVentaUbicacionMaps?.value || "").trim(),
      puntoVentaLat: String(form.puntoVentaLat?.value || "").trim(),
      puntoVentaLng: String(form.puntoVentaLng?.value || "").trim(),
      tipoEstablecimiento: checkedValues("tipoEstablecimiento"),
      tipoEstablecimientoOtro: String(form.tipoEstablecimientoOtro?.value || "").trim(),
      objetivoLona: checkedValues("objetivoLona"),
      confirmaciones: [],
      observacionesAdicionales: String(form.observacionesAdicionales?.value || "").trim(),
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

    if (mat === "Rotulación") {
      return {
        ...base,
        rotulacion: collectRotulacion(),
      };
    }

    return {
      ...base,
      cantidadToldos: toldoCount(),
      toldos: collectToldos(),
    };
  }

  function appendSelectedFiles(fd) {
    form.querySelectorAll('input[type="file"]').forEach((input) => {
      if (!input.name) return;
      const step = input.closest("[data-form-step]");
      if (step?.hidden || input.closest("[hidden]")) return;
      if (input.style.pointerEvents === "none" && !input.files?.length) return;
      for (const file of input.files || []) fd.append(input.name, file);
    });
  }

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    let alreadySynced = false;
    if (t.name === "material") {
      syncMaterial();
      alreadySynced = true;
    }
    if (t.name === "rotulacionPermisos" || t.name === "rotulacionClasificacion") {
      syncRotulacionUi();
      alreadySynced = true;
    }
    if (t.hasAttribute("data-contacto")) syncContacto();
    if (t.hasAttribute("data-ref") || t.name?.startsWith("referencia_")) syncReferencia();
    if (!alreadySynced) scheduleSyncFormSteps(true);
  });

  // Debounce: each keystroke used to rescan the whole form and freeze mid-range phones.
  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === "file") return;
    scheduleSyncFormSteps(false);
  });

  let sending = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    sending = true;
    let succeeded = false;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando…";
    }
    try {
      if (ubicacionInput && (isToldo() || isRotulacion())) {
        await syncUbicacionFromInput();
      }
      if (hint) hint.textContent = "";
      const errors = validate();
      if (errors.length) {
        if (hint) hint.textContent = errors[0];
        showToast(errors[0]);
        const first = form.querySelector(".is-invalid");
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const heavy = [...form.querySelectorAll('input[type="file"]')].some((input) =>
        [...(input.files || [])].some((file) => file.size > 12 * 1024 * 1024),
      );
      if (heavy) {
        const msg = "Una foto pesa más de 12 MB. Elige una más ligera o tómala de nuevo.";
        if (hint) hint.textContent = msg;
        showToast(msg);
        return;
      }

      const fd = new FormData();
      fd.append("answers", JSON.stringify(buildAnswers()));
      appendSelectedFiles(fd);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);
      let res;
      try {
        res = await fetch("/api/submit", { method: "POST", body: fd, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (_) {
        data = null;
      }
      if (!data || typeof data !== "object") {
        throw new Error(
          res.status === 413
            ? "Las fotos pesan demasiado. Elige imágenes más ligeras."
            : "No se pudo completar el envío. Revisa tu conexión e inténtalo otra vez.",
        );
      }
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo enviar");
      const folio = data.folio || "—";
      try {
        sessionStorage.setItem(SUBMITTED_KEY, folio);
      } catch (_) {}
      succeeded = true;
      if (submitBtn) submitBtn.textContent = "Enviado";
      showThanks(folio);
    } catch (err) {
      const msg =
        err?.name === "AbortError"
          ? "El envío tardó demasiado. Revisa tu conexión e inténtalo otra vez."
          : err?.message || "Error al enviar";
      showToast(msg);
      if (hint) hint.textContent = msg;
    } finally {
      if (!succeeded) {
        sending = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Enviar solicitud";
        }
      }
    }
  });

  renderLonas();
  renderToldos();
  renderCaballetes();
  // Incluye X-ray (Centro/Foráneo) y el resto de inputs estáticos del formulario.
  bindFilePreviews(form);
  if (toldoPuntoVentaExtra) bindFilePreviews(toldoPuntoVentaExtra);
  if (flowRotulacion) bindFilePreviews(flowRotulacion);
  initUbicacionPicker();
  syncZona();
  syncRotulacionUi();
  syncContacto();
  syncReferencia();
  syncFormSteps();
})();
