// ============================================================================
// archivo-estado-app.js
// Archivo — Nuevo/Abrir/Guardar/Guardar como (comportamiento tipo Word), autoguardado en localStorage, pila de Deshacer, y Borrar Todo.
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// ARCHIVO — Nuevo / Abrir / Guardar / Guardar como (comportamiento tipo Word)
//
// El "documento" de esta app es un .html autocontenido con el proyecto
// embebido (igual a "Descargar app con este proyecto"). Al abrirlo de nuevo
// (doble clic, o con "Abrir"), la app carga los datos automáticamente — como
// abrir un .docx. Abrir el archivo plantilla (sin datos embebidos) arranca
// en blanco — como abrir Word sin ningún documento.
//
// Donde el navegador lo permite (File System Access API, requiere http(s) o
// localhost — no funciona sobre file://), "Guardar" reescribe el mismo
// archivo en disco sin volver a preguntar. Si no está disponible, "Guardar"
// vuelve a descargar el archivo con el mismo nombre (mejor esfuerzo posible
// desde el navegador).
// ============================================================================
let CURRENT_FILE_HANDLE = null;
let CURRENT_FILE_NAME = null;
let ULTIMO_GUARDADO = null;
const FS_ACCESS_OK = typeof window.showSaveFilePicker === "function" && typeof window.showOpenFilePicker === "function";

function actualizarIndicadorArchivo() {
  const badge = document.getElementById("save-status-badge");
  const timeEl = document.getElementById("save-status-time");
  const wrap = document.getElementById("save-status");
  if (!badge || !timeEl || !wrap) return;
  const nombreTxt = CURRENT_FILE_NAME ? ` · ${CURRENT_FILE_NAME}` : "";
  if (ULTIMO_GUARDADO) {
    badge.className = "save-status-badge ok";
    badge.textContent = "✓";
    timeEl.textContent = ULTIMO_GUARDADO.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" });
    wrap.title = `Guardado a las ${ULTIMO_GUARDADO.toLocaleTimeString("es-CR")}${nombreTxt}`;
  } else {
    badge.className = "save-status-badge pending";
    badge.textContent = "✕";
    timeEl.textContent = "";
    wrap.title = `Sin guardar cambios aún${nombreTxt}`;
  }
}

function marcarGuardado() {
  ULTIMO_GUARDADO = new Date();
  actualizarIndicadorArchivo();
}

async function guardarComoArchivo() {
  let htmlStr;
  try { htmlStr = construirHTMLConDatos(); } catch (err) { mostrarToast("No se pudo generar el archivo: " + err.message, "error"); return; }
  const sugerido = nombreArchivoSugerido();
  if (FS_ACCESS_OK) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: sugerido,
        types: [{ description: "Aplicación con proyecto (HTML)", accept: { "text/html": [".html"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(htmlStr);
      await writable.close();
      CURRENT_FILE_HANDLE = handle;
      CURRENT_FILE_NAME = handle.name;
      marcarGuardado();
      mostrarToast(`Guardado como "${handle.name}".`);
    } catch (err) {
      if (err.name !== "AbortError") mostrarToast("No se pudo guardar el archivo: " + err.message, "error");
    }
  } else {
    descargarArchivo(sugerido, htmlStr, "text/html");
    CURRENT_FILE_HANDLE = null;
    CURRENT_FILE_NAME = sugerido;
    marcarGuardado();
    mostrarToast(`Descargado como "${sugerido}". "Guardar" lo volverá a descargar con este mismo nombre.`);
  }
}

async function guardarArchivo() {
  if (FS_ACCESS_OK && CURRENT_FILE_HANDLE) {
    try {
      const htmlStr = construirHTMLConDatos();
      const writable = await CURRENT_FILE_HANDLE.createWritable();
      await writable.write(htmlStr);
      await writable.close();
      marcarGuardado();
      mostrarToast(`Guardado en "${CURRENT_FILE_HANDLE.name}".`);
      return;
    } catch (err) {
      mostrarToast("No se pudo guardar en el archivo original. Elegí dónde guardar de nuevo.", "error");
      CURRENT_FILE_HANDLE = null;
    }
  }
  if (!FS_ACCESS_OK && CURRENT_FILE_NAME) {
    let htmlStr;
    try { htmlStr = construirHTMLConDatos(); } catch (err) { mostrarToast("No se pudo generar el archivo: " + err.message, "error"); return; }
    descargarArchivo(CURRENT_FILE_NAME, htmlStr, "text/html");
    marcarGuardado();
    mostrarToast(`Guardado como "${CURRENT_FILE_NAME}".`);
    return;
  }
  await guardarComoArchivo();
}

function extraerDatosDeHTML(texto) {
  const match = texto.match(/<script[^>]*id=["']embedded-project-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match || !match[1].trim()) return null;
  try { return JSON.parse(match[1]); } catch (e) { return null; }
}

async function procesarArchivoAbierto(file, handle) {
  const texto = await file.text();
  let data = null;
  if (/\.json$/i.test(file.name)) {
    try { data = JSON.parse(texto); } catch (e) { data = null; }
  } else {
    data = extraerDatosDeHTML(texto);
  }
  if (!data || !Array.isArray(data.filas)) {
    mostrarToast("No se pudo leer el archivo. Verificá que sea un proyecto guardado desde esta calculadora.", "error");
    return;
  }
  const aplicar = () => {
    aplicarProyectoImportado(data);
    CURRENT_FILE_HANDLE = handle || null;
    CURRENT_FILE_NAME = file.name;
    marcarGuardado();
  };
  if (ROWS.length > 0 || ROWS_J.length > 0) {
    pedirConfirmacion("Esto va a reemplazar el proyecto actual (sin guardar) por el del archivo. ¿Continuar?", aplicar);
  } else {
    aplicar();
  }
}

async function abrirArchivo() {
  if (FS_ACCESS_OK) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "Aplicación con proyecto (HTML o JSON)", accept: { "text/html": [".html"], "application/json": [".json"] } }]
      });
      const file = await handle.getFile();
      await procesarArchivoAbierto(file, handle);
    } catch (err) {
      if (err.name !== "AbortError") mostrarToast("No se pudo abrir el archivo: " + err.message, "error");
    }
  } else {
    document.getElementById("file-abrir-proyecto").click();
  }
}

function nuevoProyecto() {
  const hacer = () => {
    pushUndo();
    ROWS = [];
    ROWS_J = [];
    Object.assign(CONFIG, CONFIG_DEFAULT);
    PROJECT_INFO.nombre = ""; PROJECT_INFO.cliente = ""; PROJECT_INFO.fecha = "";
    sincronizarCamposConfig();
    CURRENT_FILE_HANDLE = null;
    CURRENT_FILE_NAME = null;
    ULTIMO_GUARDADO = null;
    actualizarIndicadorArchivo();
    borrarAutoguardado();
    renderTable();
    if (ACTIVE_TAB === "resumen") renderResumen();
    if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
    marcarCambio();
    mostrarToast("Proyecto nuevo. Empezá agregando filas o un levantamiento.");
  };
  if (ROWS.length > 0 || ROWS_J.length > 0) {
    pedirConfirmacion("Esto va a borrar el proyecto actual sin guardar. ¿Continuar?", hacer);
  } else {
    hacer();
  }
}

// ============================================================================
// AUTOGUARDADO (localStorage) — guarda automáticamente cada cambio para no
// perder el trabajo si se cierra o recarga el navegador por accidente.
// ============================================================================
const AUTOSAVE_KEY = "hiltiCortafuegoAutoguardado_v1";
let autosaveTimer = null;
function guardarAutoAhora() {
  try {
    const payload = datosProyectoActual();
    payload.guardadoEn = new Date().toISOString();
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
    marcarGuardado();
  } catch (e) {
    // localStorage puede fallar (cuota llena, modo privado, etc.) — no debe interrumpir la app
  }
}
function marcarCambio() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(guardarAutoAhora, 600);
}
function cargarAutoguardado() {
  try {
    const txt = localStorage.getItem(AUTOSAVE_KEY);
    if (!txt) return null;
    const data = JSON.parse(txt);
    if (!data || !Array.isArray(data.filas) || data.filas.length === 0) return null;
    return data;
  } catch (e) { return null; }
}
function borrarAutoguardado() {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) { /* ignorar */ }
}

// ============================================================================
// DESHACER — pila de snapshots de ROWS tomados antes de acciones destructivas
// (borrar fila, borrar todo, importar/reemplazar, editar cantidades, etc.)
// ============================================================================
let UNDO_STACK = [];
const UNDO_MAX = 25;
function pushUndo() {
  try {
    UNDO_STACK.push(JSON.stringify({ rows: ROWS, rowsJ: ROWS_J }));
    if (UNDO_STACK.length > UNDO_MAX) UNDO_STACK.shift();
  } catch (e) { /* ignorar */ }
  actualizarBotonDeshacer();
}
function actualizarBotonDeshacer() {
  const btn = document.getElementById("btn-deshacer");
  if (btn) btn.disabled = UNDO_STACK.length === 0;
}
function deshacerCambio() {
  if (UNDO_STACK.length === 0) { mostrarToast("No hay cambios para deshacer.", "error"); return; }
  const prev = JSON.parse(UNDO_STACK.pop());
  ROWS = prev.rows || prev;
  ROWS_J = prev.rowsJ || [];
  const maxId = ROWS.reduce((m, r) => Math.max(m, r._id || 0), 0);
  ROW_SEQ = Math.max(ROW_SEQ, maxId + 1);
  const maxIdJ = ROWS_J.reduce((m, r) => Math.max(m, r._id || 0), 0);
  ROW_J_SEQ = Math.max(ROW_J_SEQ, maxIdJ + 1);
  renderTable();
  if (ACTIVE_TAB === "resumen") renderResumen();
  if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
  if (document.body.classList.contains("modo-levantamiento")) renderLevantamiento();
  actualizarBotonDeshacer();
  marcarCambio();
  mostrarToast("Cambio revertido.");
}

// ============================================================================
// BORRAR TODO
// ============================================================================
function borrarTodo() {
  if (ROWS.length === 0 && ROWS_J.length === 0) { mostrarToast("No hay filas para borrar."); return; }
  pedirConfirmacion(
    `Esto va a borrar las ${ROWS.length} fila(s) de penetrantes y ${ROWS_J.length} de juntas. Podés deshacerlo con el botón "Deshacer". ¿Continuar?`,
    () => {
      pushUndo();
      ROWS = [];
      ROWS_J = [];
      renderTable();
      if (ACTIVE_TAB === "resumen") renderResumen();
      if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
      marcarCambio();
      mostrarToast("Se borraron todas las filas.");
    }
  );
}

function initApp() {
  const yearEl = document.getElementById("footer-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  cargarMatricesLocalStorage();
  const cargoEmbebido = cargarDatosEmbebidos();
  actualizarIndicadorArchivo();

  document.getElementById("btn-abrir-levantamiento").addEventListener("click", abrirLevantamiento);

  // Configuración ahora es un modal — ver tema-claro-oscuro.js
  document.getElementById("btn-abrir-levantamiento-juntas").addEventListener("click", abrirLevantamientoJuntas);
  document.getElementById("btn-cerrar-levantamiento").addEventListener("click", cerrarLevantamiento);
  document.getElementById("btn-lev-tab-abrir").addEventListener("click", abrirLevantamiento);
  document.getElementById("btn-levj-tab-abrir").addEventListener("click", abrirLevantamientoJuntas);

  document.getElementById("btn-abrir-instrucciones").addEventListener("click", () => {
    document.getElementById("instrucciones-modal").classList.add("open");
  });
  document.getElementById("btn-cerrar-instrucciones").addEventListener("click", () => {
    document.getElementById("instrucciones-modal").classList.remove("open");
  });
  document.getElementById("instrucciones-modal").addEventListener("click", (e) => {
    if (e.target.id === "instrucciones-modal") e.currentTarget.classList.remove("open");
  });

  document.getElementById("btn-add-row").addEventListener("click", () => {
    ROWS.push(nuevaFila());
    renderTable();
    marcarCambio();
  });
  document.getElementById("btn-add-5").addEventListener("click", () => {
    for (let i = 0; i < 5; i++) ROWS.push(nuevaFila());
    renderTable();
    marcarCambio();
  });
  document.getElementById("btn-deshacer").addEventListener("click", deshacerCambio);
  document.getElementById("btn-borrar-todo").addEventListener("click", borrarTodo);
  const filtroCalcEl = document.getElementById("input-filtro-calc");
  if (filtroCalcEl) filtroCalcEl.addEventListener("input", () => { FILTRO_CALC = filtroCalcEl.value; aplicarFiltroCalc(); });
  document.querySelectorAll(".tab-btn").forEach(b => {
    b.addEventListener("click", () => switchTab(b.dataset.tab));
  });

  // Config panel
  const cfgIds = ["C13", "C14", "C15", "C17", "C17_JUNTAS", "UMB_FS", "UMB_CP606", "UMB_SILGG"];
  const cfgPct = ["C17", "C17_JUNTAS"];
  cfgIds.forEach(id => {
    const el = document.getElementById("cfg-" + id);
    el.value = cfgPct.includes(id) ? CONFIG[id] * 100 : CONFIG[id];
    el.addEventListener("input", () => {
      const v = parseFloat(el.value);
      if (cfgPct.includes(id)) CONFIG[id] = isNaN(v) ? 0 : v / 100;
      else CONFIG[id] = isNaN(v) ? 0 : v;
      updateAllBadges();
      if (ACTIVE_TAB === "resumen") renderResumen();
      marcarCambio();
    });
  });

  attachTableEvents();

  // Datos del proyecto
  const projIds = [["proj-nombre", "nombre"], ["proj-cliente", "cliente"], ["proj-fecha", "fecha"]];
  projIds.forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    el.value = PROJECT_INFO[key];
    el.addEventListener("input", () => { PROJECT_INFO[key] = el.value; marcarCambio(); });
  });

  document.getElementById("btn-compartir").addEventListener("click", compartirReporte);

  // Menús desplegables del header (Archivo / PDF / Base de Datos) — abrir uno
  // cierra los demás, y un solo listener global cierra todos al hacer clic afuera.
  function posicionarDropdown(btn, panel) {
    const r = btn.getBoundingClientRect();
    // Ancho real del panel (aún oculto -> se mide con display:flex forzado brevemente)
    panel.style.left = "0px";
    panel.style.top = "0px";
    panel.style.visibility = "hidden";
    panel.style.display = "flex";
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    panel.style.display = "";
    panel.style.visibility = "";

    const margen = 8;
    let left = r.right - panelWidth; // alineado por defecto al borde derecho del botón
    left = Math.max(margen, Math.min(left, window.innerWidth - panelWidth - margen));
    let top = r.bottom + 6;
    if (top + panelHeight > window.innerHeight - margen) {
      top = Math.max(margen, r.top - panelHeight - 6); // si no cabe abajo, se abre hacia arriba
    }
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function registrarDropdown(btnId, panelId) {
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const yaAbierto = panel.classList.contains("open");
      document.querySelectorAll(".dropdown-panel.open").forEach(p => p.classList.remove("open"));
      if (!yaAbierto) {
        posicionarDropdown(btn, panel);
        panel.classList.add("open");
      }
    });
    panel.addEventListener("click", (e) => {
      if (e.target.closest(".dropdown-item")) panel.classList.remove("open");
    });
    return panel;
  }
  const menuPdfPanel = registrarDropdown("btn-menu-pdf", "dropdown-panel-pdf");
  const menuPanel = registrarDropdown("btn-menu-proyecto", "dropdown-panel-proyecto");
  document.addEventListener("click", (e) => {
    [["dropdown-pdf", menuPdfPanel], ["dropdown-proyecto", menuPanel]].forEach(([contId, panel]) => {
      if (!document.getElementById(contId).contains(e.target)) panel.classList.remove("open");
    });
  });
  // Los paneles usan position:fixed calculado al abrirse; si la página (o cualquier
  // contenedor interno) hace scroll, el panel queda "flotando" desconectado del botón.
  // Se cierran ambos ante cualquier scroll (capture:true para detectar scroll de listas internas).
  window.addEventListener("scroll", () => {
    [menuPdfPanel, menuPanel].forEach(p => p.classList.remove("open"));
  }, { capture: true, passive: true });

  document.getElementById("btn-pdf-completo").addEventListener("click", () => descargarPDF("completo"));
  document.getElementById("btn-pdf-levantamiento").addEventListener("click", () => descargarPDF("levantamiento"));
  document.getElementById("btn-pdf-resumen").addEventListener("click", () => descargarPDF("resumen"));
  document.getElementById("btn-pdf-memoria").addEventListener("click", descargarMemoriaCalculoPDF);

  document.getElementById("btn-bd-export-penetrantes").addEventListener("click", exportarMatrizPenetrantesExcel);
  document.getElementById("btn-bd-export-juntas").addEventListener("click", exportarMatrizJuntasExcel);
  document.getElementById("btn-bd-import-penetrantes").addEventListener("click", () => document.getElementById("file-import-matriz-penetrantes").click());
  document.getElementById("btn-bd-import-juntas").addEventListener("click", () => document.getElementById("file-import-matriz-juntas").click());
  document.getElementById("file-import-matriz-penetrantes").addEventListener("change", (e) => {
    if (e.target.files[0]) importarMatrizPenetrantesExcel(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("file-import-matriz-juntas").addEventListener("change", (e) => {
    if (e.target.files[0]) importarMatrizJuntasExcel(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("btn-bd-restaurar").addEventListener("click", restaurarMatricesOriginales);
  document.getElementById("btn-descargar-sistemas").addEventListener("click", descargarSistemasUL);
  document.getElementById("btn-descargar-fichas").addEventListener("click", descargarFichasTecnicas);
  document.getElementById("btn-descargar-submittal").addEventListener("click", descargarSubmittal);

  document.getElementById("btn-archivo-nuevo").addEventListener("click", nuevoProyecto);
  document.getElementById("btn-archivo-abrir").addEventListener("click", abrirArchivo);
  document.getElementById("btn-archivo-guardar").addEventListener("click", guardarArchivo);
  document.getElementById("btn-archivo-guardar-como").addEventListener("click", guardarComoArchivo);
  document.getElementById("file-abrir-proyecto").addEventListener("change", (e) => {
    if (e.target.files[0]) procesarArchivoAbierto(e.target.files[0], null);
    e.target.value = "";
  });
  document.getElementById("btn-export-json").addEventListener("click", exportarProyectoJSON);
  document.getElementById("btn-import-json").addEventListener("click", () => {
    document.getElementById("file-import-json").click();
  });
  document.getElementById("btn-import-excel").addEventListener("click", () => {
    document.getElementById("file-import-excel").click();
  });
  document.getElementById("btn-export-excel").addEventListener("click", exportarLevantamientoExcel);
  document.getElementById("btn-export-excel-lev-pen").addEventListener("click", exportarLevantamientoPenetrantesExcel);
  document.getElementById("btn-export-excel-lev-juntas").addEventListener("click", exportarLevantamientoJuntasExcel);
  document.getElementById("btn-import-txt").addEventListener("click", () => {
    document.getElementById("file-import-txt").click();
  });
  document.getElementById("file-import-json").addEventListener("change", (e) => {
    if (e.target.files[0]) importarProyectoJSON(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("file-import-excel").addEventListener("change", (e) => {
    if (e.target.files[0]) importarExcel(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("file-import-txt").addEventListener("change", (e) => {
    if (e.target.files[0]) importarTxt(e.target.files[0]);
    e.target.value = "";
  });

  actualizarBotonDeshacer();

  if (cargoEmbebido) {
    renderTable();
    renderLevantamientoTab();
    mostrarToast(`Proyecto cargado automáticamente: ${ROWS.length} fila(s).`);
  } else {
    const auto = cargarAutoguardado();
    if (auto) {
      ROWS = auto.filas.map(f => Object.assign(nuevaFila(), f, { _id: ROW_SEQ++ }));
      if (Array.isArray(auto.filasJuntas)) ROWS_J = auto.filasJuntas.map(f => Object.assign({}, f, { _id: ROW_J_SEQ++ }));
      MANUAL_ITEMS = Array.isArray(auto.itemsManuales) ? auto.itemsManuales.map(m => Object.assign({}, m, { _id: MANUAL_ITEM_SEQ++ })) : [];
      if (auto.config) Object.assign(CONFIG, auto.config);
      if (auto.projectInfo) Object.assign(PROJECT_INFO, auto.projectInfo);
      sincronizarCamposConfig();
      const pn = document.getElementById("proj-nombre"); if (pn) pn.value = PROJECT_INFO.nombre;
      const pc = document.getElementById("proj-cliente"); if (pc) pc.value = PROJECT_INFO.cliente;
      const pf = document.getElementById("proj-fecha"); if (pf) pf.value = PROJECT_INFO.fecha;
      renderTable();
      renderLevantamientoTab();
      mostrarToast(`Se restauró tu último autoguardado: ${ROWS.length} fila(s).`);
    } else {
      // Filas iniciales de ejemplo
      for (let i = 0; i < 3; i++) ROWS.push(nuevaFila());
      renderTable();
      renderLevantamientoTab();
    }
  }
}

document.addEventListener("DOMContentLoaded", initApp);

