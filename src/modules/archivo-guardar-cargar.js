// ============================================================================
// archivo-guardar-cargar.js
// Guardar/Cargar proyecto como archivo .json — memoria portátil del proyecto.
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// Guardar / Cargar proyecto (.fss) — memoria portátil, sin guardado local
// ============================================================================
// El .fss es un .json "enmascarado": mismo contenido, pero en base64 con un
// prefijo identificador, para que no se abra/edite por error como texto
// plano. Los .json exportados con versiones anteriores se siguen aceptando
// al importar (se detecta por la ausencia del prefijo FSS_MAGIC).
const FSS_MAGIC = "FSS1:";

function enmascararFSS(jsonString) {
  return FSS_MAGIC + btoa(unescape(encodeURIComponent(jsonString)));
}

function desenmascararFSS(contenido) {
  if (contenido.startsWith(FSS_MAGIC)) {
    const b64 = contenido.slice(FSS_MAGIC.length);
    return decodeURIComponent(escape(atob(b64)));
  }
  return contenido; // compatibilidad: .json plano exportado antes del formato .fss
}

function descargarArchivo(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportarProyectoJSON() {
  const payload = datosProyectoActual();
  const nombre = (PROJECT_INFO.nombre || "proyecto").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "proyecto";
  const jsonStr = JSON.stringify(payload, null, 1);
  descargarArchivo(`${nombre}-cortafuego.fss`, enmascararFSS(jsonStr), "application/octet-stream");
  mostrarToast("Proyecto descargado como archivo .fss");
}

function aplicarProyectoImportado(data) {
  pushUndo();
  ROWS = data.filas.map(f => Object.assign(nuevaFila(), f, { _id: ROW_SEQ++ }));
  if (Array.isArray(data.filasJuntas)) ROWS_J = data.filasJuntas.map(f => Object.assign({}, f, { _id: ROW_J_SEQ++ }));
  MANUAL_ITEMS = Array.isArray(data.itemsManuales) ? data.itemsManuales.map(m => Object.assign({}, m, { _id: MANUAL_ITEM_SEQ++ })) : [];
  if (data.config) Object.assign(CONFIG, data.config);
  if (data.projectInfo) Object.assign(PROJECT_INFO, data.projectInfo);
  if (data.mainTableOverride) { MAIN_TABLE = data.mainTableOverride; guardarMatricesLocalStorage(); }
  if (data.juntasTableOverride) { JUNTAS_TABLE = data.juntasTableOverride; guardarMatricesLocalStorage(); }
  sincronizarCamposConfig();
  renderTable();
  if (ACTIVE_TAB === "resumen") renderResumen();
  if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
  marcarCambio();
  mostrarToast(`Proyecto cargado: ${ROWS.length} fila(s).`);
}

function importarProyectoJSON(file) {
  const reader = new FileReader();
  reader.onerror = () => mostrarToast("No se pudo leer el archivo seleccionado.", "error");
  reader.onload = () => {
    let data;
    try {
      const contenido = desenmascararFSS(reader.result);
      data = JSON.parse(contenido);
      if (!data || !Array.isArray(data.filas)) throw new Error("Formato no reconocido");
    } catch (err) {
      mostrarToast("No se pudo leer el archivo. Verificá que sea un .fss (o .json) exportado desde esta calculadora.", "error");
      return;
    }
    if (ROWS.length > 0) {
      pedirConfirmacion("Esto va a reemplazar las filas actuales del proyecto. ¿Continuar?", () => aplicarProyectoImportado(data));
    } else {
      aplicarProyectoImportado(data);
    }
  };
  reader.readAsText(file);
}

function sincronizarCamposConfig() {
  ["C13", "C14", "C15"].forEach(id => { const el = document.getElementById("cfg-" + id); if (el) el.value = CONFIG[id]; });
  const c17 = document.getElementById("cfg-C17"); if (c17) c17.value = CONFIG.C17 * 100;
  const c17j = document.getElementById("cfg-C17_JUNTAS"); if (c17j) c17j.value = CONFIG.C17_JUNTAS * 100;
  ["UMB_FS", "UMB_CP606", "UMB_SILGG"].forEach(id => { const el = document.getElementById("cfg-" + id); if (el) el.value = CONFIG[id]; });
  const pn = document.getElementById("proj-nombre"); if (pn) pn.value = PROJECT_INFO.nombre;
  const pc = document.getElementById("proj-cliente"); if (pc) pc.value = PROJECT_INFO.cliente;
  const pf = document.getElementById("proj-fecha"); if (pf) pf.value = PROJECT_INFO.fecha;
}

// ============================================================================