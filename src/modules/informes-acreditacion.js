// ============================================================================
// informes-acreditacion.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
// INFORMES_ACREDITACION e INFORME_ACR_SEQ se declaran fuera del IIFE a propósito
// (con `var`, no `let`) — mismo patrón que PLANOS/PLANO_SEQ en planos.js. El
// guardado/carga de proyecto les hace reasignación directa, no solo mutación.
var INFORMES_ACREDITACION = [];
var INFORME_ACR_SEQ = 1;

(function () {
// --- Checklist cerrado (aprobado por Kevin) --------------------------------
const ACR_CHECKLIST_CUMPLE = {
  penetrante: [
    "Espesor de sello cumple el mínimo del sistema (contacto continuo / aplicación tipo volcán o anillo)",
    "Espesor de sello cumple el mínimo en espacio anular",
    "Vueltas de cinta intumescente correctas según sistema",
    "Collar metálico de retención presente y correctamente instalado",
    "Lana mineral de alta densidad como respaldo/relleno según sistema",
    "Instalación verificada por ambas caras de la pared/losa",
    "Sin compromisos de integridad visibles",
  ],
  junta_interior: [
    "Espesor de sello de junta cumple el mínimo del sistema",
    "Instalación verificada por ambos lados de la pared",
    "Junta sellada de forma continua, sin compromisos de integridad visibles",
  ],
  junta_muro_cortina: [
    "Espesor de spray/sellador cumple el mínimo del sistema",
    "Traslape correcto hacia la losa de concreto",
    "Traslape correcto hacia el elemento de fachada (aluminio/marco)",
    "Acabado uniforme sin discontinuidades",
  ],
};
const ACR_CHECKLIST_NOCUMPLE_COMUN = [
  "Espesor insuficiente respecto al mínimo del sistema",
  "Sello desplazado o movido posterior a la instalación",
  "Orificio o hueco detectado (sellado incompleto)",
  "Material distinto al especificado en el sistema UL",
  "Instalación pendiente (aún no ejecutada, con método/producto ya definido)",
  "Daño por terceros / contratistas externos, requiere reparación",
];
const ACR_CHECKLIST_NOCUMPLE = {
  penetrante: [
    "Faltan vueltas de cinta intumescente",
    "Falta collar metálico de retención",
    "Falta lana mineral de respaldo donde el sistema la requiere",
    "Falta instalación por una de las dos caras de la pared",
  ],
  junta_interior: [
    "Traslape insuficiente hacia losa/pared",
  ],
  junta_muro_cortina: [
    "Traslape insuficiente hacia losa/pared",
    "Traslape insuficiente hacia elemento de fachada (muro cortina)",
  ],
};
const ACR_CHECKLIST_LABEL_CORTO = {
  "Espesor de sello cumple el mínimo del sistema (contacto continuo / aplicación tipo volcán o anillo)": "Espesor OK (contacto continuo)",
  "Espesor de sello cumple el mínimo en espacio anular": "Espesor OK (espacio anular)",
  "Vueltas de cinta intumescente correctas según sistema": "Cinta correcta",
  "Collar metálico de retención presente y correctamente instalado": "Collar OK",
  "Lana mineral de alta densidad como respaldo/relleno según sistema": "Lana mineral OK",
  "Instalación verificada por ambas caras de la pared/losa": "Verificado ambas caras",
  "Sin compromisos de integridad visibles": "Sin daños visibles",
  "Espesor de sello de junta cumple el mínimo del sistema": "Espesor OK",
  "Instalación verificada por ambos lados de la pared": "Verificado ambos lados",
  "Junta sellada de forma continua, sin compromisos de integridad visibles": "Sellado continuo, sin daños",
  "Espesor de spray/sellador cumple el mínimo del sistema": "Espesor OK",
  "Traslape correcto hacia la losa de concreto": "Traslape a losa OK",
  "Traslape correcto hacia el elemento de fachada (aluminio/marco)": "Traslape a fachada OK",
  "Acabado uniforme sin discontinuidades": "Acabado uniforme",
  "Espesor insuficiente respecto al mínimo del sistema": "Espesor insuficiente",
  "Sello desplazado o movido posterior a la instalación": "Sello desplazado",
  "Orificio o hueco detectado (sellado incompleto)": "Orificio/hueco",
  "Material distinto al especificado en el sistema UL": "Material distinto",
  "Instalación pendiente (aún no ejecutada, con método/producto ya definido)": "Instalación pendiente",
  "Daño por terceros / contratistas externos, requiere reparación": "Daño por terceros",
  "Faltan vueltas de cinta intumescente": "Faltan vueltas de cinta",
  "Falta collar metálico de retención": "Falta collar metálico",
  "Falta lana mineral de respaldo donde el sistema la requiere": "Falta lana mineral",
  "Falta instalación por una de las dos caras de la pared": "Falta por una cara",
  "Traslape insuficiente hacia losa/pared": "Traslape insuficiente",
  "Traslape insuficiente hacia elemento de fachada (muro cortina)": "Traslape insuf. (fachada)",
};
function labelCortoChecklist(item) { return ACR_CHECKLIST_LABEL_CORTO[item] || item; }
const ACR_RECOMENDACION = {
  "Espesor insuficiente respecto al mínimo del sistema": "aumentar el espesor del sello hasta cumplir el mínimo indicado por el sistema UL",
  "Sello desplazado o movido posterior a la instalación": "repasar y resellar el punto afectado",
  "Orificio o hueco detectado (sellado incompleto)": "completar el sellado de forma pareja, sin huecos",
  "Material distinto al especificado en el sistema UL": "sustituir por el material especificado en el sistema UL correspondiente",
  "Instalación pendiente (aún no ejecutada, con método/producto ya definido)": "completar la instalación con el método y producto ya definidos",
  "Daño por terceros / contratistas externos, requiere reparación": "reparar el sector dañado por terceros",
  "Faltan vueltas de cinta intumescente": "completar las vueltas de cinta intumescente requeridas por el sistema",
  "Falta collar metálico de retención": "instalar el collar metálico de retención",
  "Falta lana mineral de respaldo donde el sistema la requiere": "instalar la lana mineral de respaldo requerida",
  "Falta instalación por una de las dos caras de la pared": "completar la instalación por la cara faltante de la pared",
  "Traslape insuficiente hacia losa/pared": "aumentar el traslape hacia la losa/pared hasta el mínimo requerido",
  "Traslape insuficiente hacia elemento de fachada (muro cortina)": "aumentar el traslape hacia el elemento de fachada hasta el mínimo requerido",
};

function normaParaSubtipo(categoria, subtipo) {
  if (categoria === "penetrante") return "UL 1479 / ASTM E814";
  if (subtipo === "muro_cortina") return "ASTM E2307 (UL y/o Intertek)";
  return "UL 2079 / ASTM E1966";
}
const PRODUCTOS_CON_CINTA = new Set(["Cinta con Collar Metálico CP 648-E/ER", "Cinta sin Collar Metálico CP 648-E"]);
const PRODUCTOS_CON_COLLAR_METALICO = new Set(["Cinta con Collar Metálico CP 648-E/ER", "Collarín CP 643N/644"]);
const TIPOS_CON_LANA_MINERAL = new Set([
  "Bandeja de Cables", "Ducto Rectangular", "Ducto Rectangular Aislado", "Ducto Redondo", "Ducto Redondo Aislado",
  "Pasante Múltiple", "Vacío", "Viga W", "Viga Canal", "Viga Tubo Rectangular",
]);
const PRODUCTOS_CON_LANA_MINERAL = new Set([
  "Espuma CP 620", "Almohadilla CFS-BL", 'Manga CP 653 4"', 'Paso de cables MSL M 3"x4"', 'Paso de cables MSL L 6"x4"', "Mortero CP 637",
]);
function elementoUsaCinta(el) { return PRODUCTOS_CON_CINTA.has(el.producto); }
function elementoUsaCollarMetalico(el) { return PRODUCTOS_CON_COLLAR_METALICO.has(el.producto); }
function elementoUsaLanaMineral(el) { return TIPOS_CON_LANA_MINERAL.has(el.tipoPenetrante) || PRODUCTOS_CON_LANA_MINERAL.has(el.producto); }
function checklistNoCumpleFor(el) {
  if (el.categoria !== "penetrante") {
    const especifico = el.subtipo === "muro_cortina" ? ACR_CHECKLIST_NOCUMPLE.junta_muro_cortina : ACR_CHECKLIST_NOCUMPLE.junta_interior;
    let items = ACR_CHECKLIST_NOCUMPLE_COMUN.concat(especifico);
    if (el.producto !== "CFS SP WB") {
      items = items.filter((i) => i !== "Traslape insuficiente hacia losa/pared" && i !== "Traslape insuficiente hacia elemento de fachada (muro cortina)");
    }
    return items;
  }
  let items = ACR_CHECKLIST_NOCUMPLE_COMUN.concat(ACR_CHECKLIST_NOCUMPLE.penetrante);
  if (!elementoUsaCinta(el)) {
    items = items.filter((i) => i !== "Faltan vueltas de cinta intumescente");
  } else {
    items = items.filter((i) => i !== "Espesor insuficiente respecto al mínimo del sistema");
  }
  if (!elementoUsaCollarMetalico(el)) items = items.filter((i) => i !== "Falta collar metálico de retención");
  if (!elementoUsaLanaMineral(el)) items = items.filter((i) => i !== "Falta lana mineral de respaldo donde el sistema la requiere");
  if (el.ubicacion !== "Pared") items = items.filter((i) => i !== "Falta instalación por una de las dos caras de la pared");
  return items;
}

function esTuberiaCombustible(tipo) {
  return !!tipo && tipo.indexOf("Tubería Combustible") === 0;
}
const PRODUCTOS_DIAMETRO_MAYOR_2 = new Set(["Cinta con Collar Metálico CP 648-E/ER", "Cinta sin Collar Metálico CP 648-E", "Collarín CP 643N/644"]);
function productoRequiereDiametroMayor2(producto) { return PRODUCTOS_DIAMETRO_MAYOR_2.has(producto); }
function opcionesProductoPenetrante(material, tipo, ubicacion, espacioAnular, diametro) {
  if (!material || !tipo || !ubicacion) return [];
  if (esTuberiaCombustible(tipo) && !diametro) return [];
  const ap = espacioAnular ? "Otro" : 0;
  const out = [];
  (window.OPTS_P || []).forEach((p) => {
    if (esTuberiaCombustible(tipo)) {
      const requiereMayor2 = productoRequiereDiametroMayor2(p);
      if (diametro === "mayor2" && !requiereMayor2) return;
      if (diametro === "menor2" && requiereMayor2) return;
    }
    const key = window.dbKey(material, tipo, ubicacion, ap, p);
    const row = window.MAIN_TABLE ? window.MAIN_TABLE[key] : null;
    if (row) out.push({ producto: p, sistemaUL: row[1], espesor: row[0] });
  });
  return out;
}
function resolverFilaJunta(junta, tipo, barreras, posicion, producto) {
  const candidatos = (window.JUNTAS_TABLE || []).filter((r) => r.j === junta && r.t === tipo && r.b === barreras && r.p === posicion && r.prod === producto);
  if (!candidatos.length) return null;
  return candidatos.reduce((a, b) => (b.max > a.max ? b : a));
}
function fraccion(v) {
  return (window.formatFraccionPulgadas ? window.formatFraccionPulgadas(v) : `${v}"`);
}
function ubicacionLabel(material) {
  return material === "Panel de Yeso" ? "Pared de Panel Liviano" : "Pared o Losa de Concreto";
}
function nombreElemento(el) {
  return el.categoria === "penetrante" ? el.tipoPenetrante : `Junta ${el.juntaTipo}`;
}
function descripcionElemento(el) {
  if (el.categoria === "penetrante") {
    return ubicacionLabel(el.material);
  }
  const pos = el.juntaPosicion ? `${el.juntaPosicion} — ` : "";
  return `${pos}${el.juntaBarreras}`;
}

let ACR_VISTA = "historial"; // historial | galeria | form | editorFoto
let ACR_DRAFT = null;
let ACR_EDITANDO_ID = null;
let ACR_ZONA_ACTIVA = null;
let ACR_ELEMENTO_FORM = null;
let ACR_ELEMENTO_EDITANDO_ID = null;
let ACR_FOTO_EDIT = null;
let ACR_CAPTION_QUEUE = [];
let ACR_ALTA_FOTOS_PENDIENTES = [];
let ACR_ALTA_TOTAL = 0;
let ACR_CHECKLIST_EXPANDIDO = new Set();
let ACR_OBSERVACION_ABIERTA = new Set();
let ACR_DATOS_GENERALES_ABIERTO = true;
function claveChecklist(elId, zona) { return `${elId}|${zona || ""}`; }
const ACR_PALETA = ["#e2001a", "#ff9900", "#0072ce", "#111111", "#ffffff"];

function ultimoInformeGuardado() {
  if (!INFORMES_ACREDITACION.length) return null;
  return INFORMES_ACREDITACION.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0];
}
function nuevoBorradorInforme() {
  const anterior = ultimoInformeGuardado();
  return {
    id: null,
    fecha: new Date().toISOString().slice(0, 10),
    proyecto: (window.PROJECT_INFO && window.PROJECT_INFO.nombre) || "",
    cliente: (window.PROJECT_INFO && window.PROJECT_INFO.cliente) || (anterior ? anterior.cliente : "") || "",
    empresaInstaladora: anterior ? anterior.empresaInstaladora : "",
    acompanantes: [],
    inspector: anterior ? anterior.inspector : "kevin",
    zonas: [],
    fotos: [],
    elementos: [],
    checklistModo: "general",
    checklist: { general: {}, porZona: {} },
    esSeguimiento: false,
    seguimientoTexto: "",
    observaciones: "",
    textoInformeManual: null,
  };
}
function textoFinalInforme(d) {
  return d.textoInformeManual != null ? d.textoInformeManual : generarTextoCumplimiento(d);
}
function estadoChecklistDefault(categoria, subtipo) {
  return { cumple: true, marcados: [], observacion: "" };
}
function obtenerEstadoChecklist(elementoId, zona) {
  if (ACR_DRAFT.checklistModo === "porZona" && zona) {
    if (!ACR_DRAFT.checklist.porZona[zona]) ACR_DRAFT.checklist.porZona[zona] = {};
    if (!ACR_DRAFT.checklist.porZona[zona][elementoId]) ACR_DRAFT.checklist.porZona[zona][elementoId] = estadoChecklistDefault();
    return ACR_DRAFT.checklist.porZona[zona][elementoId];
  }
  if (!ACR_DRAFT.checklist.general[elementoId]) ACR_DRAFT.checklist.general[elementoId] = estadoChecklistDefault();
  return ACR_DRAFT.checklist.general[elementoId];
}

function abrirVisorAcreditacion() {
  ACR_VISTA = "historial";
  ACR_DRAFT = null;
  let overlay = document.getElementById("acr-visor-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "acr-visor-overlay";
    overlay.className = "acr-visor-overlay";
    document.body.appendChild(overlay);
  }
  document.body.classList.add("modal-open");
  renderAcreditacion();
}
function cerrarVisorAcreditacion() {
  const overlay = document.getElementById("acr-visor-overlay");
  if (overlay) overlay.remove();
  document.body.classList.remove("modal-open");
  ACR_DRAFT = null;
  ACR_FOTO_EDIT = null;
}

function abrirNuevoInforme() {
  ACR_DRAFT = nuevoBorradorInforme();
  ACR_EDITANDO_ID = null;
  ACR_VISTA = "galeria";
  ACR_DATOS_GENERALES_ABIERTO = !(ACR_DRAFT.proyecto && ACR_DRAFT.cliente && ACR_DRAFT.empresaInstaladora);
  renderAcreditacion();
}
function abrirEditarInforme(id) {
  const informe = INFORMES_ACREDITACION.find((i) => i.id === id);
  if (!informe) return;
  ACR_DRAFT = JSON.parse(JSON.stringify(informe));
  ACR_EDITANDO_ID = id;
  ACR_VISTA = "galeria";
  ACR_DATOS_GENERALES_ABIERTO = true;
  renderAcreditacion();
}
function duplicarInforme(id) {
  const informe = INFORMES_ACREDITACION.find((i) => i.id === id);
  if (!informe) return;
  const copia = JSON.parse(JSON.stringify(informe));
  copia.id = INFORME_ACR_SEQ++;
  copia.fecha = new Date().toISOString().slice(0, 10);
  INFORMES_ACREDITACION.push(copia);
  if (window.marcarCambio) marcarCambio();
  renderAcreditacion();
  if (window.mostrarToast) mostrarToast("Informe duplicado — ajustá la fecha y los datos de esta nueva visita.");
}
function eliminarInforme(id) {
  const hacer = () => {
    INFORMES_ACREDITACION = INFORMES_ACREDITACION.filter((i) => i.id !== id);
    if (window.marcarCambio) marcarCambio();
    renderAcreditacion();
  };
  if (window.pedirConfirmacion) pedirConfirmacion("¿Eliminar este informe de acreditación? No se puede deshacer.", hacer);
  else hacer();
}
function guardarInformeDesdeFormulario() {
  if (!ACR_DRAFT.fecha) { if (window.mostrarToast) mostrarToast("Ingresá la fecha de la visita.", "error"); return; }
  if (ACR_EDITANDO_ID != null) {
    const idx = INFORMES_ACREDITACION.findIndex((i) => i.id === ACR_EDITANDO_ID);
    if (idx !== -1) INFORMES_ACREDITACION[idx] = Object.assign({}, ACR_DRAFT, { id: ACR_EDITANDO_ID });
  } else {
    INFORMES_ACREDITACION.push(Object.assign({}, ACR_DRAFT, { id: INFORME_ACR_SEQ++ }));
  }
  if (window.marcarCambio) marcarCambio();
  ACR_VISTA = "historial";
  ACR_DRAFT = null;
  renderAcreditacion();
  if (window.mostrarToast) mostrarToast("Informe de acreditación guardado.");
}
function cancelarFormularioInforme() {
  const hacer = () => { ACR_VISTA = "historial"; ACR_DRAFT = null; renderAcreditacion(); };
  if (window.pedirConfirmacion) pedirConfirmacion("¿Salir sin guardar? Se pierden los cambios de este informe.", hacer);
  else hacer();
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function renderAcreditacion() {
  const overlay = document.getElementById("acr-visor-overlay");
  if (!overlay) return;
  const contPrevio = overlay.querySelector(".acr-content");
  const scrollPrevio = contPrevio ? contPrevio.scrollTop : 0;
  const enAltaFoto = ACR_VISTA === "editorFoto" && ACR_FOTO_EDIT && ACR_FOTO_EDIT.esAlta;
  const indiceAlta = enAltaFoto ? (ACR_ALTA_TOTAL - ACR_ALTA_FOTOS_PENDIENTES.length + 1) : 0;
  const titulos = { historial: "Informes de Acreditación", galeria: "Fotos del recorrido", form: "Informe de Acreditación", editorFoto: enAltaFoto && ACR_ALTA_TOTAL > 1 ? `Editar foto (${indiceAlta} de ${ACR_ALTA_TOTAL})` : "Editar foto" };
  const volverA = { historial: null, galeria: "historial", form: "galeria", editorFoto: "galeria" };
  const accionesDerecha = {
    galeria: `<button type="button" class="acr-topbar-right-btn" data-acr-action="siguiente-a-form">Siguiente</button>`,
    editorFoto: `<button type="button" class="acr-topbar-right-btn" data-acr-action="editor-aplicar">Aplicar</button>`,
  };
  overlay.innerHTML = `
    <div class="acr-topbar">
      <button type="button" id="acr-btn-volver" class="lev-exit-btn"><svg class="icon"><use href="#i-arrow-left"/></svg>${enAltaFoto ? "Saltar edición" : (volverA[ACR_VISTA] ? "Atrás" : "Cerrar")}</button>
      <span class="acr-topbar-title">${titulos[ACR_VISTA]}</span>
      <span class="acr-topbar-right">${accionesDerecha[ACR_VISTA] || ""}</span>
    </div>
    <div class="acr-content ${ACR_VISTA === "editorFoto" ? "acr-content-editor" : ""}">
      ${ACR_VISTA === "historial" ? renderHistorialHTML() : ""}
      ${ACR_VISTA === "galeria" ? renderGaleriaHTML() : ""}
      ${ACR_VISTA === "form" ? renderFormularioHTML() : ""}
      ${ACR_VISTA === "editorFoto" ? renderEditorFotoHTML() : ""}
    </div>
  `;
  attachEventos(overlay);
  const contNuevo = overlay.querySelector(".acr-content");
  if (contNuevo) contNuevo.scrollTop = scrollPrevio;
  if (ACR_VISTA === "editorFoto") inicializarCanvasEditor();
}

function estadoInformeLabel(informe) {
  const total = informe.elementos.length;
  if (total === 0) return { texto: "Sin elementos", clase: "acr-badge-neutro" };
  const estados = informe.checklistModo === "porZona"
    ? Object.values(informe.checklist.porZona || {}).flatMap((z) => Object.values(z))
    : Object.values(informe.checklist.general || {});
  const noCumplen = estados.filter((e) => !e.cumple).length;
  if (noCumplen === 0) return { texto: "Todo cumple", clase: "acr-badge-ok" };
  return { texto: `${noCumplen} pendiente(s)`, clase: "acr-badge-warn" };
}
function renderHistorialHTML() {
  const lista = INFORMES_ACREDITACION.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const filas = lista.map((informe) => {
    const estado = estadoInformeLabel(informe);
    const firmanteLabel = informe.inspector === "sebastian" ? "Arq. Sebastián Rojas Sonderegger" : "Ing. Kevin Soto Navarro";
    return `
      <div class="acr-card">
        <div class="acr-card-main">
          <div class="acr-card-fecha">${escapeHtml(informe.fecha || "(sin fecha)")}</div>
          <div class="acr-card-sub">${escapeHtml(firmanteLabel)} · ${informe.elementos.length} elemento(s) · ${informe.fotos.length} foto(s)</div>
          <span class="acr-badge ${estado.clase}">${estado.texto}</span>
        </div>
        <div class="acr-card-actions">
          <button type="button" class="secondary icon-only-btn" data-acr-action="generar-pdf" data-id="${informe.id}" title="Generar PDF"><svg class="icon"><use href="#i-download"/></svg></button>
          <button type="button" class="secondary icon-only-btn" data-acr-action="editar" data-id="${informe.id}" title="Editar"><svg class="icon"><use href="#i-edit"/></svg></button>
          <button type="button" class="secondary icon-only-btn" data-acr-action="duplicar" data-id="${informe.id}" title="Duplicar"><svg class="icon"><use href="#i-copy"/></svg></button>
          <button type="button" class="secondary icon-only-btn" data-acr-action="eliminar" data-id="${informe.id}" title="Eliminar"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div>
      </div>`;
  }).join("");
  return `
    <div class="acr-historial">
      <button type="button" class="primary" data-acr-action="nuevo"><svg class="icon"><use href="#i-plus"/></svg>Nuevo informe de acreditación</button>
      ${lista.length ? `<div class="acr-lista">${filas}</div>` : `<p class="hint" style="margin-top:16px">Todavía no hay informes de acreditación en este proyecto.</p>`}
    </div>`;
}

function todasSeleccionadas() {
  return ACR_DRAFT.fotos.length > 0 && ACR_DRAFT.fotos.every((f) => f.seleccionada);
}
function renderGaleriaHTML() {
  const fotos = ACR_DRAFT.fotos;
  const seleccionadas = fotos.filter((f) => f.seleccionada).length;
  const items = fotos.map((f, idx) => `
    <div class="acr-foto-item ${f.seleccionada ? "acr-foto-seleccionada" : ""}">
      <div class="acr-foto-thumb-wrap" data-acr-action="toggle-foto" data-idx="${idx}">
        <img src="${f.dataUrl}" alt="Foto ${idx + 1}">
        <span class="acr-foto-check">${f.seleccionada ? '<svg class="icon"><use href="#i-check"/></svg>' : ""}</span>
        <button type="button" class="acr-foto-icon-btn acr-foto-icon-editar" data-acr-action="editar-foto" data-id="${f.id}" title="Editar" aria-label="Editar foto"><svg class="icon"><use href="#i-edit"/></svg></button>
        <button type="button" class="acr-foto-icon-btn acr-foto-icon-borrar" data-acr-action="borrar-foto" data-idx="${idx}" title="Borrar" aria-label="Borrar foto"><svg class="icon"><use href="#i-trash"/></svg></button>
      </div>
      <input type="text" class="acr-foto-desc" data-acr-field="foto-descripcion" data-idx="${idx}" value="${escapeHtml(f.descripcion)}" placeholder="Descripción de la foto (ej. Vista general del muro cortafuego)">
    </div>`).join("");
  return `
    <div class="acr-galeria">
      <label class="primary acr-btn-add-foto">
        <svg class="icon"><use href="#i-camera"/></svg>Añadir foto
        <input type="file" accept="image/*" multiple id="acr-input-fotos" hidden>
      </label>
      ${fotos.length ? `
        <div class="acr-galeria-selectbar">
          <span class="hint">${seleccionadas} de ${fotos.length} seleccionadas — solo las seleccionadas van al informe</span>
          <button type="button" class="secondary" data-acr-action="toggle-seleccion-todas">${todasSeleccionadas() ? "Deseleccionar todas" : "Seleccionar todas"}</button>
        </div>
        <div class="acr-fotos-grid">${items}</div>
      ` : `<p class="hint" style="margin-top:16px">Todavía no agregaste fotos. Tocá "Añadir foto" arriba.</p>`}
    </div>`;
}

function renderAcompanantesHTML() {
  return ACR_DRAFT.acompanantes.map((a, idx) => `
    <div class="acr-acompanante-row">
      <input type="text" data-acr-field="acompanante-nombre" data-idx="${idx}" value="${escapeHtml(a.nombre)}" placeholder="Nombre">
      <input type="text" data-acr-field="acompanante-cargo" data-idx="${idx}" value="${escapeHtml(a.cargo)}" placeholder="Cargo / empresa">
      <button type="button" class="secondary icon-only-btn" data-acr-action="quitar-acompanante" data-idx="${idx}" title="Quitar"><svg class="icon"><use href="#i-trash"/></svg></button>
    </div>`).join("");
}
function renderZonasHTML() {
  const chips = ACR_DRAFT.zonas.map((z, idx) => `
    <span class="acr-tag">${escapeHtml(z)}<button type="button" data-acr-action="quitar-zona" data-idx="${idx}" aria-label="Quitar">&times;</button></span>`).join("");
  return `
    <div class="acr-tags-wrap">${chips}</div>
    <div class="acr-tag-input-row">
      <input type="text" id="acr-input-zona" placeholder="Ej. Nivel 20, Sótano, Torre B...">
      <button type="button" class="secondary" data-acr-action="agregar-zona">Agregar</button>
    </div>`;
}
function renderSelectorElemento() {
  return `
    <div class="acr-elemento-add-buttons">
      <button type="button" class="secondary" data-acr-action="abrir-elemento-penetrante"><svg class="icon"><use href="#i-plus"/></svg>Agregar tipo de penetrante</button>
      <button type="button" class="secondary" data-acr-action="abrir-elemento-junta"><svg class="icon"><use href="#i-plus"/></svg>Agregar junta</button>
      <button type="button" class="secondary" data-acr-action="precargar-levantamiento"><svg class="icon"><use href="#i-download"/></svg>Precargar de Levantamiento</button>
    </div>`;
}
function elementoClaveDedup(e) {
  return e.categoria === "penetrante"
    ? ["p", e.material, e.tipoPenetrante, e.ubicacion, e.espacioAnular ? 1 : 0, e.diametro || "", e.producto].join("|")
    : ["j", e.juntaTipo, e.juntaBarreras, e.juntaPosicion, e.producto].join("|");
}
function precargarElementosDesdeLevantamiento() {
  const vistos = new Set(ACR_DRAFT.elementos.map(elementoClaveDedup));
  const agregados = [];
  (window.ROWS || []).forEach((r) => {
    if (!r || !r.L || !r.N || !r.M || !r.P) return;
    const espacioAnular = (window.n ? window.n(r.I) : parseFloat(r.I)) > 0;
    let diametro = "";
    if (esTuberiaCombustible(r.L)) {
      const d = window.n ? window.n(r.D) : parseFloat(r.D);
      if (!d) return;
      diametro = d > 2 ? "mayor2" : "menor2";
    }
    const opciones = opcionesProductoPenetrante(r.N, r.L, r.M, espacioAnular, diametro);
    const encontrado = opciones.find((o) => o.producto === r.P);
    if (!encontrado) return;
    const nuevo = {
      id: Date.now() + Math.random(), categoria: "penetrante", subtipo: null,
      material: r.N, tipoPenetrante: r.L, ubicacion: r.M, espacioAnular, diametro: diametro || null,
      producto: r.P, sistemaUL: encontrado.sistemaUL, espesor: encontrado.espesor, traslape: null,
    };
    const key = elementoClaveDedup(nuevo);
    if (vistos.has(key)) return;
    vistos.add(key);
    agregados.push(nuevo);
  });
  (window.ROWS_J || []).forEach((r) => {
    if (!r || !r.tipo || !r.barreras || !r.producto) return;
    const junta = window.juntaParaTipo ? window.juntaParaTipo(r.tipo) : null;
    const posiciones = r.posicionPI === "Superior e Inferior" ? ["Superior", "Inferior"] : [r.posicion || r.posicionPI].filter(Boolean);
    posiciones.forEach((posicion) => {
      const fila = resolverFilaJunta(junta, r.tipo, r.barreras, posicion, r.producto);
      if (!fila) return;
      const nuevo = {
        id: Date.now() + Math.random(), categoria: "junta", subtipo: r.tipo === "Muro Cortina" ? "muro_cortina" : "interior",
        juntaTipo: r.tipo, juntaBarreras: r.barreras, juntaPosicion: posicion, producto: r.producto,
        sistemaUL: fila.sis, espesor: fila.esp, traslape: fila.tras || null,
      };
      const key = elementoClaveDedup(nuevo);
      if (vistos.has(key)) return;
      vistos.add(key);
      agregados.push(nuevo);
    });
  });
  if (!agregados.length) {
    if (window.mostrarToast) mostrarToast("No hay tipos nuevos en Levantamiento para precargar.");
    return;
  }
  ACR_DRAFT.elementos = ACR_DRAFT.elementos.concat(agregados);
  if (window.mostrarToast) mostrarToast(`Se precargaron ${agregados.length} tipo(s) desde Levantamiento.`);
  renderAcreditacion();
}
function renderElementosLista() {
  if (!ACR_DRAFT.elementos.length) return `<p class="hint">Todavía no agregaste ningún tipo de penetrante ni junta.</p>`;
  return ACR_DRAFT.elementos.map((el) => `
    <div class="acr-elemento-card">
      <div>
        <strong>${escapeHtml(nombreElemento(el))}</strong>
        <span class="hint">${escapeHtml(descripcionElemento(el))}</span>
      </div>
      <div class="acr-elemento-card-actions">
        <button type="button" class="secondary icon-only-btn" data-acr-action="editar-elemento" data-id="${el.id}" title="Editar"><svg class="icon"><use href="#i-edit"/></svg></button>
        <button type="button" class="secondary icon-only-btn" data-acr-action="quitar-elemento" data-id="${el.id}" title="Quitar"><svg class="icon"><use href="#i-trash"/></svg></button>
      </div>
    </div>`).join("");
}
function renderChecklistParaElemento(el, zona) {
  const estado = obtenerEstadoChecklist(el.id, zona);
  const clave = claveChecklist(el.id, zona);
  const expandido = ACR_CHECKLIST_EXPANDIDO.has(clave);
  const chips = estado.cumple ? "" : checklistNoCumpleFor(el).map((item) => `
    <button type="button" class="acr-chip ${estado.marcados.includes(item) ? "active" : ""}" data-acr-action="toggle-check" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}" data-item="${escapeHtml(item)}">${escapeHtml(labelCortoChecklist(item))}</button>`).join("");
  const obsAbierta = ACR_OBSERVACION_ABIERTA.has(clave) || !!estado.observacion;
  return `
    <div class="acr-checklist-elemento">
      <button type="button" class="acr-checklist-elemento-header" data-acr-action="toggle-expandir-checklist" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}">
        <span class="acr-checklist-elemento-titulo">${escapeHtml(nombreElemento(el))} <span class="hint">${escapeHtml(descripcionElemento(el))}</span></span>
        <span class="acr-checklist-estado-badge ${estado.cumple ? "ok" : "warn"}">${estado.cumple ? "Cumple" : "No cumple"}</span>
        <svg class="icon acr-chevron ${expandido ? "acr-chevron-abierto" : ""}"><use href="#i-chevron-down"/></svg>
      </button>
      ${expandido ? `
        <div class="acr-toggle-cumple">
          <button type="button" class="${estado.cumple ? "active" : ""}" data-acr-action="toggle-cumple" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}">Cumple</button>
          <button type="button" class="${!estado.cumple ? "active" : ""}" data-acr-action="toggle-cumple" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}">No cumple</button>
        </div>
        ${estado.cumple
          ? `<p class="hint">Cumple con todos los requerimientos del sistema UL (espesores, vueltas de cinta si aplica, ambas caras, sin daños ni orificios, producto correcto).</p>`
          : `<div class="acr-chips">${chips}</div>`}
        ${obsAbierta
          ? `<textarea data-acr-field="checklist-observacion" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}" rows="2" placeholder="Observación puntual (opcional)">${escapeHtml(estado.observacion)}</textarea>`
          : `<button type="button" class="acr-link-btn" data-acr-action="abrir-observacion" data-elid="${el.id}" data-zona="${escapeHtml(zona || "")}">+ Agregar observación</button>`}
      ` : ""}
    </div>`;
}
function renderChecklistSeccion() {
  if (!ACR_DRAFT.elementos.length) return `<p class="hint">Agregá al menos un tipo de penetrante o junta arriba para poder marcar el checklist.</p>`;
  const modoGeneral = ACR_DRAFT.checklistModo === "general";
  let contenido;
  if (modoGeneral) {
    contenido = ACR_DRAFT.elementos.map((el) => renderChecklistParaElemento(el, null)).join("");
  } else {
    if (!ACR_DRAFT.zonas.length) {
      contenido = `<p class="hint">Agregá al menos una zona en el Alcance para poder marcar el checklist por zona.</p>`;
    } else {
      if (!ACR_ZONA_ACTIVA || !ACR_DRAFT.zonas.includes(ACR_ZONA_ACTIVA)) ACR_ZONA_ACTIVA = ACR_DRAFT.zonas[0];
      const tabs = ACR_DRAFT.zonas.map((z) => `<button type="button" class="acr-zona-tab ${z === ACR_ZONA_ACTIVA ? "active" : ""}" data-acr-action="cambiar-zona-activa" data-zona="${escapeHtml(z)}">${escapeHtml(z)}</button>`).join("");
      contenido = `<div class="acr-zona-tabs">${tabs}</div>` + ACR_DRAFT.elementos.map((el) => renderChecklistParaElemento(el, ACR_ZONA_ACTIVA)).join("");
    }
  }
  return `
    <div class="acr-toggle-cumple" style="max-width:340px">
      <button type="button" class="${modoGeneral ? "active" : ""}" data-acr-action="checklist-modo" data-modo="general">General (todo el proyecto)</button>
      <button type="button" class="${!modoGeneral ? "active" : ""}" data-acr-action="checklist-modo" data-modo="porZona">Por zona</button>
    </div>
    ${contenido}`;
}
function nombreInspector(codigo) {
  return codigo === "sebastian" ? "Arq. Sebastián Rojas Sonderegger" : "Ing. Kevin Soto Navarro";
}
function nombreInspectorFirma(codigo) {
  return codigo === "sebastian" ? "Arq. Sebastián Rojas Sonderegger" : "Ing. Kevin Soto Navarro (IC-31624)";
}
function renderDatosGeneralesHTML() {
  const d = ACR_DRAFT;
  const abierto = ACR_DATOS_GENERALES_ABIERTO;
  const resumenPartes = [d.proyecto, d.cliente, d.empresaInstaladora, nombreInspector(d.inspector)].filter(Boolean);
  return `
    <div class="acr-subseccion">
      <button type="button" class="acr-subseccion-toggle" data-acr-action="toggle-datos-generales" aria-expanded="${abierto}">
        <span class="acr-subseccion-titulo" style="margin:0">Datos generales</span>
        ${!abierto && resumenPartes.length ? `<span class="hint acr-datos-generales-resumen">${escapeHtml(resumenPartes.join(" · "))}</span>` : ""}
        <svg class="icon acr-chevron ${abierto ? "acr-chevron-abierto" : ""}"><use href="#i-chevron-down"/></svg>
      </button>
      ${abierto ? `
        <div class="acr-field-row">
          <label class="acr-field-label">Proyecto
            <input type="text" data-acr-field="proyecto" value="${escapeHtml(d.proyecto)}">
          </label>
          <label class="acr-field-label">Cliente
            <input type="text" data-acr-field="cliente" value="${escapeHtml(d.cliente)}">
          </label>
        </div>
        <div class="acr-field-row">
          <label class="acr-field-label">Fecha de la visita
            <input type="date" data-acr-field="fecha" value="${escapeHtml(d.fecha)}">
          </label>
          <label class="acr-field-label">Empresa instaladora
            <input type="text" data-acr-field="empresaInstaladora" value="${escapeHtml(d.empresaInstaladora)}">
          </label>
        </div>
        <label class="acr-field-label">Inspector
          <select data-acr-field="inspector">
            <option value="kevin" ${d.inspector === "kevin" ? "selected" : ""}>Ing. Kevin Soto Navarro</option>
            <option value="sebastian" ${d.inspector === "sebastian" ? "selected" : ""}>Arq. Sebastián Rojas Sonderegger</option>
          </select>
        </label>
        <div class="acr-subseccion-titulo" style="font-size:var(--fs-sm);margin-top:6px">Acompañantes de la visita</div>
        ${renderAcompanantesHTML()}
        <div class="acr-acompanante-botones">
          <button type="button" class="secondary" data-acr-action="agregar-acompanante"><svg class="icon"><use href="#i-plus"/></svg>Agregar acompañante</button>
          ${!d.acompanantes.length && ultimoInformeGuardado() && ultimoInformeGuardado().acompanantes.length ? `
            <button type="button" class="secondary" data-acr-action="repetir-acompanantes"><svg class="icon"><use href="#i-copy"/></svg>Repetir del informe anterior</button>
          ` : ""}
        </div>
      ` : ""}
    </div>`;
}
function renderFormularioHTML() {
  const d = ACR_DRAFT;
  return `
    <div class="acr-formulario">
      ${renderDatosGeneralesHTML()}

      <div class="acr-subseccion">
        <div class="acr-subseccion-titulo">Alcance — niveles / zonas visitados</div>
        ${renderZonasHTML()}
      </div>

      <div class="acr-subseccion">
        <div class="acr-subseccion-titulo">Tipos de penetrante / juntas presentes</div>
        ${renderElementosLista()}
        ${renderSelectorElemento()}
      </div>

      <div class="acr-subseccion">
        <div class="acr-subseccion-titulo">Checklist de cumplimiento</div>
        ${renderChecklistSeccion()}
      </div>

      <div class="acr-subseccion">
        <label class="acr-checkbox-label">
          <input type="checkbox" data-acr-field="esSeguimiento" ${d.esSeguimiento ? "checked" : ""}>
          Esta visita da seguimiento a un incumplimiento detectado antes
        </label>
        ${d.esSeguimiento ? `
          <label class="acr-field-label">¿Qué se detectó en la visita anterior y qué se corrigió?
            <textarea data-acr-field="seguimientoTexto" rows="2">${escapeHtml(d.seguimientoTexto)}</textarea>
          </label>` : ""}
      </div>

      <div class="acr-subseccion">
        <label class="acr-field-label">Observaciones adicionales / notas (van antes del texto de cumplimiento en el informe final)
          <textarea data-acr-field="observaciones" rows="3">${escapeHtml(d.observaciones)}</textarea>
        </label>
      </div>

      <div class="acr-subseccion">
        <button type="button" class="secondary" data-acr-action="abrir-texto-informe">${d.textoInformeManual != null ? "Ver / editar" : "Ver"} texto del informe</button>
        ${d.textoInformeManual != null ? `<p class="hint">Este texto fue editado a mano — el PDF va a usar esta versión, no la generada automáticamente.</p>` : ""}
      </div>

      <div class="acr-form-footer">
        <button type="button" class="secondary" data-acr-action="cancelar">Cancelar</button>
        <button type="button" class="primary" data-acr-action="guardar"><svg class="icon"><use href="#i-save"/></svg>Guardar informe</button>
      </div>
    </div>`;
}

function acrChip(campo, valor, label, activo) {
  return `<button type="button" class="lev-chip ${activo ? "lev-chip-active" : ""}" data-acr-elform-chip="${campo}" data-valor="${escapeHtml(String(valor))}">${escapeHtml(label)}</button>`;
}
function acrChipIcon(campo, valor, label, activo, iconIds) {
  if (!iconIds) return acrChip(campo, valor, label, activo);
  const ids = Array.isArray(iconIds) ? iconIds : [iconIds];
  const iconsHtml = ids.map((id) => `<svg class="icon-junta"><use href="#${id}"/></svg>`).join("");
  return `<button type="button" class="lev-chip lev-chip-icon ${activo ? "lev-chip-active" : ""}" data-acr-elform-chip="${campo}" data-valor="${escapeHtml(String(valor))}">
    <span class="icon-junta-row">${iconsHtml}</span>
    <span>${escapeHtml(label)}</span>
  </button>`;
}
function acrChipCombo(campos, valores, label, activo) {
  return `<button type="button" class="lev-chip ${activo ? "lev-chip-active" : ""}" data-acr-elform-combo="${campos.join(",")}" data-valores="${escapeHtml(valores.join("|"))}">${escapeHtml(label)}</button>`;
}
const COMBOS_UBICACION_MATERIAL = [
  { label: "Pared de Concreto", ubicacion: "Pared", material: "Concreto" },
  { label: "Pared de Panel de Yeso", ubicacion: "Pared", material: "Panel de Yeso" },
  { label: "Losa de Concreto", ubicacion: "Entrepiso", material: "Concreto" },
];
function abrirModalElemento(categoria, editandoId) {
  if (editandoId != null) {
    const el = ACR_DRAFT.elementos.find((x) => x.id === editandoId);
    if (!el) return;
    ACR_ELEMENTO_EDITANDO_ID = editandoId;
    ACR_ELEMENTO_FORM = el.categoria === "penetrante"
      ? { categoria: "penetrante", material: el.material, tipo: el.tipoPenetrante, ubicacion: el.ubicacion, espacioAnular: el.espacioAnular, diametro: el.diametro || "", producto: el.producto }
      : { categoria: "junta", tipo: el.juntaTipo, barreras: el.juntaBarreras, posicion: el.juntaPosicion, producto: el.producto };
  } else {
    ACR_ELEMENTO_EDITANDO_ID = null;
    ACR_ELEMENTO_FORM = categoria === "penetrante"
      ? { categoria, material: "", tipo: "", ubicacion: "", espacioAnular: false, diametro: "", producto: "" }
      : { categoria, tipo: "", barreras: "", posicion: "", producto: "" };
  }
  let overlay = document.getElementById("acr-elemento-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "acr-elemento-overlay";
    overlay.className = "instr-modal-overlay open";
    document.body.appendChild(overlay);
  }
  renderModalElemento();
}
function cerrarModalElemento() {
  const overlay = document.getElementById("acr-elemento-overlay");
  if (overlay) overlay.remove();
  ACR_ELEMENTO_FORM = null;
  ACR_ELEMENTO_EDITANDO_ID = null;
}
function renderModalElemento() {
  const overlay = document.getElementById("acr-elemento-overlay");
  if (!overlay) return;
  const contentPrevio = overlay.querySelector(".instr-modal-content");
  const scrollPrevio = contentPrevio ? contentPrevio.scrollTop : 0;
  const f = ACR_ELEMENTO_FORM;
  let contenidoHtml;
  if (f.categoria === "penetrante") {
    const esCombustible = esTuberiaCombustible(f.tipo);
    const faltaDiametro = esCombustible && !f.diametro;
    const opciones = (f.material && f.tipo && f.ubicacion && !faltaDiametro) ? opcionesProductoPenetrante(f.material, f.tipo, f.ubicacion, f.espacioAnular, f.diametro) : [];
    contenidoHtml = `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Tipo de penetrante</div>
        <div class="lev-chip-grid">${(window.OPTS_L || []).map((t) => acrChip("tipo", t, (window.TIPO_LABEL_CORTO && window.TIPO_LABEL_CORTO[t]) || t, f.tipo === t)).join("")}</div>
      </div>
      ${f.tipo ? `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Ubicación</div>
        <div class="lev-chip-grid lev-chip-grid-compact">
          ${COMBOS_UBICACION_MATERIAL.map((c) => acrChipCombo(["ubicacion", "material"], [c.ubicacion, c.material], c.label, f.ubicacion === c.ubicacion && f.material === c.material)).join("")}
        </div>
      </div>
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Espacio anular</div>
        <div class="lev-chip-grid lev-chip-grid-compact">
          ${acrChip("espacioAnular", "0", "Sin espacio anular", !f.espacioAnular)}
          ${acrChip("espacioAnular", "1", "Con espacio anular", !!f.espacioAnular)}
        </div>
      </div>
      ${esCombustible ? `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Diámetro de la tubería</div>
        <div class="lev-chip-grid lev-chip-grid-compact">
          ${acrChip("diametro", "menor2", '≤ 2"', f.diametro === "menor2")}
          ${acrChip("diametro", "mayor2", '> 2"', f.diametro === "mayor2")}
        </div>
        <p class="hint" style="margin:2px 0 0">El diámetro define si el sistema correcto usa Pasta/Sellador (≤2") o Cinta/Collarín (&gt;2").</p>
      </div>` : ""}` : ""}
      ${f.material && f.tipo && f.ubicacion && !faltaDiametro ? (opciones.length ? `
        <div class="acr-modal-seccion">
          <div class="acr-modal-seccion-titulo">Producto instalado</div>
          ${opciones.map((o) => `<button type="button" class="acr-producto-opcion ${f.producto === o.producto ? "active" : ""}" data-acr-elform-chip="producto" data-valor="${escapeHtml(o.producto)}"><strong>${escapeHtml(o.producto)}</strong><span class="hint">Sistema ${escapeHtml(o.sistemaUL)} — mín. ${fraccion(o.espesor)}</span></button>`).join("")}
        </div>` : `<p class="hint">No hay un sistema UL registrado para esa combinación — probá otra ubicación o espacio anular.</p>`) : ""}`;
  } else {
    const tipos = (window.todosLosTipos ? window.todosLosTipos() : []).map((x) => x.tipo);
    const junta = f.tipo && window.juntaParaTipo ? window.juntaParaTipo(f.tipo) : null;
    const barreras = f.tipo && junta && window.barrerasParaTipo ? window.barrerasParaTipo(junta, f.tipo) : [];
    const posiciones = f.tipo && f.barreras && window.posicionesParaCombo ? window.posicionesParaCombo(junta, f.tipo, f.barreras) : [];
    const productos = f.tipo && f.barreras && f.posicion && window.productosParaCombo ? window.productosParaCombo(junta, f.tipo, f.barreras, f.posicion) : [];
    const iconoTipo = window.iconoJuntaTipo ? window.iconoJuntaTipo(junta, f.tipo) : null;
    contenidoHtml = `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Tipo de junta</div>
        <div class="lev-chip-grid">${tipos.map((t) => {
          const j = window.juntaParaTipo ? window.juntaParaTipo(t) : null;
          const icono = window.iconoJuntaTipo ? window.iconoJuntaTipo(j, t) : null;
          return acrChipIcon("tipo", t, t, f.tipo === t, icono);
        }).join("")}</div>
      </div>
      ${f.tipo ? `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Materialidad de bordes</div>
        <div class="lev-chip-grid">${barreras.map((b) => acrChip("barreras", b, b, f.barreras === b)).join("")}</div>
      </div>` : ""}
      ${f.barreras ? `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Posición</div>
        <div class="lev-chip-grid lev-chip-grid-compact">${posiciones.map((p) => {
          const icono = window.iconoJuntaPosicion ? window.iconoJuntaPosicion(f.tipo, p) : null;
          return acrChipIcon("posicion", p, p, f.posicion === p, icono);
        }).join("")}</div>
      </div>` : ""}
      ${f.posicion ? `
      <div class="acr-modal-seccion">
        <div class="acr-modal-seccion-titulo">Producto instalado</div>
        <div class="lev-chip-grid lev-chip-grid-compact">${productos.map((p) => acrChip("producto", p, p, f.producto === p)).join("")}</div>
      </div>` : ""}`;
  }
  const puedeConfirmar = f.categoria === "penetrante" ? !!f.producto : !!(f.tipo && f.barreras && f.posicion && f.producto);
  overlay.innerHTML = `
    <div class="instr-modal acr-elemento-modal">
      <div class="instr-modal-header">
        <span>${ACR_ELEMENTO_EDITANDO_ID != null ? "Editar" : "Agregar"} ${f.categoria === "penetrante" ? "tipo de penetrante" : "junta"}</span>
        <button type="button" data-acr-elmodal-cerrar aria-label="Cerrar"><svg class="icon"><use href="#i-close"/></svg></button>
      </div>
      <div class="instr-modal-content">
        ${contenidoHtml}
        <div class="acr-form-footer" style="padding-top:8px">
          <button type="button" class="secondary" data-acr-elmodal-cerrar>Cancelar</button>
          <button type="button" class="primary ${puedeConfirmar ? "" : "acr-btn-incompleto"}" data-acr-elmodal-confirmar>${ACR_ELEMENTO_EDITANDO_ID != null ? "Guardar cambios" : "Añadir"}</button>
        </div>
      </div>
    </div>`;
  bindModalElementoEventos(overlay);
  const contentNuevo = overlay.querySelector(".instr-modal-content");
  if (contentNuevo) contentNuevo.scrollTop = scrollPrevio;
}
function bindModalElementoEventos(overlay) {
  if (overlay.dataset.acrElBind) return;
  overlay.dataset.acrElBind = "1";
  overlay.addEventListener("click", (evt) => {
    const combo = evt.target.closest("[data-acr-elform-combo]");
    if (combo) {
      const campos = combo.getAttribute("data-acr-elform-combo").split(",");
      const valores = combo.getAttribute("data-valores").split("|");
      campos.forEach((campo, i) => { ACR_ELEMENTO_FORM[campo] = valores[i]; });
      ACR_ELEMENTO_FORM.producto = "";
      renderModalElemento();
      return;
    }
    const chip = evt.target.closest("[data-acr-elform-chip]");
    if (chip) {
      const campo = chip.getAttribute("data-acr-elform-chip");
      let valor = chip.getAttribute("data-valor");
      if (campo === "espacioAnular") valor = valor === "1";
      ACR_ELEMENTO_FORM[campo] = valor;
      if (campo === "material" || campo === "ubicacion" || campo === "espacioAnular" || campo === "diametro") ACR_ELEMENTO_FORM.producto = "";
      if (campo === "tipo") { ACR_ELEMENTO_FORM.barreras = ""; ACR_ELEMENTO_FORM.posicion = ""; ACR_ELEMENTO_FORM.producto = ""; ACR_ELEMENTO_FORM.diametro = ""; }
      if (campo === "barreras") { ACR_ELEMENTO_FORM.posicion = ""; ACR_ELEMENTO_FORM.producto = ""; }
      if (campo === "posicion") { ACR_ELEMENTO_FORM.producto = ""; }
      renderModalElemento();
      return;
    }
    if (evt.target.closest("[data-acr-elmodal-cerrar]")) { cerrarModalElemento(); return; }
    if (evt.target.closest("[data-acr-elmodal-confirmar]")) { confirmarNuevoElemento(); return; }
  });
}

let ACR_TEXTO_INFORME_EDITANDO = false;
function abrirModalTextoInforme() {
  ACR_TEXTO_INFORME_EDITANDO = false;
  let overlay = document.getElementById("acr-texto-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "acr-texto-overlay";
    overlay.className = "instr-modal-overlay open";
    document.body.appendChild(overlay);
  }
  renderModalTextoInforme();
}
function cerrarModalTextoInforme() {
  const overlay = document.getElementById("acr-texto-overlay");
  if (overlay) overlay.remove();
}
function renderModalTextoInforme() {
  const overlay = document.getElementById("acr-texto-overlay");
  if (!overlay) return;
  const d = ACR_DRAFT;
  const texto = textoFinalInforme(d);
  overlay.innerHTML = `
    <div class="instr-modal acr-elemento-modal">
      <div class="instr-modal-header">
        <span>Texto del informe</span>
        <button type="button" data-acr-texto-cerrar aria-label="Cerrar"><svg class="icon"><use href="#i-close"/></svg></button>
      </div>
      <div class="instr-modal-content">
        <p class="hint">Este es el texto completo que va a incluir el PDF, en el mismo orden.</p>
        ${ACR_TEXTO_INFORME_EDITANDO
          ? `<textarea id="acr-texto-informe-textarea" rows="16" style="width:100%;font-family:inherit;font-size:15px;">${escapeHtml(texto)}</textarea>`
          : `<div class="acr-texto-preview">${escapeHtml(texto).replace(/\n/g, "<br>")}</div>`}
        <div class="acr-form-footer" style="padding-top:12px">
          ${ACR_TEXTO_INFORME_EDITANDO ? `
            <button type="button" class="secondary" data-acr-texto-cancelar-edicion>Cancelar</button>
            <button type="button" class="primary" data-acr-texto-guardar>Guardar</button>
          ` : `
            ${d.textoInformeManual != null ? `<button type="button" class="secondary" data-acr-texto-restaurar>Restaurar automático</button>` : ""}
            <button type="button" class="primary" data-acr-texto-editar><svg class="icon"><use href="#i-edit"/></svg>Editar</button>
          `}
        </div>
      </div>
    </div>`;
  bindModalTextoInformeEventos(overlay);
}
function bindModalTextoInformeEventos(overlay) {
  if (overlay.dataset.acrTxtBind) return;
  overlay.dataset.acrTxtBind = "1";
  overlay.addEventListener("click", (evt) => {
    if (evt.target.closest("[data-acr-texto-cerrar]")) { cerrarModalTextoInforme(); return; }
    if (evt.target.closest("[data-acr-texto-editar]")) { ACR_TEXTO_INFORME_EDITANDO = true; renderModalTextoInforme(); return; }
    if (evt.target.closest("[data-acr-texto-cancelar-edicion]")) { ACR_TEXTO_INFORME_EDITANDO = false; renderModalTextoInforme(); return; }
    if (evt.target.closest("[data-acr-texto-guardar]")) {
      const ta = document.getElementById("acr-texto-informe-textarea");
      ACR_DRAFT.textoInformeManual = ta ? ta.value : "";
      ACR_TEXTO_INFORME_EDITANDO = false;
      renderModalTextoInforme();
      renderAcreditacion();
      return;
    }
    if (evt.target.closest("[data-acr-texto-restaurar]")) {
      ACR_DRAFT.textoInformeManual = null;
      renderModalTextoInforme();
      renderAcreditacion();
      return;
    }
  });
}

function generarTextoCumplimiento(d) {
  const partes = [];
  if (d.esSeguimiento && d.seguimientoTexto) {
    partes.push(`Esta visita da seguimiento a lo detectado en una visita anterior: ${d.seguimientoTexto}. Se verifica la corrección de lo señalado.`);
  }
  function frasesParaElemento(el, estado, prefijoZona) {
    const desc = descripcionElemento(el);
    if (estado.cumple) {
      return `${prefijoZona}El sistema ${el.sistemaUL} (${desc}) cumple con los requerimientos del sistema UL, sin compromisos de integridad visibles.`;
    }
    const motivos = estado.marcados.map((m) => m).join("; ");
    const recomendaciones = estado.marcados.map((m) => ACR_RECOMENDACION[m]).filter(Boolean);
    const recTexto = recomendaciones.length ? ` Se recomienda ${Array.from(new Set(recomendaciones)).join("; ")}.` : "";
    const obsTexto = estado.observacion ? ` ${estado.observacion}` : "";
    return `${prefijoZona}El sistema ${el.sistemaUL} (${desc}) no cumple: ${motivos || "ver observación"}.${recTexto}${obsTexto}`;
  }
  if (!d.elementos.length) {
    partes.push("Aún no se agregaron tipos de penetrante ni juntas a este informe.");
  } else if (d.checklistModo === "general") {
    d.elementos.forEach((el) => {
      const estado = d.checklist.general[el.id] || estadoChecklistDefault();
      partes.push(frasesParaElemento(el, estado, ""));
    });
  } else {
    (d.zonas.length ? d.zonas : [null]).forEach((zona) => {
      d.elementos.forEach((el) => {
        const estado = (zona && d.checklist.porZona[zona] && d.checklist.porZona[zona][el.id]) || estadoChecklistDefault();
        partes.push(frasesParaElemento(el, estado, zona ? `En ${zona}: ` : ""));
      });
    });
  }
  return partes.join("\n\n");
}

function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function redimensionarImagenDataUrl(dataUrl, maxDim) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w <= maxDim && h <= maxDim) { resolve(dataUrl); return; }
      const escala = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * escala); h = Math.round(h * escala);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
async function agregarFotosDesdeArchivos(fileList) {
  const archivos = Array.from(fileList || []);
  const nuevosIds = [];
  for (const file of archivos) {
    try {
      const dataUrl = await leerArchivoComoDataUrl(file);
      const chica = await redimensionarImagenDataUrl(dataUrl, 1600);
      const id = Date.now() + Math.random();
      ACR_DRAFT.fotos.push({ id, dataUrl: chica, descripcion: "", seleccionada: true });
      nuevosIds.push(id);
    } catch (e) { /* si una foto falla, se sigue con las demás */ }
  }
  if (nuevosIds.length) { ACR_ALTA_FOTOS_PENDIENTES = nuevosIds; ACR_ALTA_TOTAL = nuevosIds.length; continuarAltaFotos(); }
  else renderAcreditacion();
}
function continuarAltaFotos() {
  if (!ACR_ALTA_FOTOS_PENDIENTES.length) { renderAcreditacion(); return; }
  abrirEditorFoto(ACR_ALTA_FOTOS_PENDIENTES[0], true);
}
function abrirPromptCaption() {
  if (!ACR_CAPTION_QUEUE.length) { cerrarPromptCaption(); return; }
  let overlay = document.getElementById("acr-caption-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "acr-caption-overlay";
    overlay.className = "instr-modal-overlay open";
    document.body.appendChild(overlay);
  }
  const fotoId = ACR_CAPTION_QUEUE[0];
  const foto = ACR_DRAFT.fotos.find((f) => f.id === fotoId);
  if (!foto) { ACR_CAPTION_QUEUE.shift(); abrirPromptCaption(); return; }
  overlay.innerHTML = `
    <div class="instr-modal acr-caption-modal">
      <div class="instr-modal-header">
        <span>Descripción de la foto${ACR_ALTA_TOTAL > 1 ? ` (${ACR_ALTA_TOTAL - ACR_ALTA_FOTOS_PENDIENTES.length} de ${ACR_ALTA_TOTAL})` : ""}</span>
        <button type="button" id="acr-caption-cerrar" aria-label="Cerrar"><svg class="icon"><use href="#i-close"/></svg></button>
      </div>
      <div class="instr-modal-content">
        <img src="${foto.dataUrl}" class="acr-caption-preview" alt="Foto">
        <input type="text" id="acr-caption-input" placeholder="Ej. Vista general del muro cortafuego (opcional)" value="${escapeHtml(foto.descripcion)}">
        <p class="hint" style="margin:2px 0 0">Solo el texto — el PDF le pone "Figura N." adelante automáticamente, según el orden de las fotos.</p>
        <div class="acr-form-footer" style="padding-top:12px">
          <button type="button" class="secondary" id="acr-caption-omitir">Omitir</button>
          <button type="button" class="primary" id="acr-caption-guardar">Guardar y continuar</button>
        </div>
      </div>
    </div>`;
  const input = document.getElementById("acr-caption-input");
  input.focus();
  const avanzar = (guardarTexto) => {
    if (guardarTexto) foto.descripcion = input.value.trim();
    ACR_CAPTION_QUEUE.shift();
    if (ACR_CAPTION_QUEUE.length) { abrirPromptCaption(); return; }
    cerrarPromptCaption();
    if (ACR_ALTA_FOTOS_PENDIENTES.length) continuarAltaFotos();
    else renderAcreditacion();
  };
  document.getElementById("acr-caption-omitir").addEventListener("click", () => avanzar(false));
  document.getElementById("acr-caption-guardar").addEventListener("click", () => avanzar(true));
  document.getElementById("acr-caption-cerrar").addEventListener("click", () => { ACR_CAPTION_QUEUE = []; ACR_ALTA_FOTOS_PENDIENTES = []; ACR_ALTA_TOTAL = 0; cerrarPromptCaption(); renderAcreditacion(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); avanzar(true); } });
}
function cerrarPromptCaption() {
  const overlay = document.getElementById("acr-caption-overlay");
  if (overlay) overlay.remove();
}
function toggleSeleccionFoto(idx) {
  const f = ACR_DRAFT.fotos[idx];
  if (f) f.seleccionada = !f.seleccionada;
  renderAcreditacion();
}
function toggleSeleccionTodas() {
  const marcar = !todasSeleccionadas();
  ACR_DRAFT.fotos.forEach((f) => { f.seleccionada = marcar; });
  renderAcreditacion();
}
function borrarFoto(idx) {
  ACR_DRAFT.fotos.splice(idx, 1);
  renderAcreditacion();
}

function abrirEditorFoto(fotoId, esAlta = false) {
  const foto = ACR_DRAFT.fotos.find((f) => f.id === fotoId);
  if (!foto) return;
  ACR_FOTO_EDIT = {
    fotoId,
    esAlta,
    modo: "anotar",
    img: null,
    rect: { left: 0, top: 0, right: 1, bottom: 1 },
    trazos: [], trazoActual: null,
    textos: [], textoPendiente: null,
    color: ACR_PALETA[0],
    grosorFrac: 0.006,
    arrastre: null,
  };
  ACR_VISTA = "editorFoto";
  renderAcreditacion();
}
function renderEditorFotoHTML() {
  const e = ACR_FOTO_EDIT;
  return `
    <div class="acr-editor">
      <div class="acr-editor-modos">
        <button type="button" class="secondary ${e.modo === "anotar" ? "active" : ""}" data-acr-action="editor-modo" data-modo="anotar"><svg class="icon"><use href="#i-edit"/></svg>Anotar</button>
        <button type="button" class="secondary ${e.modo === "texto" ? "active" : ""}" data-acr-action="editor-modo" data-modo="texto"><svg class="icon"><use href="#i-list"/></svg>Texto</button>
        <button type="button" class="secondary ${e.modo === "recortar" ? "active" : ""}" data-acr-action="editor-modo" data-modo="recortar"><svg class="icon"><use href="#i-crop"/></svg>Recortar</button>
      </div>
      <div class="acr-editor-canvas-wrap" id="acr-editor-canvas-wrap">
        <canvas id="acr-editor-canvas"></canvas>
      </div>
      ${e.modo === "texto" && e.textoPendiente ? `
        <div class="acr-editor-texto-input-row">
          <input type="text" id="acr-editor-texto-input" placeholder="Escribí el texto..." autofocus>
          <button type="button" class="secondary" data-acr-action="editor-texto-cancelar">Cancelar</button>
          <button type="button" class="primary" data-acr-action="editor-texto-colocar">Colocar</button>
        </div>` : ""}
      <div class="acr-editor-controles">
        ${e.modo === "anotar" ? `
          <div class="acr-editor-colores">
            ${ACR_PALETA.map((c) => `<button type="button" class="acr-color-swatch ${e.color === c ? "active" : ""}" data-acr-action="editor-color" data-color="${c}" style="background:${c}"></button>`).join("")}
          </div>
          <button type="button" class="secondary" data-acr-action="editor-deshacer">Deshacer trazo</button>
        ` : e.modo === "texto" ? `
          <div class="acr-editor-colores">
            ${ACR_PALETA.map((c) => `<button type="button" class="acr-color-swatch ${e.color === c ? "active" : ""}" data-acr-action="editor-color" data-color="${c}" style="background:${c}"></button>`).join("")}
          </div>
          <p class="hint" style="margin:0">Tocá la foto donde querés poner el texto</p>
          <button type="button" class="secondary" data-acr-action="editor-deshacer-texto">Deshacer texto</button>
        ` : `
          <button type="button" class="secondary" data-acr-action="editor-reset-recorte">Reiniciar selección</button>
        `}
      </div>
    </div>`;
}
function inicializarCanvasEditor() {
  const e = ACR_FOTO_EDIT;
  const foto = ACR_DRAFT.fotos.find((f) => f.id === e.fotoId);
  if (!foto) return;
  const canvas = document.getElementById("acr-editor-canvas");
  const wrap = document.getElementById("acr-editor-canvas-wrap");
  if (!canvas || !wrap) return;
  if (e.img) {
    const availW = Math.max(200, wrap.clientWidth || window.innerWidth - 20);
    const availH = Math.max(200, wrap.clientHeight || window.innerHeight - 170);
    const escala = Math.min(availW / e.img.naturalWidth, availH / e.img.naturalHeight, 1);
    canvas.width = Math.round(e.img.naturalWidth * escala);
    canvas.height = Math.round(e.img.naturalHeight * escala);
    dibujarEditor();
    ligarPunterosEditor(canvas);
    return;
  }
  const img = new Image();
  img.onload = () => {
    if (ACR_FOTO_EDIT !== e) return;
    e.img = img;
    const availW = Math.max(200, wrap.clientWidth || window.innerWidth - 20);
    const availH = Math.max(200, wrap.clientHeight || window.innerHeight - 170);
    const escala = Math.min(availW / img.naturalWidth, availH / img.naturalHeight, 1);
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    dibujarEditor();
    ligarPunterosEditor(canvas);
  };
  img.src = foto.dataUrl;
}
function dibujarTextoEnCanvas(ctx, t, W, H) {
  const tamano = Math.max(14, Math.round(W * 0.035));
  ctx.font = `700 ${tamano}px Arial, sans-serif`;
  ctx.textBaseline = "middle";
  const x = t.x * W, y = t.y * H;
  const metrics = ctx.measureText(t.texto);
  const padX = tamano * 0.4, padY = tamano * 0.3;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - padX, y - tamano / 2 - padY, metrics.width + padX * 2, tamano + padY * 2);
  ctx.fillStyle = t.color;
  ctx.fillText(t.texto, x, y);
}
function dibujarEditor() {
  const e = ACR_FOTO_EDIT;
  const canvas = document.getElementById("acr-editor-canvas");
  if (!canvas || !e.img) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(e.img, 0, 0, W, H);
  const trazos = e.trazoActual ? e.trazos.concat([e.trazoActual]) : e.trazos;
  trazos.forEach((t) => {
    if (!t.puntos.length) return;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = Math.max(2, t.grosorFrac * W);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath();
    t.puntos.forEach((p, i) => {
      const x = p.x * W, y = p.y * H;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
  e.textos.forEach((t) => dibujarTextoEnCanvas(ctx, t, W, H));
  if (e.modo === "texto" && e.textoPendiente) {
    ctx.beginPath();
    ctx.arc(e.textoPendiente.x * W, e.textoPendiente.y * H, 6, 0, Math.PI * 2);
    ctx.fillStyle = e.color;
    ctx.fill();
  }
  if (e.modo === "recortar") {
    const r = e.rect;
    const rx = r.left * W, ry = r.top * H, rw = (r.right - r.left) * W, rh = (r.bottom - r.top) * H;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.clearRect(rx, ry, rw, rh);
    ctx.drawImage(e.img, r.left * e.img.naturalWidth, r.top * e.img.naturalHeight, (r.right - r.left) * e.img.naturalWidth, (r.bottom - r.top) * e.img.naturalHeight, rx, ry, rw, rh);
    ctx.restore();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rw, rh);
    const hs = 9;
    ctx.fillStyle = "#ffffff";
    [[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]].forEach(([hx, hy]) => {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    });
  }
}
function ligarPunterosEditor(canvas) {
  function coordsFrac(evt) {
    const rect = canvas.getBoundingClientRect();
    const xf = (evt.clientX - rect.left) / rect.width;
    const yf = (evt.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, xf)), y: Math.max(0, Math.min(1, yf)) };
  }
  function handleCercano(p) {
    const e = ACR_FOTO_EDIT, r = e.rect, tol = 0.035;
    const esquinas = { tl: { x: r.left, y: r.top }, tr: { x: r.right, y: r.top }, br: { x: r.right, y: r.bottom }, bl: { x: r.left, y: r.bottom } };
    for (const k in esquinas) {
      if (Math.abs(p.x - esquinas[k].x) < tol && Math.abs(p.y - esquinas[k].y) < tol) return k;
    }
    return null;
  }
  canvas.addEventListener("pointerdown", (evt) => {
    evt.preventDefault();
    const e = ACR_FOTO_EDIT;
    const p = coordsFrac(evt);
    canvas.setPointerCapture(evt.pointerId);
    if (e.modo === "anotar") {
      e.trazoActual = { color: e.color, grosorFrac: e.grosorFrac, puntos: [p] };
    } else if (e.modo === "texto") {
      e.textoPendiente = p;
      dibujarEditor();
      renderAcreditacion();
    } else {
      const h = handleCercano(p);
      if (h) { e.arrastre = { tipo: "handle", handle: h }; }
      else if (p.x > e.rect.left && p.x < e.rect.right && p.y > e.rect.top && p.y < e.rect.bottom) {
        e.arrastre = { tipo: "mover", offX: p.x - e.rect.left, offY: p.y - e.rect.top, w: e.rect.right - e.rect.left, h: e.rect.bottom - e.rect.top };
      }
    }
  }, { passive: false });
  canvas.addEventListener("pointermove", (evt) => {
    const e = ACR_FOTO_EDIT;
    if (e.modo === "anotar" && e.trazoActual) {
      evt.preventDefault();
      e.trazoActual.puntos.push(coordsFrac(evt));
      dibujarEditor();
    } else if (e.modo === "recortar" && e.arrastre) {
      evt.preventDefault();
      const p = coordsFrac(evt);
      const r = e.rect;
      if (e.arrastre.tipo === "mover") {
        let nl = p.x - e.arrastre.offX, nt = p.y - e.arrastre.offY;
        nl = Math.max(0, Math.min(1 - e.arrastre.w, nl));
        nt = Math.max(0, Math.min(1 - e.arrastre.h, nt));
        r.left = nl; r.top = nt; r.right = nl + e.arrastre.w; r.bottom = nt + e.arrastre.h;
      } else {
        const h = e.arrastre.handle;
        if (h === "tl") { r.left = Math.min(p.x, r.right - 0.04); r.top = Math.min(p.y, r.bottom - 0.04); }
        if (h === "tr") { r.right = Math.max(p.x, r.left + 0.04); r.top = Math.min(p.y, r.bottom - 0.04); }
        if (h === "br") { r.right = Math.max(p.x, r.left + 0.04); r.bottom = Math.max(p.y, r.top + 0.04); }
        if (h === "bl") { r.left = Math.min(p.x, r.right - 0.04); r.bottom = Math.max(p.y, r.top + 0.04); }
        r.left = Math.max(0, r.left); r.top = Math.max(0, r.top); r.right = Math.min(1, r.right); r.bottom = Math.min(1, r.bottom);
      }
      dibujarEditor();
    }
  }, { passive: false });
  function terminar(evt) {
    const e = ACR_FOTO_EDIT;
    if (e.modo === "anotar" && e.trazoActual) {
      if (e.trazoActual.puntos.length > 1) e.trazos.push(e.trazoActual);
      e.trazoActual = null;
    }
    e.arrastre = null;
  }
  canvas.addEventListener("pointerup", terminar);
  canvas.addEventListener("pointercancel", terminar);
}
function colocarTextoPendiente() {
  const e = ACR_FOTO_EDIT;
  const input = document.getElementById("acr-editor-texto-input");
  const texto = input ? input.value.trim() : "";
  if (texto && e.textoPendiente) {
    e.textos.push({ x: e.textoPendiente.x, y: e.textoPendiente.y, texto, color: e.color });
  }
  e.textoPendiente = null;
  renderAcreditacion();
}
function finalizarEdicionFoto() {
  const e = ACR_FOTO_EDIT;
  const foto = ACR_DRAFT.fotos.find((f) => f.id === e.fotoId);
  if (!foto || !e.img) {
    ACR_VISTA = "galeria"; ACR_FOTO_EDIT = null;
    seguirFlujoTrasEditor(e.esAlta, e.fotoId);
    return;
  }
  const W = e.img.naturalWidth, H = e.img.naturalHeight;
  const base = document.createElement("canvas");
  base.width = W; base.height = H;
  const bctx = base.getContext("2d");
  bctx.drawImage(e.img, 0, 0, W, H);
  e.trazos.forEach((t) => {
    if (!t.puntos.length) return;
    bctx.strokeStyle = t.color;
    bctx.lineWidth = Math.max(2, t.grosorFrac * W);
    bctx.lineCap = "round"; bctx.lineJoin = "round";
    bctx.beginPath();
    t.puntos.forEach((p, i) => {
      const x = p.x * W, y = p.y * H;
      if (i === 0) bctx.moveTo(x, y); else bctx.lineTo(x, y);
    });
    bctx.stroke();
  });
  e.textos.forEach((t) => dibujarTextoEnCanvas(bctx, t, W, H));
  const r = e.rect;
  const sx = r.left * W, sy = r.top * H, sw = (r.right - r.left) * W, sh = (r.bottom - r.top) * H;
  let finalDataUrl;
  if (sw < W - 1 || sh < H - 1) {
    const crop = document.createElement("canvas");
    crop.width = Math.max(1, Math.round(sw)); crop.height = Math.max(1, Math.round(sh));
    crop.getContext("2d").drawImage(base, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
    finalDataUrl = crop.toDataURL("image/jpeg", 0.9);
  } else {
    finalDataUrl = base.toDataURL("image/jpeg", 0.9);
  }
  foto.dataUrl = finalDataUrl;
  const esAlta = e.esAlta, fotoId = e.fotoId;
  ACR_VISTA = "galeria";
  ACR_FOTO_EDIT = null;
  seguirFlujoTrasEditor(esAlta, fotoId);
}
function seguirFlujoTrasEditor(esAlta, fotoId) {
  if (!esAlta) { renderAcreditacion(); return; }
  const idx = ACR_ALTA_FOTOS_PENDIENTES.indexOf(fotoId);
  if (idx !== -1) ACR_ALTA_FOTOS_PENDIENTES.splice(idx, 1);
  ACR_CAPTION_QUEUE = [fotoId];
  abrirPromptCaption();
}

function bindCamposTexto(cont) {
  cont.querySelectorAll("[data-acr-field]").forEach((el) => {
    const campo = el.getAttribute("data-acr-field");
    const evento = (el.tagName === "SELECT" || el.type === "checkbox" || el.type === "date") ? "change" : "input";
    el.addEventListener(evento, () => {
      const idx = el.getAttribute("data-idx");
      const elid = el.getAttribute("data-elid");
      const zona = el.getAttribute("data-zona") || null;
      if (campo === "foto-descripcion") {
        if (ACR_DRAFT.fotos[idx]) ACR_DRAFT.fotos[idx].descripcion = el.value;
      } else if (campo === "acompanante-nombre") {
        if (ACR_DRAFT.acompanantes[idx]) ACR_DRAFT.acompanantes[idx].nombre = el.value;
      } else if (campo === "acompanante-cargo") {
        if (ACR_DRAFT.acompanantes[idx]) ACR_DRAFT.acompanantes[idx].cargo = el.value;
      } else if (campo === "checklist-observacion") {
        const estado = obtenerEstadoChecklist(elid, zona);
        estado.observacion = el.value;
      } else if (campo === "esSeguimiento") {
        ACR_DRAFT.esSeguimiento = el.checked;
        renderAcreditacion();
      } else {
        ACR_DRAFT[campo] = el.value;
      }
    });
  });
  const inputZona = document.getElementById("acr-input-zona");
  if (inputZona) {
    inputZona.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") { evt.preventDefault(); agregarZonaDesdeInput(); }
    });
  }
  const inputFotos = document.getElementById("acr-input-fotos");
  if (inputFotos) inputFotos.addEventListener("change", (evt) => { agregarFotosDesdeArchivos(evt.target.files); evt.target.value = ""; });
  const inputTexto = document.getElementById("acr-editor-texto-input");
  if (inputTexto) {
    inputTexto.focus();
    inputTexto.addEventListener("keydown", (evt) => { if (evt.key === "Enter") { evt.preventDefault(); colocarTextoPendiente(); } });
  }
}
function agregarZonaDesdeInput() {
  const input = document.getElementById("acr-input-zona");
  if (!input || !input.value.trim()) return;
  ACR_DRAFT.zonas.push(input.value.trim());
  renderAcreditacion();
}
function attachEventos(overlay) {
  const btnVolver = document.getElementById("acr-btn-volver");
  if (btnVolver) btnVolver.addEventListener("click", () => {
    if (ACR_VISTA === "historial") cerrarVisorAcreditacion();
    else if (ACR_VISTA === "galeria") { ACR_VISTA = "historial"; ACR_DRAFT = null; renderAcreditacion(); }
    else if (ACR_VISTA === "form") { ACR_VISTA = "galeria"; renderAcreditacion(); }
    else if (ACR_VISTA === "editorFoto") { const e = ACR_FOTO_EDIT; ACR_VISTA = "galeria"; ACR_FOTO_EDIT = null; seguirFlujoTrasEditor(e && e.esAlta, e && e.fotoId); }
  });
  bindCamposTexto(overlay);
  if (overlay.dataset.acrClickBind) return;
  overlay.dataset.acrClickBind = "1";
  overlay.addEventListener("click", (evt) => {
    const btn = evt.target.closest("[data-acr-action]");
    if (!btn) return;
    const accion = btn.getAttribute("data-acr-action");
    const id = btn.getAttribute("data-id") ? Number(btn.getAttribute("data-id")) : null;
    const idx = btn.getAttribute("data-idx") != null ? Number(btn.getAttribute("data-idx")) : null;
    const elid = btn.getAttribute("data-elid");
    const zona = btn.getAttribute("data-zona") || null;
    if (accion === "nuevo") abrirNuevoInforme();
    else if (accion === "editar") abrirEditarInforme(id);
    else if (accion === "duplicar") duplicarInforme(id);
    else if (accion === "eliminar") eliminarInforme(id);
    else if (accion === "generar-pdf") generarPDFInformeAcreditacion(id);
    else if (accion === "cancelar") cancelarFormularioInforme();
    else if (accion === "guardar") guardarInformeDesdeFormulario();
    else if (accion === "toggle-foto") toggleSeleccionFoto(idx);
    else if (accion === "toggle-seleccion-todas") toggleSeleccionTodas();
    else if (accion === "borrar-foto") borrarFoto(idx);
    else if (accion === "editar-foto") abrirEditorFoto(Number(btn.getAttribute("data-id")));
    else if (accion === "siguiente-a-form") { ACR_VISTA = "form"; renderAcreditacion(); }
    else if (accion === "toggle-datos-generales") { ACR_DATOS_GENERALES_ABIERTO = !ACR_DATOS_GENERALES_ABIERTO; renderAcreditacion(); }
    else if (accion === "agregar-acompanante") { ACR_DRAFT.acompanantes.push({ nombre: "", cargo: "" }); renderAcreditacion(); }
    else if (accion === "repetir-acompanantes") {
      const anterior = ultimoInformeGuardado();
      if (anterior && anterior.acompanantes.length) ACR_DRAFT.acompanantes = JSON.parse(JSON.stringify(anterior.acompanantes));
      renderAcreditacion();
    }
    else if (accion === "quitar-acompanante") { ACR_DRAFT.acompanantes.splice(idx, 1); renderAcreditacion(); }
    else if (accion === "agregar-zona") agregarZonaDesdeInput();
    else if (accion === "quitar-zona") {
      const zonaBorrada = ACR_DRAFT.zonas[idx];
      ACR_DRAFT.zonas.splice(idx, 1);
      if (zonaBorrada) delete ACR_DRAFT.checklist.porZona[zonaBorrada];
      renderAcreditacion();
    }
    else if (accion === "abrir-elemento-penetrante") abrirModalElemento("penetrante", null);
    else if (accion === "abrir-elemento-junta") abrirModalElemento("junta", null);
    else if (accion === "precargar-levantamiento") precargarElementosDesdeLevantamiento();
    else if (accion === "editar-elemento") abrirModalElemento(null, id);
    else if (accion === "quitar-elemento") {
      ACR_DRAFT.elementos = ACR_DRAFT.elementos.filter((e) => e.id !== id);
      delete ACR_DRAFT.checklist.general[id];
      Object.values(ACR_DRAFT.checklist.porZona).forEach((z) => delete z[id]);
      renderAcreditacion();
    }
    else if (accion === "checklist-modo") { ACR_DRAFT.checklistModo = btn.getAttribute("data-modo"); renderAcreditacion(); }
    else if (accion === "cambiar-zona-activa") { ACR_ZONA_ACTIVA = btn.getAttribute("data-zona"); renderAcreditacion(); }
    else if (accion === "toggle-cumple") {
      const estado = obtenerEstadoChecklist(elid, zona);
      estado.cumple = !estado.cumple;
      estado.marcados = [];
      renderAcreditacion();
    }
    else if (accion === "toggle-check") {
      const estado = obtenerEstadoChecklist(elid, zona);
      const item = btn.getAttribute("data-item");
      const i = estado.marcados.indexOf(item);
      if (i === -1) estado.marcados.push(item); else estado.marcados.splice(i, 1);
      renderAcreditacion();
    }
    else if (accion === "toggle-expandir-checklist") {
      const clave = claveChecklist(elid, zona);
      if (ACR_CHECKLIST_EXPANDIDO.has(clave)) ACR_CHECKLIST_EXPANDIDO.delete(clave); else ACR_CHECKLIST_EXPANDIDO.add(clave);
      renderAcreditacion();
    }
    else if (accion === "abrir-observacion") { ACR_OBSERVACION_ABIERTA.add(claveChecklist(elid, zona)); renderAcreditacion(); }
    else if (accion === "abrir-texto-informe") abrirModalTextoInforme();
    else if (accion === "editor-modo") { ACR_FOTO_EDIT.modo = btn.getAttribute("data-modo"); renderAcreditacion(); }
    else if (accion === "editor-color") { ACR_FOTO_EDIT.color = btn.getAttribute("data-color"); btn.parentElement.querySelectorAll(".acr-color-swatch").forEach((s) => s.classList.remove("active")); btn.classList.add("active"); }
    else if (accion === "editor-deshacer") { ACR_FOTO_EDIT.trazos.pop(); dibujarEditor(); }
    else if (accion === "editor-deshacer-texto") { ACR_FOTO_EDIT.textos.pop(); dibujarEditor(); }
    else if (accion === "editor-texto-cancelar") { ACR_FOTO_EDIT.textoPendiente = null; renderAcreditacion(); }
    else if (accion === "editor-texto-colocar") colocarTextoPendiente();
    else if (accion === "editor-reset-recorte") { ACR_FOTO_EDIT.rect = { left: 0, top: 0, right: 1, bottom: 1 }; dibujarEditor(); }
    else if (accion === "editor-cancelar") { const e = ACR_FOTO_EDIT; ACR_VISTA = "galeria"; ACR_FOTO_EDIT = null; seguirFlujoTrasEditor(e && e.esAlta, e && e.fotoId); }
    else if (accion === "editor-aplicar") finalizarEdicionFoto();
  });
}
function confirmarNuevoElemento() {
  const f = ACR_ELEMENTO_FORM;
  const completo = f.categoria === "penetrante" ? !!f.producto : !!(f.tipo && f.barreras && f.posicion && f.producto);
  if (!completo) {
    if (window.mostrarToast) mostrarToast("Completá la selección antes de añadir.", "error");
    return;
  }
  let nuevoElemento;
  if (f.categoria === "penetrante") {
    const opciones = opcionesProductoPenetrante(f.material, f.tipo, f.ubicacion, f.espacioAnular, f.diametro);
    const encontrado = opciones.find((o) => o.producto === f.producto);
    if (!encontrado) {
      if (window.mostrarToast) mostrarToast("No se pudo agregar — probá elegir el producto de nuevo.", "error");
      console.error("confirmarNuevoElemento: no se encontró el producto en las opciones", f);
      return;
    }
    nuevoElemento = {
      id: ACR_ELEMENTO_EDITANDO_ID != null ? ACR_ELEMENTO_EDITANDO_ID : Date.now() + Math.random(),
      categoria: "penetrante", subtipo: null,
      material: f.material, tipoPenetrante: f.tipo, ubicacion: f.ubicacion, espacioAnular: f.espacioAnular, diametro: f.diametro || null,
      producto: f.producto, sistemaUL: encontrado.sistemaUL, espesor: encontrado.espesor, traslape: null,
    };
  } else {
    const junta = window.juntaParaTipo ? window.juntaParaTipo(f.tipo) : null;
    const fila = resolverFilaJunta(junta, f.tipo, f.barreras, f.posicion, f.producto);
    if (!fila) {
      if (window.mostrarToast) mostrarToast("No se pudo agregar — probá elegir el producto de nuevo.", "error");
      console.error("confirmarNuevoElemento: no se encontró la fila de JUNTAS_TABLE", f);
      return;
    }
    nuevoElemento = {
      id: ACR_ELEMENTO_EDITANDO_ID != null ? ACR_ELEMENTO_EDITANDO_ID : Date.now() + Math.random(),
      categoria: "junta", subtipo: f.tipo === "Muro Cortina" ? "muro_cortina" : "interior",
      juntaTipo: f.tipo, juntaBarreras: f.barreras, juntaPosicion: f.posicion, producto: f.producto,
      sistemaUL: fila.sis, espesor: fila.esp, traslape: fila.tras || null,
    };
  }
  if (ACR_ELEMENTO_EDITANDO_ID != null) {
    const idx = ACR_DRAFT.elementos.findIndex((e) => e.id === ACR_ELEMENTO_EDITANDO_ID);
    if (idx !== -1) ACR_DRAFT.elementos[idx] = nuevoElemento;
  } else {
    ACR_DRAFT.elementos.push(nuevoElemento);
  }
  if (window.mostrarToast) mostrarToast(ACR_ELEMENTO_EDITANDO_ID != null ? "Cambios guardados." : "Agregado.");
  cerrarModalElemento();
  renderAcreditacion();
}

function generarPDFInformeAcreditacion(informeId) {
  const informe = INFORMES_ACREDITACION.find((i) => i.id === informeId);
  if (!informe) return;
  if (!window.jspdf) { if (window.mostrarToast) mostrarToast("No se pudo cargar el motor de PDF.", "error"); return; }
  if (window.mostrarToastProgreso) mostrarToastProgreso("Generando PDF del informe…");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginL = 40, contentRight = 572;
  const titulo = "Informe de Acreditación de Sellos Cortafuego";
  let safe = window.dibujarLetterheadPDF ? window.dibujarLetterheadPDF(doc, titulo) : { top: 140, bottom: 735 };
  let y = safe.top;
  function nuevaPagina() {
    doc.addPage();
    safe = window.dibujarLetterheadPDF ? window.dibujarLetterheadPDF(doc, titulo) : { top: 140, bottom: 735 };
    y = safe.top;
  }
  function checkPageBreak(alturaNecesaria) { if (y + alturaNecesaria > safe.bottom) nuevaPagina(); }

  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20, 20, 20);
  const filasDatos = [
    ["Proyecto", informe.proyecto || "—"],
    ["Cliente", informe.cliente || "—"],
    ["Fecha de visita", (window.fechaLegible ? fechaLegible(informe.fecha) : informe.fecha) || "—"],
    ["Empresa instaladora", informe.empresaInstaladora || "—"],
    ["Inspector", nombreInspectorFirma(informe.inspector)],
    ["Norma / organismo", informe.elementos.length ? Array.from(new Set(informe.elementos.map((el) => normaParaSubtipo(el.categoria, el.subtipo)))).join(" · ") : "—"],
  ];
  doc.autoTable({
    startY: y, margin: { left: marginL, right: 40 }, body: filasDatos, theme: "plain",
    styles: { fontSize: 10, cellPadding: 3, textColor: [20, 20, 20] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 } },
  });
  y = doc.lastAutoTable.finalY + 8;

  if (informe.acompanantes && informe.acompanantes.length) {
    checkPageBreak(20 + informe.acompanantes.length * 13);
    doc.setFont("helvetica", "bold"); doc.text("Acompañantes de la visita:", marginL, y); y += 14;
    doc.setFont("helvetica", "normal");
    informe.acompanantes.forEach((a) => {
      if (!a.nombre) return;
      checkPageBreak(14);
      doc.text(`•  ${a.nombre}${a.cargo ? " — " + a.cargo : ""}`, marginL + 8, y);
      y += 13;
    });
    y += 6;
  }
  if (informe.zonas && informe.zonas.length) {
    checkPageBreak(30);
    doc.setFont("helvetica", "bold"); doc.text("Alcance — niveles / zonas visitados:", marginL, y); y += 14;
    doc.setFont("helvetica", "normal");
    const lineasZonas = doc.splitTextToSize(informe.zonas.join(", "), contentRight - marginL);
    doc.text(lineasZonas, marginL, y);
    y += lineasZonas.length * 13 + 8;
  }

  checkPageBreak(30);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Resultado de la inspección", marginL, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const texto = textoFinalInforme(informe);
  texto.split("\n\n").forEach((parrafo) => {
    const lineas = doc.splitTextToSize(parrafo, contentRight - marginL);
    checkPageBreak(lineas.length * 13 + 10);
    doc.text(lineas, marginL, y);
    y += lineas.length * 13 + 8;
  });

  checkPageBreak(80);
  y += 24;
  doc.setDrawColor(120, 120, 120); doc.line(marginL, y, marginL + 220, y); y += 14;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(nombreInspectorFirma(informe.inspector), marginL, y); y += 13;
  doc.setFont("helvetica", "normal");
  doc.text("Superba — Distribuidor Hilti", marginL, y); y += 13;
  doc.text((window.fechaLegible ? fechaLegible(informe.fecha) : informe.fecha) || "", marginL, y);

  const fotos = (informe.fotos || []).filter((f) => f.seleccionada);
  if (fotos.length) {
    nuevaPagina();
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Registro fotográfico", marginL, y); y += 20;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const imgMaxW = 260, imgMaxH = 195;
    fotos.forEach((foto, idx) => {
      checkPageBreak(imgMaxH + 34);
      try { doc.addImage(foto.dataUrl, "JPEG", marginL, y, imgMaxW, imgMaxH, undefined, "FAST"); } catch (e) { /* si una imagen falla, se sigue con las demás */ }
      const captionY = y + imgMaxH + 14;
      const caption = `Figura ${idx + 1}. ${foto.descripcion || "Sin descripción"}`;
      const lineasCap = doc.splitTextToSize(caption, imgMaxW);
      doc.text(lineasCap, marginL, captionY);
      y = captionY + lineasCap.length * 11 + 18;
    });
  }

  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) { doc.setPage(p); if (window.dibujarNumeroPaginaPDF) dibujarNumeroPaginaPDF(doc, p, totalPaginas); }

  const nombreArchivo = `Informe-Acreditacion-${(informe.proyecto || "proyecto").replace(/[^a-z0-9]+/gi, "-")}-${informe.fecha || ""}.pdf`;
  doc.save(nombreArchivo);
  if (window.mostrarToast) mostrarToast("PDF del informe generado.");
}

document.addEventListener("DOMContentLoaded", () => {
  const btnAbrir = document.getElementById("btn-abrir-acreditacion");
  if (btnAbrir) btnAbrir.addEventListener("click", abrirVisorAcreditacion);
});

window.abrirVisorAcreditacion = abrirVisorAcreditacion;
})();
