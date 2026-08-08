// ============================================================================
// ui-levantamiento.js
// Levantamiento ('Modo campo') — captura rápida en sitio de Penetrantes y de Juntas, un elemento a la vez.
// (Parte del proyecto Calculadora Cortafuego Hilti — ver src/app.js para
// el archivo original sin dividir, y README.md para el mapa completo de módulos.)
// ============================================================================

// LEVANTAMIENTO ("Modo campo"): captura rápida en sitio, un penetrante a la vez
// ============================================================================
const DIAMETROS_COMUNES = [
  { label: '1/4"', v: 0.25 }, { label: '1/2"', v: 0.5 }, { label: '5/8"', v: 0.625 }, { label: '3/4"', v: 0.75 },
  { label: '7/8"', v: 0.875 }, { label: '1"', v: 1 }, { label: '1 1/4"', v: 1.25 }, { label: '1 1/2"', v: 1.5 },
  { label: '2"', v: 2 }, { label: '2 1/2"', v: 2.5 }, { label: '3"', v: 3 }, { label: '4"', v: 4 },
  { label: '6"', v: 6 }, { label: '8"', v: 8 },
];
const DIAMETROS_COMUNES_REDUCIDO = DIAMETROS_COMUNES.filter(d => d.v !== 0.625 && d.v !== 0.875);
// Cables sueltos y cables en paso repenetrable mantienen la lista completa (con 5/8" y 7/8");
// el resto (tuberías, cable armado, etc.) usa la lista reducida, sin esos dos.
function levDiametrosParaTipo(L) {
  return ["Cables Sueltos", "Cables en Paso Repenetrable"].includes(L) ? DIAMETROS_COMUNES : DIAMETROS_COMUNES_REDUCIDO;
}
const ANULAR_COMUNES = [
  { label: '0"', v: 0 }, { label: '1/4"', v: 0.25 }, { label: '1/2"', v: 0.5 }, { label: '3/4"', v: 0.75 }, { label: '1"', v: 1 },
];
const ESPESOR_AISLAMIENTO_COMUNES = [
  { label: '1/2"', v: 0.5 }, { label: '3/4"', v: 0.75 }, { label: '1"', v: 1 }, { label: '1 1/2"', v: 1.5 }, { label: '2"', v: 2 },
];
function levEsAislado(L) { return /aislad/i.test(L || ""); }
function levUsaOcupacion(L) { return ["Bandeja de Cables", "Pasante Múltiple"].includes(L); }
function levUsaSelectorMultiple(L) { return ["Bandeja de Cables", "Pasante Múltiple", "Vacío"].includes(L); }

// Dimensiones predefinidas para Caja Electromecánica UL (en cm: A x B x Profundidad)
const CAJA_PRESETS = {
  "10x10x5": [10, 10, 5],
  "10x5x5": [10, 5, 5],
};
function aplicarPresetCaja(preset) {
  LEV.cajaPreset = preset;
  if (preset === "custom") return; // el usuario ingresa A/B/Prof manualmente
  const [a, b, h] = CAJA_PRESETS[preset];
  const factor = LEV.dimUnidad === "in" ? (1 / 2.54) : 1;
  const round2 = (v) => Math.round(v * factor * 100) / 100;
  LEV.dimA = round2(a); LEV.dimB = round2(b); LEV.profCaja = round2(h);
}
function levOcultaAnular(L) { return ["Pasante Múltiple", "Vacío", "Caja Electromecánica UL"].includes(L); }
function levPermiteVacioRedondo(L) { return L === "Vacío"; }
function levUsaDiametroLibre(L) { return ["Ducto Redondo", "Ducto Redondo Aislado"].includes(L); }
const UMBRAL_CAJA_PUTTY_CM2 = 444.1775; // caja 4-11/16" x 4-11/16" x 2-1/2" — igual que en engine.js
function levAreaCajaActualCm2() {
  const factor = LEV.dimUnidad === "in" ? 2.54 : 1;
  const a = parseFloat(LEV.dimA) * factor, b = parseFloat(LEV.dimB) * factor, h = parseFloat(LEV.profCaja) * factor;
  if (isNaN(a) || isNaN(b) || isNaN(h)) return null; // faltan datos, no se puede saber todavía
  return a * b + 2 * a * h + 2 * b * h;
}
const TIPOS_LEVANTAMIENTO = OPTS_L; // mismo listado de 19 tipos, en el mismo orden
const TIPO_LABEL_CORTO = {
  "Tubería Metal": "Tubería metal",
  "Tubería Metal Aislado": "Metal aislada",
  "Tubería Cobre Aislado HVAC": "Cobre HVAC aislado",
  "Tubería EMT": "EMT",
  "Tubería Combustible (PVC, CPVC, PEX, PP-R)": "Combustible (PVC)",
  "Tubería Combustible Aislada (PVC, CPVC, PEX, PP-R)": "Combustible aislada",
  "Bandeja de Cables": "Bandeja de cables",
  "Cable Armado": "Cable armado",
  "Cables en Paso Repenetrable": "Paso repenetrable",
  "Cables Sueltos": "Cables sueltos",
  "Caja Electromecánica UL": "Caja electromec.",
  "Ducto Rectangular": "Ducto rectangular",
  "Ducto Rectangular Aislado": "Ducto rect. aislado",
  "Ducto Redondo": "Ducto redondo",
  "Ducto Redondo Aislado": "Ducto red. aislado",
  "Pasante Múltiple": "Pasante múltiple",
  "Vacío": "Vacío",
  "Viga W": "Viga W",
  "Viga Canal": "Viga canal",
  "Viga Tubo Rectangular": "Viga tubo rect.",
};

let LEV_MODE = "penetrantes"; // "penetrantes" | "juntas"
const LEV = {
  zona: "", nivel: "",
  tipo: null,
  diametro: "", dimA: "", dimB: "", profCaja: "", dimUnidad: "cm", vacioModo: "dim", diametroLibre: "",
  espesorAislamiento: "", espesorAislamientoOtro: false,
  ocupacion: "",
  anular: 0.5, anularOtro: false,
  barrera: "Pared", material: "Panel de Yeso", fRating: "1 Hora", membrana: false,
  cantidad: 1, nota: "", puttySize: 7, puttyInst: "Fuera", materialMultiple: "Pasta FS ONE MAX",
  cajaPreset: "10x10x5",
  editandoId: null,
};

// Anchos de junta preseleccionables (in) — "Otro" habilita el campo libre.
const ANCHOS_JUNTA_PRESET = [
  { v: 0, label: "0\"" }, { v: 0.25, label: "1/4\"" }, { v: 0.5, label: "1/2\"" },
  { v: 0.625, label: "5/8\"" }, { v: 1, label: "1\"" }, { v: 2, label: "2\"" },
  { v: 4, label: "4\"" }, { v: 6, label: "6\"" }, { v: 8, label: "8\"" },
];
// Dado un ancho en pulgadas (o "" ), devuelve {ancho, anchoEsOtro} listo para
// el estado LEV_J: si calza con un preset lo deja seleccionado, si no, cae en
// "Otro" con el valor tal cual (redondeado a 3 decimales por precisión de conversión).
function anchoJuntaComoPreset(anchoPulgadas) {
  if (anchoPulgadas === "" || anchoPulgadas === null || anchoPulgadas === undefined || isNaN(anchoPulgadas)) {
    return { ancho: "", anchoEsOtro: false };
  }
  const val = Math.round(n(anchoPulgadas) * 1000) / 1000;
  const match = ANCHOS_JUNTA_PRESET.find(a => Math.abs(a.v - val) < 0.001);
  return match ? { ancho: String(match.v), anchoEsOtro: false } : { ancho: String(val), anchoEsOtro: true };
}

// Estado del capturador de Levantamiento Juntas
const LEV_J = {
  zona: "", nivel: "",
  junta: null, tipo: null, barreras: null, posicion: null,
  pePosicion: null, // solo Pared-Entrepiso: Lateral/Superior/Inferior/Superior e Inferior (se pregunta primero)
  posicionPI: "Superior e Inferior", // solo Pared-Entrepiso / Panel de yeso-Concreto
  lados: "Ambos lados",
  producto: null,
  dimUnidad: "cm", longitud: "", ancho: "", anchoEsOtro: false, anchoLana: "", anchoLanaManual: false,
  espesorPared: "", espesorParedManual: false,
  cantidad: 1, calcularLana: true, nota: "",
  editandoId: null,
  _filaRespaldo: null,
};

function levUsaDimAB(L) {
  return camposRequeridos(L).F;
}

function levChip(grupo, valor, label, activo, deshabilitado) {
  if (deshabilitado) return `<button type="button" class="lev-chip lev-chip-disabled" disabled title="No disponible para este tipo de penetrante">${label}</button>`;
  return `<button type="button" class="lev-chip ${activo ? "lev-chip-active" : ""}" data-lev-grupo="${grupo}" data-lev-valor="${escapeHtml(valor)}">${label}</button>`;
}

// ============================================================================
// LEVANTAMIENTO JUNTAS — pantalla de captura
// ============================================================================
function levJChip(grupo, valor, label, activo, iconIds) {
  if (iconIds) {
    const ids = Array.isArray(iconIds) ? iconIds : [iconIds];
    const iconsHtml = ids.map(id => `<svg class="icon-junta"><use href="#${id}"/></svg>`).join("");
    return `<button type="button" class="lev-chip lev-chip-icon ${activo ? "lev-chip-active" : ""}" data-levj-grupo="${grupo}" data-levj-valor="${escapeHtml(valor)}">
      <span class="icon-junta-row">${iconsHtml}</span>
      <span>${escapeHtml(label)}</span>
    </button>`;
  }
  return `<button type="button" class="lev-chip ${activo ? "lev-chip-active" : ""}" data-levj-grupo="${grupo}" data-levj-valor="${escapeHtml(valor)}">${escapeHtml(label)}</button>`;
}

function iconoJuntaTipo(junta, tipo) {
  if (junta === "Vertical" && tipo === "Pared - Pared") return "ij-vert-pared-pared";
  if (junta === "Horizontal" && tipo === "Entrepiso - Entrepiso") return "ij-horiz-entrepiso-entrepiso";
  if (junta === "Horizontal" && tipo === "Muro Cortina") return "ij-horiz-muro-cortina";
  if (junta === "Horizontal" && tipo === "Pared - Entrepiso") {
    return ["ij-horiz-pared-entrepiso-superior", "ij-horiz-pared-entrepiso-lateral", "ij-horiz-pared-entrepiso-inferior"];
  }
  return null;
}
function iconoJuntaPosicion(tipo, posicion) {
  if (tipo !== "Pared - Entrepiso") return null;
  if (posicion === "Superior") return "ij-horiz-pared-entrepiso-superior";
  if (posicion === "Inferior") return "ij-horiz-pared-entrepiso-inferior";
  if (posicion === "Lateral") return "ij-horiz-pared-entrepiso-lateral";
  return null;
}

// Pared - Entrepiso: acá se pregunta primero la Posición (con su ícono) y
// recién después la Barrera Cortafuego, porque en campo es más natural mirar
// la junta y decir "esto es un lateral" antes que pensar en los materiales.
function iconoPosicionPE(macro) {
  if (macro === "Lateral") return "ij-horiz-pared-entrepiso-lateral";
  if (macro === "Superior") return "ij-horiz-pared-entrepiso-superior";
  if (macro === "Inferior") return "ij-horiz-pared-entrepiso-inferior";
  if (macro === "Superior e Inferior") return ["ij-horiz-pared-entrepiso-superior", "ij-horiz-pared-entrepiso-inferior"];
  return null;
}
// Estos casos son siempre "un lado" físicamente (no hay una cara opuesta que
// sellar), así que ni se pregunta: se fuerza el valor y no se muestra el selector.
function usaLadosSelector(tipo, pePosicionOPosicion) {
  if (tipo === "Entrepiso - Entrepiso") return false;
  if (tipo === "Muro Cortina") return false;
  if (tipo === "Pared - Entrepiso" && pePosicionOPosicion === "Lateral") return false;
  return true;
}

// Cuando hay más de una Posición posible pero en la práctica casi siempre es
// la misma, se preselecciona (el chip queda tocable por si hace falta cambiarlo).
const POSICION_DEFAULT_PREFERIDA = {
  "Concreto - Panel de yeso": "Perpendicular", // Vertical Pared-Pared
  "Concreto - Fachada": "Sistema Intertek", // Muro Cortina
};

function barrerasParaPosicionPE(macro) {
  if (macro === "Lateral") return ["Concreto - Concreto"];
  if (macro === "Superior") return ["Concreto - Concreto", "Panel de yeso - Concreto"];
  if (macro === "Inferior") return ["Panel de yeso - Concreto"];
  if (macro === "Superior e Inferior") return ["Panel de yeso - Concreto"];
  return [];
}
// Traduce la Posición macro (elegida primero) + la Barrera ya elegida al par
// posicion/posicionPI que usa el motor de cálculo (computeJuntaRow).
function aplicarPosicionDesdeMacroPE() {
  const macro = LEV_J.pePosicion;
  if (LEV_J.barreras === "Concreto - Concreto") {
    LEV_J.posicion = macro; // "Lateral" o "Superior"
    LEV_J.posicionPI = null;
  } else if (LEV_J.barreras === "Panel de yeso - Concreto") {
    LEV_J.posicion = null;
    LEV_J.posicionPI = macro === "Superior" ? "Solo superior" : macro === "Inferior" ? "Solo inferior" : "Superior e Inferior";
  }
}

// "Panel de yeso" se muestra como "Gypsum" (el dato interno no cambia, solo el rótulo)
function materialSwatchClase(material) {
  if (/panel de yeso/i.test(material || "")) return "swatch-gypsum";
  if (/fachada/i.test(material || "")) return "swatch-fachada";
  return "swatch-concreto";
}
function materialLabelCorto(material) {
  return (material || "").replace(/panel de yeso/i, "Gypsum").trim();
}
function barrerasLabelCorto(barreras) {
  const [a, b] = (barreras || "").split(" - ");
  return `${materialLabelCorto(a)} + ${materialLabelCorto(b)}`;
}
function levJChipTipo(item, activo) {
  const iconIds = iconoJuntaTipo(item.junta, item.tipo);
  const iconsHtml = iconIds ? `<span class="icon-junta-row">${(Array.isArray(iconIds) ? iconIds : [iconIds]).map(id => `<svg class="icon-junta"><use href="#${id}"/></svg>`).join("")}</span>` : "";
  return `<button type="button" class="lev-chip lev-chip-icon ${activo ? "lev-chip-active" : ""}" data-levj-grupo="tipo" data-levj-valor="${escapeHtml(item.tipo)}">
    ${iconsHtml}
    <span>${escapeHtml(item.tipo)}</span>
    <span class="lev-chip-caption">${item.junta}</span>
  </button>`;
}

function levJChipBarreras(valor, activo) {
  const [a, b] = (valor || "").split(" - ");
  return `<button type="button" class="lev-chip lev-chip-swatch ${activo ? "lev-chip-active" : ""}" data-levj-grupo="barreras" data-levj-valor="${escapeHtml(valor)}">
    <span class="swatch-pair"><span class="swatch ${materialSwatchClase(a)}"></span><span class="swatch ${materialSwatchClase(b)}"></span></span>
    <span>${escapeHtml(barrerasLabelCorto(valor))}</span>
  </button>`;
}


function opcionesLevJ() {
  const juntas = juntasDisponibles();
  const tipos = LEV_J.junta ? tiposParaJunta(LEV_J.junta) : [];
  const barreras = (LEV_J.junta && LEV_J.tipo) ? barrerasParaTipo(LEV_J.junta, LEV_J.tipo) : [];
  const posiciones = (LEV_J.junta && LEV_J.tipo && LEV_J.barreras) ? posicionesParaCombo(LEV_J.junta, LEV_J.tipo, LEV_J.barreras) : [];
  const superiorInferior = (LEV_J.junta && LEV_J.tipo && LEV_J.barreras) ? esComboSuperiorInferior(LEV_J.junta, LEV_J.tipo, LEV_J.barreras) : false;
  const posicionActiva = superiorInferior ? (LEV_J.posicionPI === "Solo inferior" ? "Inferior" : "Superior") : LEV_J.posicion;
  const productos = (LEV_J.junta && LEV_J.tipo && LEV_J.barreras && posicionActiva) ? productosParaCombo(LEV_J.junta, LEV_J.tipo, LEV_J.barreras, posicionActiva) : [];
  const esMuroCortina = LEV_J.tipo === "Muro Cortina";
  const usaEspPared = (LEV_J.tipo && LEV_J.posicion !== null) ? usaEspesorPared(LEV_J.tipo, LEV_J.posicion) : (LEV_J.tipo ? usaEspesorPared(LEV_J.tipo, LEV_J.posicion) : false);
  return { juntas, tipos, tiposTodos: todosLosTipos(), barreras, posiciones, superiorInferior, posicionActiva, productos, esMuroCortina, usaEspPared };
}

function tieneDatosCompletosLevJ(o) {
  if (!LEV_J.junta || !LEV_J.tipo || !LEV_J.barreras || !LEV_J.producto) return false;
  if (o.superiorInferior) { if (!LEV_J.posicionPI) return false; } else if (o.posiciones.length > 1 && !LEV_J.posicion) return false;
  if (!(n(LEV_J.longitud) > 0)) return false;
  return true;
}

// Si con la selección actual solo hay un producto posible, se elige solo. Si
// hay varios pero CP 606 es uno de ellos, se prioriza porque es el más usado
// — igual queda tocable por si hace falta otro producto.
function autoseleccionarProductoLevJ() {
  const o = opcionesLevJ();
  if (o.productos.includes("CP 606")) LEV_J.producto = "CP 606";
  else if (o.productos.length === 1) LEV_J.producto = o.productos[0];
}

function renderLevantamientoJuntas(cont) {
  const o = opcionesLevJ();
  const editando = LEV_J.editandoId !== null;

  const anchoLanaDefault = LEV_J.ancho === "" ? "" : (LEV_J.dimUnidad === "in" ? LEV_J.ancho : round2(n(LEV_J.ancho) * 2.54));

  cont.innerHTML = `
    <div class="lev-wrap">
      <div class="lev-sticky-bar">
        <div class="lev-field">
          <label>Zona / Descripción</label>
          <input type="text" id="levj-zona" placeholder="Ej. Cuarto eléctrico" value="${escapeHtml(LEV_J.zona)}">
        </div>
        <div class="lev-field lev-field-small">
          <label>Nivel</label>
          <input type="text" id="levj-nivel" placeholder="Opcional" value="${escapeHtml(LEV_J.nivel)}">
        </div>
      </div>

      ${editando ? `<div class="lev-editing-banner"><svg class="icon"><use href="#i-edit"/></svg>Editando un elemento de la lista — al tocar "Guardar cambios" se actualiza. <button type="button" id="levj-btn-cancelar">Cancelar</button></div>` : ""}

      <div class="lev-section">
        <label>Tipo de junta</label>
        <div class="lev-chip-grid">
          ${o.tiposTodos.map(item => levJChipTipo(item, LEV_J.tipo === item.tipo)).join("")}
        </div>
      </div>

      ${LEV_J.tipo === "Pared - Entrepiso" ? `
      <div class="lev-section">
        <label>Posición</label>
        <div class="lev-chip-grid">
          ${["Lateral", "Superior", "Inferior", "Superior e Inferior"].map(v => levJChip("pePosicion", v, v, LEV_J.pePosicion === v, iconoPosicionPE(v))).join("")}
        </div>
      </div>

      ${LEV_J.pePosicion ? `
      <div class="lev-section">
        <label>Barreras Cortafuego</label>
        <div class="lev-chip-grid">
          ${barrerasParaPosicionPE(LEV_J.pePosicion).map(v => levJChipBarreras(v, LEV_J.barreras === v)).join("")}
        </div>
      </div>` : ""}

      ${LEV_J.barreras && usaLadosSelector(LEV_J.tipo, LEV_J.pePosicion) ? `
      <div class="lev-section">
        <label>Lados</label>
        <div class="lev-toggle-group">
          ${["Ambos lados", "Un lado"].map(v => levJChip("lados", v, v, LEV_J.lados === v)).join("")}
        </div>
      </div>` : ""}
      ` : `

      ${LEV_J.tipo ? `
      <div class="lev-section">
        <label>Barreras Cortafuego</label>
        <div class="lev-chip-grid">
          ${o.barreras.map(v => levJChipBarreras(v, LEV_J.barreras === v)).join("")}
        </div>
      </div>` : ""}

      ${LEV_J.barreras && usaLadosSelector(LEV_J.tipo) ? `
      <div class="lev-section">
        <label>Lados</label>
        <div class="lev-toggle-group">
          ${["Ambos lados", "Un lado"].map(v => levJChip("lados", v, v, LEV_J.lados === v)).join("")}
        </div>
      </div>` : ""}

      ${LEV_J.barreras && o.posiciones.length > 1 ? `
      <div class="lev-section">
        <label>${o.esMuroCortina ? "Sistema" : "Posición"}</label>
        <div class="lev-toggle-group">
          ${o.posiciones.map(v => levJChip("posicion", v, o.esMuroCortina ? v.replace(/^Sistema /, "") : v, LEV_J.posicion === v)).join("")}
        </div>
      </div>` : ""}
      `}

      ${o.productos.length > 0 ? `
      <div class="lev-section">
        <label>Producto</label>
        <div class="lev-chip-grid">
          ${o.productos.map(v => levJChip("producto", v, v, LEV_J.producto === v)).join("")}
        </div>
      </div>` : ""}

      ${LEV_J.producto ? `
      <div class="lev-section">
        <div class="lev-section-head-row">
          <label>Medidas de la junta — ancho 0 si está topada</label>
          <div class="lev-unidad-toggle-mini">
            <button type="button" class="lev-unidad-btn ${LEV_J.dimUnidad === "cm" ? "lev-unidad-btn-active" : ""}" data-levj-grupo="dimUnidad" data-levj-valor="cm">cm</button>
            <button type="button" class="lev-unidad-btn ${LEV_J.dimUnidad === "in" ? "lev-unidad-btn-active" : ""}" data-levj-grupo="dimUnidad" data-levj-valor="in">in</button>
          </div>
        </div>
        <label class="lev-sublabel">Longitud de Junta (${LEV_J.dimUnidad})</label>
        <input type="number" inputmode="decimal" step="0.1" id="levj-longitud" placeholder="Longitud" value="${LEV_J.longitud}" class="lev-input-otro lev-input-otro-compact" style="margin-top:0;">
        <label class="lev-sublabel" style="margin-top:12px;">Ancho de Junta (in)</label>
        <div class="lev-chip-grid lev-chip-grid-compact">
          ${ANCHOS_JUNTA_PRESET.map(a => `<button type="button" class="lev-chip lev-chip-compact ${!LEV_J.anchoEsOtro && LEV_J.ancho !== "" && n(LEV_J.ancho) === a.v ? "lev-chip-active" : ""}" data-levj-ancho-preset="${a.v}">${a.label}</button>`).join("")}
          <input type="number" inputmode="decimal" step="0.1" id="levj-ancho-otro" class="lev-chip lev-chip-input lev-chip-otro-grande ${LEV_J.anchoEsOtro ? "lev-chip-active" : ""}" placeholder="Otro (cm)" value="${LEV_J.anchoEsOtro && LEV_J.ancho !== "" ? round2(n(LEV_J.ancho) * 2.54) : ""}">
        </div>
      </div>

      ${o.esMuroCortina ? `
      <div class="lev-section">
        <label>Ancho del sector de lana o bandeja (${LEV_J.dimUnidad})</label>
        <input type="number" inputmode="decimal" step="0.1" id="levj-anchoLana" class="lev-input-otro lev-input-otro-compact" style="margin-top:0;" value="${LEV_J.anchoLana !== "" ? LEV_J.anchoLana : anchoLanaDefault}">
      </div>` : ""}

      ${o.usaEspPared ? `
      <div class="lev-inline-discreto">
        <label for="levj-espesorPared">Espesor de pared (cm)</label>
        <input type="number" inputmode="decimal" step="0.1" id="levj-espesorPared" value="${LEV_J.espesorPared}">
      </div>` : ""}

      <div class="lev-section">
        <label class="lev-checkbox-row">
          <input type="checkbox" id="levj-calcularLana" ${LEV_J.calcularLana ? "checked" : ""}>
          Calcular lana mineral
        </label>
      </div>

      <div class="lev-section">
        <label>Cantidad</label>
        <div class="lev-stepper lev-stepper-full">
          <div class="qty-btn-group">
            <button type="button" data-levj-cant="-10">−10</button>
            <button type="button" data-levj-cant="-5">−5</button>
            <button type="button" data-levj-cant="-1">−1</button>
          </div>
          <input type="number" inputmode="numeric" id="levj-cantidad" value="${LEV_J.cantidad}" min="1">
          <div class="qty-btn-group">
            <button type="button" data-levj-cant="1">+1</button>
            <button type="button" data-levj-cant="5">+5</button>
            <button type="button" data-levj-cant="10">+10</button>
          </div>
        </div>
      </div>

      <div class="lev-section">
        <label>Nota (opcional)</label>
        <input type="text" id="levj-nota" class="lev-input-otro" style="margin-top:0;" value="${escapeHtml(LEV_J.nota)}">
      </div>

      <button type="button" class="primary lev-add-btn" id="levj-btn-guardar">${editando ? "Guardar cambios" : "Agregar a la lista"}</button>` : ""}
    </div>
    <div class="lev-wrap" style="padding-top:0;">
      <div id="levj-lista"></div>
    </div>
  `;

  renderListaLevJ();
  attachLevantamientoJuntasEvents(cont);
}

function agruparJuntasPorZona() {
  const grupos = [];
  const idxPorClave = new Map();
  ROWS_J.filter(tieneDatosMinimosJunta).forEach(r => {
    const zonaRaw = r.A || "(sin zona)";
    const nivel = r.B || "";
    const key = zonaRaw + "‖" + nivel;
    if (!idxPorClave.has(key)) {
      const label = nivel ? `${zonaRaw} — Nivel ${nivel}` : zonaRaw;
      idxPorClave.set(key, grupos.length);
      grupos.push({ zona: label, zonaRaw, nivel, items: [] });
    }
    grupos[idxPorClave.get(key)].items.push(r);
  });
  return grupos;
}

function describirItemLevJ(r) {
  const c = computeSingleJuntaRow(r);
  const posTxt = c.superiorInferior ? ` · ${r.posicionPI}` : (r.posicion ? ` · ${r.posicion}` : "");
  return `${r.cantidad}x ${escapeHtml(r.junta)} ${escapeHtml(r.tipo)} (${escapeHtml(barrerasLabelCorto(r.barreras))})${posTxt} · ${escapeHtml(r.producto)} · ${r.longitud}×${r.ancho}cm · ${escapeHtml(r.lados)}`;
}

function renderListaLevJ() {
  const cont = document.getElementById("levj-lista");
  if (!cont) return;
  const grupos = agruparJuntasPorZona();
  if (grupos.length === 0) { cont.innerHTML = `<div class="hint" style="margin:0;">Todavía no agregaste ninguna junta.</div>`; return; }
  cont.innerHTML = grupos.map(g => `
    <div class="lev-zona-group">
      <div class="lev-zona-title">${escapeHtml(g.zona)} <span class="lev-hint-sticky">(${g.items.length})</span></div>
      <div class="lev-recent-list">
        ${g.items.map(r => `
        <div class="lev-recent-item">
          <div class="lev-recent-main">
            <span>${describirItemLevJ(r)}</span>
            ${r.nota ? `<span class="lev-recent-nota">${escapeHtml(r.nota)}</span>` : ""}
          </div>
          <span class="lev-recent-actions">
            <span class="qty-stepper">
              <button type="button" data-levj-qty-btn="${r._id}" data-delta="-1" aria-label="Restar 1">−</button>
              <span class="qty-val">${r.cantidad}</span>
              <button type="button" data-levj-qty-btn="${r._id}" data-delta="1" aria-label="Sumar 1">+</button>
            </span>
            <button type="button" data-levj-edit-btn="${r._id}" aria-label="Editar"><svg class="icon"><use href="#i-edit"/></svg></button>
            <button type="button" data-levj-del-btn="${r._id}" aria-label="Eliminar"><svg class="icon"><use href="#i-close"/></svg></button>
          </span>
        </div>`).join("")}
      </div>
    </div>`).join("");
  cont.querySelectorAll("[data-levj-qty-btn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.levjQtyBtn, 10);
      const delta = parseInt(btn.dataset.delta, 10);
      const row = ROWS_J.find(r => r._id === id);
      if (row) { pushUndo(); row.cantidad = Math.max(1, row.cantidad + delta); marcarCambio(); renderListaLevJ(); }
    });
  });
  cont.querySelectorAll("[data-levj-edit-btn]").forEach(btn => {
    btn.addEventListener("click", () => editarItemLevJ(parseInt(btn.dataset.levjEditBtn, 10)));
  });
  cont.querySelectorAll("[data-levj-del-btn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.levjDelBtn, 10);
      pushUndo();
      ROWS_J = ROWS_J.filter(r => r._id !== id);
      marcarCambio();
      renderListaLevJ();
    });
  });
}

function editarItemLevJ(id) {
  const row = ROWS_J.find(r => r._id === id);
  if (!row) return;
  let pePosicion = null;
  if (row.tipo === "Pared - Entrepiso") {
    if (row.posicionPI) pePosicion = row.posicionPI === "Solo superior" ? "Superior" : row.posicionPI === "Solo inferior" ? "Inferior" : "Superior e Inferior";
    else pePosicion = row.posicion; // "Lateral" o "Superior"
  }
  Object.assign(LEV_J, {
    zona: row.A, nivel: row.B, junta: row.junta, tipo: row.tipo, barreras: row.barreras, posicion: row.posicion,
    pePosicion, posicionPI: row.posicionPI || "Superior e Inferior", lados: row.lados, producto: row.producto,
    dimUnidad: "cm", longitud: row.longitud,
    ...anchoJuntaComoPreset(row.ancho !== "" && row.ancho != null ? n(row.ancho) / 2.54 : ""),
    anchoLana: row.anchoLana || "",
    espesorPared: row.espesorPared || "", cantidad: row.cantidad, calcularLana: row.calcularLana, nota: row.nota || "",
    editandoId: id,
  });
  renderLevantamiento();
}

function limpiarFormularioLevJ(mantenerZona) {
  Object.assign(LEV_J, {
    junta: null, tipo: null, barreras: null, posicion: null, pePosicion: null, posicionPI: "Superior e Inferior", lados: "Ambos lados",
    producto: null, dimUnidad: "cm", longitud: "", ancho: "", anchoEsOtro: false, anchoLana: "", anchoLanaManual: false,
    espesorPared: "", espesorParedManual: false, cantidad: 1, calcularLana: true, nota: "", editandoId: null,
  });
  if (!mantenerZona) { LEV_J.zona = ""; LEV_J.nivel = ""; }
}

// Reset "liviano": para agregar la siguiente junta en la misma zona lo más rápido
// posible se mantiene toda la clasificación (junta/tipo/barreras/posición/lados/
// producto) y solo se limpian las medidas — igual que en Levantamiento Penetrantes.
function limpiarMedidasLevJ() {
  LEV_J.longitud = ""; LEV_J.ancho = ""; LEV_J.anchoEsOtro = false; LEV_J.anchoLana = ""; LEV_J.anchoLanaManual = false;
  LEV_J.cantidad = 1; LEV_J.nota = ""; LEV_J.editandoId = null;
}

function guardarItemLevJ() {
  const o = opcionesLevJ();
  if (!tieneDatosCompletosLevJ(o)) { mostrarToast("Completá la longitud de la junta antes de guardar.", "error"); return; }
  pushUndo();
  const data = {
    A: LEV_J.zona, B: LEV_J.nivel, junta: LEV_J.junta, tipo: LEV_J.tipo, barreras: LEV_J.barreras,
    posicion: o.superiorInferior ? null : LEV_J.posicion, posicionPI: o.superiorInferior ? LEV_J.posicionPI : null,
    lados: LEV_J.lados, producto: LEV_J.producto,
    longitud: LEV_J.dimUnidad === "in" ? n(LEV_J.longitud) * 2.54 : n(LEV_J.longitud),
    ancho: n(LEV_J.ancho) * 2.54,
    anchoLana: LEV_J.anchoLana !== "" ? (LEV_J.dimUnidad === "in" ? n(LEV_J.anchoLana) * 2.54 : n(LEV_J.anchoLana)) : n(LEV_J.ancho) * 2.54,
    espesorPared: LEV_J.espesorPared !== "" ? n(LEV_J.espesorPared) : espesorParedPorDefecto(LEV_J.barreras),
    cantidad: LEV_J.cantidad, calcularLana: LEV_J.calcularLana, nota: LEV_J.nota,
  };
  const fueEdicion = LEV_J.editandoId !== null;
  if (fueEdicion) {
    const idx = ROWS_J.findIndex(r => r._id === LEV_J.editandoId);
    if (idx >= 0) ROWS_J[idx] = Object.assign({ _id: LEV_J.editandoId }, data);
  } else {
    ROWS_J.push(Object.assign({ _id: ROW_J_SEQ++ }, data));
  }
  limpiarMedidasLevJ();
  marcarCambio();
  renderLevantamiento();
  mostrarToast(fueEdicion ? "Cambios guardados." : `Agregado: ${data.cantidad}x ${data.junta} ${data.tipo}`);
}

function attachLevantamientoJuntasEvents(cont) {
  const zonaEl = cont.querySelector("#levj-zona");
  if (zonaEl) zonaEl.addEventListener("input", () => { LEV_J.zona = zonaEl.value; });
  const nivelEl = cont.querySelector("#levj-nivel");
  if (nivelEl) nivelEl.addEventListener("input", () => { LEV_J.nivel = nivelEl.value; });

  cont.querySelectorAll("[data-levj-grupo]").forEach(btn => {
    btn.addEventListener("click", () => {
      const grupo = btn.dataset.levjGrupo;
      const valor = btn.dataset.levjValor;
      // Tocar de nuevo un chip que ya estaba activo no debe reiniciar las
      // selecciones de abajo (tipo/barreras/posición pegadas entre juntas).
      const yaActivo = { tipo: LEV_J.tipo, pePosicion: LEV_J.pePosicion, barreras: LEV_J.barreras, posicion: LEV_J.posicion, posicionPI: LEV_J.posicionPI, lados: LEV_J.lados, producto: LEV_J.producto, dimUnidad: LEV_J.dimUnidad };
      if (yaActivo[grupo] === valor) return;
      if (grupo === "tipo") {
        LEV_J.junta = juntaParaTipo(valor); LEV_J.tipo = valor; LEV_J.barreras = null; LEV_J.posicion = null; LEV_J.posicionPI = null; LEV_J.pePosicion = null; LEV_J.producto = null;
        if (valor === "Entrepiso - Entrepiso" || valor === "Muro Cortina") LEV_J.lados = "Un lado";
        else LEV_J.lados = "Ambos lados";
        if (valor !== "Pared - Entrepiso") {
          const barrerasPosibles = barrerasParaTipo(LEV_J.junta, valor);
          if (barrerasPosibles.length === 1) {
            LEV_J.barreras = barrerasPosibles[0];
            const posibles = posicionesParaCombo(LEV_J.junta, LEV_J.tipo, LEV_J.barreras);
            const preferida = POSICION_DEFAULT_PREFERIDA[LEV_J.barreras];
            LEV_J.posicion = posibles.length === 1 ? posibles[0] : (preferida && posibles.includes(preferida) ? preferida : null);
            if (!LEV_J.espesorParedManual) LEV_J.espesorPared = round2(espesorParedPorDefecto(LEV_J.barreras));
            autoseleccionarProductoLevJ();
          }
        }
      } else if (grupo === "pePosicion") {
        LEV_J.pePosicion = valor; LEV_J.barreras = null; LEV_J.posicion = null; LEV_J.posicionPI = null; LEV_J.producto = null;
        if (valor === "Lateral") LEV_J.lados = "Un lado";
        else LEV_J.lados = "Ambos lados";
        const posiblesBarreras = barrerasParaPosicionPE(valor);
        if (posiblesBarreras.length === 1) {
          LEV_J.barreras = posiblesBarreras[0];
          aplicarPosicionDesdeMacroPE();
          if (!LEV_J.espesorParedManual) LEV_J.espesorPared = round2(espesorParedPorDefecto(LEV_J.barreras));
          autoseleccionarProductoLevJ();
        }
      } else if (grupo === "barreras") {
        LEV_J.barreras = valor; LEV_J.producto = null;
        if (LEV_J.tipo === "Pared - Entrepiso") {
          aplicarPosicionDesdeMacroPE();
        } else {
          const posibles = posicionesParaCombo(LEV_J.junta, LEV_J.tipo, valor);
          const preferida = POSICION_DEFAULT_PREFERIDA[valor];
          LEV_J.posicion = posibles.length === 1 ? posibles[0] : (preferida && posibles.includes(preferida) ? preferida : null);
        }
        if (!LEV_J.espesorParedManual) LEV_J.espesorPared = round2(espesorParedPorDefecto(valor));
        autoseleccionarProductoLevJ();
      } else if (grupo === "posicion") {
        LEV_J.posicion = valor; LEV_J.producto = null;
        autoseleccionarProductoLevJ();
      } else if (grupo === "posicionPI") {
        LEV_J.posicionPI = valor;
        autoseleccionarProductoLevJ();
      } else if (grupo === "lados") {
        LEV_J.lados = valor;
      } else if (grupo === "producto") {
        LEV_J.producto = valor;
      } else if (grupo === "dimUnidad") {
        if (valor !== LEV_J.dimUnidad) {
          const factor = valor === "in" ? (1 / 2.54) : 2.54;
          const conv = (v) => (v === "" || v === null || isNaN(parseFloat(v))) ? v : round2(parseFloat(v) * factor);
          LEV_J.longitud = conv(LEV_J.longitud); LEV_J.anchoLana = conv(LEV_J.anchoLana);
          LEV_J.dimUnidad = valor;
        }
      }
      renderLevantamiento();
    });
  });

  ["longitud", "anchoLana", "espesorPared", "nota"].forEach(campo => {
    const el = cont.querySelector("#levj-" + campo);
    if (el) el.addEventListener("input", () => {
      LEV_J[campo] = el.value;
      if (campo === "anchoLana") LEV_J.anchoLanaManual = true;
      if (campo === "espesorPared") LEV_J.espesorParedManual = true;
    });
  });
  // Ancho de junta: chips preseleccionados (en pulgadas) + "Otro" con campo libre.
  // Muro Cortina: el ancho del sector de lana/bandeja copia el ancho de la
  // junta (convertido a la unidad activa) hasta que se edite manualmente.
  const espejearAnchoLana = () => {
    if (LEV_J.anchoLanaManual) return;
    LEV_J.anchoLana = LEV_J.ancho === "" ? "" : (LEV_J.dimUnidad === "in" ? LEV_J.ancho : String(round2(n(LEV_J.ancho) * 2.54)));
  };
  cont.querySelectorAll("[data-levj-ancho-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      LEV_J.ancho = btn.dataset.levjAnchoPreset;
      LEV_J.anchoEsOtro = false;
      espejearAnchoLana();
      renderLevantamiento();
    });
  });
  const anchoOtroInput = cont.querySelector("#levj-ancho-otro");
  if (anchoOtroInput) anchoOtroInput.addEventListener("input", () => {
    const cm = anchoOtroInput.value;
    LEV_J.ancho = cm === "" ? "" : String(n(cm) / 2.54);
    LEV_J.anchoEsOtro = cm !== "";
    espejearAnchoLana();
  });
  const longitudEl = cont.querySelector("#levj-longitud");
  if (longitudEl) longitudEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); guardarItemLevJ(); } });
  if (anchoOtroInput) anchoOtroInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); guardarItemLevJ(); } });
  const calcularLanaEl = cont.querySelector("#levj-calcularLana");
  if (calcularLanaEl) calcularLanaEl.addEventListener("change", () => { LEV_J.calcularLana = calcularLanaEl.checked; });
  const cantidadEl = cont.querySelector("#levj-cantidad");
  if (cantidadEl) cantidadEl.addEventListener("input", () => { LEV_J.cantidad = Math.max(1, parseInt(cantidadEl.value, 10) || 1); });
  cont.querySelectorAll("[data-levj-cant]").forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = parseInt(btn.dataset.levjCant, 10);
      LEV_J.cantidad = Math.max(1, (LEV_J.cantidad || 1) + delta);
      renderLevantamiento();
    });
  });
  const btnGuardar = cont.querySelector("#levj-btn-guardar");
  if (btnGuardar) btnGuardar.addEventListener("click", guardarItemLevJ);
  const btnCancelar = cont.querySelector("#levj-btn-cancelar");
  if (btnCancelar) btnCancelar.addEventListener("click", () => { limpiarFormularioLevJ(true); renderLevantamiento(); });
}

function abrirLevantamiento() {
  LEV_MODE = "penetrantes";
  document.body.classList.add("modo-levantamiento");
  const t = document.querySelector(".lev-fullscreen-title");
  if (t) t.textContent = "Levantamiento Penetrantes";
  renderLevantamiento();
}

function abrirLevantamientoJuntas() {
  LEV_MODE = "juntas";
  document.body.classList.add("modo-levantamiento");
  const t = document.querySelector(".lev-fullscreen-title");
  if (t) t.textContent = "Levantamiento Juntas";
  renderLevantamiento();
}

function cerrarLevantamiento() {
  document.body.classList.remove("modo-levantamiento");
  if (ACTIVE_TAB === "levantamiento-tab") renderLevantamientoTab();
  else renderTable();
}

function agruparPorZona() {
  const grupos = [];
  const idxPorClave = new Map();
  ROWS.filter(tieneDatosMinimos).forEach(r => {
    const zonaRaw = r.A || "(sin zona)";
    const nivel = r.B || "";
    const key = zonaRaw + "‖" + nivel;
    if (!idxPorClave.has(key)) {
      const label = nivel ? `${zonaRaw} — Nivel ${nivel}` : zonaRaw;
      idxPorClave.set(key, grupos.length);
      grupos.push({ zona: label, zonaRaw, nivel, items: [] });
    }
    grupos[idxPorClave.get(key)].items.push(r);
  });
  return grupos;
}

function describirItemLevantamiento(r) {
  const dim = r.D !== "" ? " " + formatFraccionPulgadas(r.D) : "";
  const esRedondoLibre = levUsaDiametroLibre(r.L) && r.F !== "";
  const dimAB = esRedondoLibre ? ` ⌀${formatFraccionPulgadas(n(r.F) / 2.54)}` : (r.F !== "" ? " " + r.F + "×" + r.G + (r.H !== "" ? "×" + r.H : "") + "cm" : "");
  const aisl = (r.E && n(r.E) > 0) ? ` · aislamiento ${formatFraccionPulgadas(r.E)}` : "";
  const mem = r.MEM ? " · membrana" : "";
  return `${r.C}x ${escapeHtml(TIPO_LABEL_CORTO[r.L] || r.L)}${dim}${dimAB}${aisl} · anular ${formatFraccionPulgadas(r.I)} · ${escapeHtml(r.M)} ${escapeHtml(r.N)}${mem}`;
}

function renderListaAgrupadaHTML(grupos) {
  if (grupos.length === 0) return `<div class="hint" style="margin:0;">Todavía no agregaste nada.</div>`;
  return grupos.map(g => `
    <div class="lev-zona-group">
      <div class="lev-zona-title">${escapeHtml(g.zona)} <span class="lev-hint-sticky">(${g.items.length})</span></div>
      <div class="lev-recent-list">
        ${g.items.map(r => `
        <div class="lev-recent-item">
          <div class="lev-recent-main">
            <span>${describirItemLevantamiento(r)}</span>
            ${r.R ? `<span class="lev-recent-nota">${escapeHtml(r.R)}</span>` : ""}
          </div>
          <span class="lev-recent-actions">
            <span class="qty-stepper">
              <button type="button" data-lev-qty-btn="${r._id}" data-delta="-1" aria-label="Restar 1">−</button>
              <span class="qty-val">${r.C}</span>
              <button type="button" data-lev-qty-btn="${r._id}" data-delta="1" aria-label="Sumar 1">+</button>
            </span>
            <button type="button" data-lev-edit-btn="${r._id}" aria-label="Editar"><svg class="icon"><use href="#i-edit"/></svg></button>
            <button type="button" data-lev-del-btn="${r._id}" aria-label="Eliminar"><svg class="icon"><use href="#i-close"/></svg></button>
          </span>
        </div>`).join("")}
      </div>
    </div>`).join("");
}

function renderLevantamiento() {
  const cont = document.getElementById("levantamiento-content");
  if (!cont) return;
  if (LEV_MODE === "juntas") { renderLevantamientoJuntas(cont); return; }

  const tipoVisible = LEV.tipo && levUsaDimAB(LEV.tipo) && !levUsaDiametroLibre(LEV.tipo) && !(levPermiteVacioRedondo(LEV.tipo) && LEV.vacioModo === "diametro");
  const grupos = agruparPorZona();

  cont.innerHTML = `
    <div class="lev-wrap">
      <div class="lev-sticky-bar">
        <div class="lev-field">
          <label>Zona / Descripción</label>
          <input type="text" id="lev-zona" placeholder="Ej. Cuarto eléctrico" value="${escapeHtml(LEV.zona)}">
        </div>
        <div class="lev-field lev-field-small">
          <label>Nivel</label>
          <input type="text" id="lev-nivel" placeholder="Opcional" value="${escapeHtml(LEV.nivel)}">
        </div>
      </div>

      ${LEV.editandoId ? `<div class="lev-editing-banner"><svg class="icon"><use href="#i-edit"/></svg>Editando un elemento de la lista — al tocar "Añadir" se guardan los cambios. <button type="button" id="lev-cancelar-edicion">Cancelar</button></div>` : ""}

      <div class="lev-section">
        <label>Penetrante</label>
        <div class="lev-chip-grid">
          ${TIPOS_LEVANTAMIENTO.map(t => levChip("tipo", t, TIPO_LABEL_CORTO[t] || t, LEV.tipo === t)).join("")}
        </div>
      </div>

      ${LEV.tipo ? `
      <div class="lev-section">
        <label>Dimensión</label>
        ${levPermiteVacioRedondo(LEV.tipo) ? `
        <div class="lev-toggle-group" style="margin-bottom:8px;">
          <button type="button" class="lev-chip ${LEV.vacioModo === "dim" ? "lev-chip-active" : ""}" data-lev-grupo="vacioModo" data-lev-valor="dim">Rectangular A×B</button>
          <button type="button" class="lev-chip ${LEV.vacioModo === "diametro" ? "lev-chip-active" : ""}" data-lev-grupo="vacioModo" data-lev-valor="diametro">Redondo (diámetro)</button>
        </div>` : ""}
        ${levUsaDiametroLibre(LEV.tipo) ? `
        <input type="text" inputmode="decimal" id="lev-diametro-libre" placeholder='Diámetro en pulgadas (ej. 24 o 1/2)' class="lev-input-otro" style="margin-top:0;" value="${LEV.diametroLibre}" >
        ` : tipoVisible ? `
        ${LEV.tipo === "Caja Electromecánica UL" ? `
        <div class="lev-toggle-group" style="margin-bottom:8px; flex-wrap:wrap;">
          ${levChip("cajaPreset", "10x10x5", "10×10×5 cm", LEV.cajaPreset === "10x10x5")}
          ${levChip("cajaPreset", "10x5x5", "10×5×5 cm", LEV.cajaPreset === "10x5x5")}
          ${levChip("cajaPreset", "custom", "Personalizado", LEV.cajaPreset === "custom")}
        </div>` : ""}
        ${(LEV.tipo !== "Caja Electromecánica UL" || LEV.cajaPreset === "custom") ? `
        <div class="lev-toggle-group" style="margin-bottom:8px; max-width:160px;">
          <button type="button" class="lev-chip ${LEV.dimUnidad === "cm" ? "lev-chip-active" : ""}" data-lev-grupo="dimUnidad" data-lev-valor="cm">cm</button>
          <button type="button" class="lev-chip ${LEV.dimUnidad === "in" ? "lev-chip-active" : ""}" data-lev-grupo="dimUnidad" data-lev-valor="in">in</button>
        </div>
        <div class="lev-dim-row">
          <input type="number" inputmode="decimal" step="0.1" id="lev-dimA" placeholder="A (${LEV.dimUnidad})" value="${LEV.dimA}">
          <span class="lev-x">×</span>
          <input type="number" inputmode="decimal" step="0.1" id="lev-dimB" placeholder="B (${LEV.dimUnidad})" value="${LEV.dimB}">
          ${LEV.tipo === "Caja Electromecánica UL" ? `<span class="lev-x">×</span><input type="number" inputmode="decimal" step="0.1" id="lev-profCaja" placeholder="Prof. (${LEV.dimUnidad})" value="${LEV.profCaja}">` : ""}
        </div>` : `
        <p class="hint" style="margin:0;">Dimensión: ${LEV.dimA} × ${LEV.dimB} × ${LEV.profCaja} ${LEV.dimUnidad}</p>`}
        ` : `
        <div class="lev-chip-grid">
          ${levDiametrosParaTipo(LEV.tipo).map(d => levChip("diametro", d.v, d.label, LEV.diametro === d.v)).join("")}
          ${levChip("diametro", "otro", "Otro", LEV.diametro === "otro")}
        </div>
        ${LEV.diametro === "otro" ? `<input type="text" inputmode="decimal" id="lev-diametro-otro" placeholder="Diámetro en pulgadas (ej. 1/2)" class="lev-input-otro" value="${LEV.diametroOtroValor || ""}" >` : ""}`}
      </div>` : ""}

      ${LEV.tipo === "Caja Electromecánica UL" ? `
      <div class="lev-section">
        <label>Tamaño de Putty Pad</label>
        <div class="lev-toggle-group">
          ${levChip("puttySize", "7", '7" x 7"', LEV.puttySize === 7)}
          ${levChip("puttySize", "9", '9" x 9"', LEV.puttySize === 9)}
        </div>
      </div>
      <div class="lev-section">
        <label>Instalación</label>
        <div class="lev-toggle-group">
          ${levChip("puttyInst", "Fuera", "Por fuera", LEV.puttyInst === "Fuera")}
          ${(() => {
            const area = levAreaCajaActualCm2();
            const cajaGrande = area !== null && area > UMBRAL_CAJA_PUTTY_CM2;
            return cajaGrande
              ? `<button type="button" class="lev-chip lev-chip-disabled" disabled title="No disponible: la caja supera el umbral">Por dentro</button>`
              : levChip("puttyInst", "Dentro", "Por dentro", LEV.puttyInst === "Dentro");
          })()}
        </div>
        <div class="hint" style="margin-top:6px;">
          ${(() => {
            const area = levAreaCajaActualCm2();
            if (area === null) return "Completá la Dimensión para saber si aplica \"Por dentro\" (caja ≤ 4-11/16\" x 4-11/16\" x 2-1/2\").";
            return area > UMBRAL_CAJA_PUTTY_CM2
              ? "Esta caja supera el umbral — solo se puede instalar por fuera."
              : "Esta caja está dentro del umbral — podés elegir por fuera o por dentro.";
          })()}
        </div>
      </div>` : ""}

      ${levUsaSelectorMultiple(LEV.tipo) ? `
      <div class="lev-section">
        <label>Material Hilti</label>
        <div class="lev-toggle-group">
          ${levChip("materialMultiple", "Pasta FS ONE MAX", "Pasta FS ONE MAX", LEV.materialMultiple === "Pasta FS ONE MAX")}
          ${levChip("materialMultiple", "Almohadilla CFS-BL", "Almohadilla CFS-BL", LEV.materialMultiple === "Almohadilla CFS-BL")}
          ${levChip("materialMultiple", "Espuma CP 620", "Espuma CP 620", LEV.materialMultiple === "Espuma CP 620")}
        </div>
      </div>` : ""}

      ${LEV.tipo && levEsAislado(LEV.tipo) ? `
      <div class="lev-section">
        <label>Espesor de aislamiento <span class="lev-hint-sticky">· opcional</span></label>
        <div class="lev-chip-grid">
          ${ESPESOR_AISLAMIENTO_COMUNES.map(a => levChip("espesor", a.v, a.label, !LEV.espesorAislamientoOtro && LEV.espesorAislamiento === a.v)).join("")}
          ${levChip("espesor", "otro", "Otro", LEV.espesorAislamientoOtro)}
        </div>
        ${LEV.espesorAislamientoOtro ? `<input type="text" id="lev-espesor-otro" placeholder='Ej. 3/4 o 0.75' class="lev-input-otro" value="${LEV.espesorAislamientoOtroTexto || ""}">` : ""}
      </div>` : ""}

      ${LEV.tipo && levUsaOcupacion(LEV.tipo) ? `
      <div class="lev-section">
        <label>% Ocupación <span class="lev-hint-sticky">· opcional</span></label>
        <input type="number" inputmode="numeric" id="lev-ocupacion" min="0" max="100" step="1" placeholder="Ej. 40" class="lev-input-otro" style="margin-top:0;" value="${LEV.ocupacion}">
      </div>` : ""}

      ${!levOcultaAnular(LEV.tipo) ? `
      <div class="lev-section">
        <label>Anular <span class="lev-hint-sticky">· se recuerda</span></label>
        <div class="lev-chip-grid">
          ${ANULAR_COMUNES.map(a => levChip("anular", a.v, a.label, !LEV.anularOtro && LEV.anular === a.v)).join("")}
          ${levChip("anular", "otro", "Otro", LEV.anularOtro)}
        </div>
        ${LEV.anularOtro ? `<input type="text" id="lev-anular-otro" placeholder='Ej. 5/8 o 0.625' class="lev-input-otro" value="${LEV.anularOtroTexto || ""}">` : ""}
      </div>` : ""}

      <div class="lev-section">
        <label>Barrera <span class="lev-hint-sticky">· se recuerda</span></label>
        <div class="lev-toggle-group">
          ${levChip("barrera", "Pared", "Pared", LEV.barrera === "Pared", LEV.tipo === "Caja Electromecánica UL")}
          ${levChip("barrera", "Entrepiso", "Entrepiso", LEV.barrera === "Entrepiso", LEV.tipo === "Caja Electromecánica UL")}
        </div>
        <div class="lev-toggle-group" style="margin-top:6px;">
          ${levChip("material", "Concreto", "Concreto", LEV.material === "Concreto", LEV.tipo === "Caja Electromecánica UL")}
          ${levChip("material", "Panel de Yeso", "Panel de yeso", LEV.material === "Panel de Yeso", LEV.barrera === "Entrepiso")}
        </div>
        ${LEV.tipo === "Caja Electromecánica UL" ? `<p class="hint" style="margin:6px 0 0;">Las cajas electromecánicas UL solo se instalan en pared de panel de yeso.</p>` : ""}
        ${LEV.barrera === "Pared" ? `
        <label class="lev-checkbox-row ${LEV.tipo === "Caja Electromecánica UL" ? "lev-checkbox-locked" : ""}">
          <input type="checkbox" id="lev-membrana" ${LEV.membrana ? "checked" : ""} ${LEV.tipo === "Caja Electromecánica UL" ? "disabled" : ""}>
          Membrana <span class="lev-hint-sticky">${LEV.tipo === "Caja Electromecánica UL" ? "— siempre activa en cajas electromecánicas UL" : "— sella solo un lado de la pared"}</span>
        </label>` : ""}
      </div>

      <div class="lev-section">
        <label>F Rating <span class="lev-hint-sticky">· se recuerda</span></label>
        <div class="lev-toggle-group">
          ${levChip("frating", "1 Hora", "1 Hora", LEV.fRating === "1 Hora")}
          ${levChip("frating", "2 Horas", "2 Horas", LEV.fRating === "2 Horas")}
        </div>
      </div>

      <div class="lev-section">
        <label>Cantidad</label>
        <div class="lev-stepper lev-stepper-full">
          <div class="qty-btn-group">
            <button type="button" data-lev-cant-delta="-10">−10</button>
            <button type="button" data-lev-cant-delta="-5">−5</button>
            <button type="button" data-lev-cant-delta="-1">−1</button>
          </div>
          <input type="number" inputmode="numeric" id="lev-cantidad" value="${LEV.cantidad}" min="1" step="1">
          <div class="qty-btn-group">
            <button type="button" data-lev-cant-delta="1">+1</button>
            <button type="button" data-lev-cant-delta="5">+5</button>
            <button type="button" data-lev-cant-delta="10">+10</button>
          </div>
        </div>
      </div>

      <div class="lev-section">
        <label>Nota <span class="lev-hint-sticky">· opcional, solo para esta línea</span></label>
        <textarea id="lev-nota" placeholder="Ej. Tubería visible pero no se pudo medir espacio anular exacto" rows="2" class="lev-textarea">${escapeHtml(LEV.nota)}</textarea>
      </div>

      <button type="button" class="primary lev-add-btn" id="lev-btn-agregar" ${LEV.tipo ? "" : "disabled"}>${LEV.editandoId ? "Guardar cambios" : "Añadir"}</button>

      <div class="lev-section">
        <label>Lista del levantamiento (${grupos.reduce((n, g) => n + g.items.length, 0)})</label>
        ${renderListaAgrupadaHTML(grupos)}
      </div>
    </div>
  `;

  attachLevantamientoEvents();
}

function attachLevantamientoEvents() {
  const cont = document.getElementById("levantamiento-content");
  if (!cont) return;

  const zonaEl = document.getElementById("lev-zona");
  if (zonaEl) zonaEl.addEventListener("input", () => { LEV.zona = zonaEl.value; });
  const nivelEl = document.getElementById("lev-nivel");
  if (nivelEl) nivelEl.addEventListener("input", () => { LEV.nivel = nivelEl.value; });

  const dimA = document.getElementById("lev-dimA");
  if (dimA) dimA.addEventListener("input", () => { LEV.dimA = dimA.value; });
  const dimB = document.getElementById("lev-dimB");
  if (dimB) dimB.addEventListener("input", () => { LEV.dimB = dimB.value; });
  const profCaja = document.getElementById("lev-profCaja");
  if (profCaja) profCaja.addEventListener("input", () => { LEV.profCaja = profCaja.value; });
  const diametroLibre = document.getElementById("lev-diametro-libre");
  if (diametroLibre) diametroLibre.addEventListener("input", () => { LEV.diametroLibre = diametroLibre.value; });

  const diamOtro = document.getElementById("lev-diametro-otro");
  if (diamOtro) diamOtro.addEventListener("input", () => { LEV.diametroOtroValor = diamOtro.value; });

  const espesorOtro = document.getElementById("lev-espesor-otro");
  if (espesorOtro) espesorOtro.addEventListener("input", () => { LEV.espesorAislamientoOtroTexto = espesorOtro.value; });

  const ocupacionEl = document.getElementById("lev-ocupacion");
  if (ocupacionEl) ocupacionEl.addEventListener("input", () => { LEV.ocupacion = ocupacionEl.value; });

  const anularOtro = document.getElementById("lev-anular-otro");
  if (anularOtro) anularOtro.addEventListener("input", () => { LEV.anularOtroTexto = anularOtro.value; });

  const membranaEl = document.getElementById("lev-membrana");
  if (membranaEl) membranaEl.addEventListener("change", () => { LEV.membrana = membranaEl.checked; });

  const notaEl = document.getElementById("lev-nota");
  if (notaEl) notaEl.addEventListener("input", () => { LEV.nota = notaEl.value; });

  const cantInput = document.getElementById("lev-cantidad");
  if (cantInput) cantInput.addEventListener("input", () => {
    const v = parseInt(cantInput.value, 10);
    LEV.cantidad = isNaN(v) || v < 1 ? 1 : v;
  });
  cont.querySelectorAll("[data-lev-cant-delta]").forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = parseInt(btn.dataset.levCantDelta, 10);
      LEV.cantidad = Math.max(1, (LEV.cantidad || 1) + delta);
      renderLevantamiento();
    });
  });

  cont.querySelectorAll("[data-lev-grupo]").forEach(btn => {
    btn.addEventListener("click", () => {
      const grupo = btn.dataset.levGrupo;
      let valor = btn.dataset.levValor;
      if (grupo === "tipo") {
        LEV.tipo = valor;
        LEV.diametro = ""; LEV.dimA = ""; LEV.dimB = ""; LEV.profCaja = ""; LEV.vacioModo = "dim"; LEV.diametroLibre = "";
        LEV.espesorAislamiento = ""; LEV.espesorAislamientoOtro = false; LEV.ocupacion = ""; LEV.materialMultiple = "Pasta FS ONE MAX";
        // Espacio anular preseleccionado: 0" en Bandeja de Cables (típicamente no
        // hay espacio anular real en ese tipo de instalación), 1/2" en el resto.
        LEV.anularOtro = false;
        LEV.anular = valor === "Bandeja de Cables" ? 0 : 0.5;
        if (valor === "Caja Electromecánica UL") {
          // Las cajas electromecánicas UL solo se instalan en pared de panel de yeso,
          // y son siempre una penetración de membrana (se sella por un solo lado).
          LEV.barrera = "Pared"; LEV.material = "Panel de Yeso"; LEV.membrana = true;
          aplicarPresetCaja("10x10x5");
        }
      } else if (grupo === "vacioModo") {
        LEV.vacioModo = valor;
        LEV.diametro = ""; LEV.dimA = ""; LEV.dimB = "";
      } else if (grupo === "dimUnidad") {
        if (valor !== LEV.dimUnidad) {
          const factor = valor === "in" ? (1 / 2.54) : 2.54; // convirtiendo desde la unidad anterior
          const conv = (v) => (v === "" || v === null || isNaN(parseFloat(v))) ? v : Math.round(parseFloat(v) * factor * 100) / 100;
          LEV.dimA = conv(LEV.dimA); LEV.dimB = conv(LEV.dimB); LEV.profCaja = conv(LEV.profCaja);
          LEV.dimUnidad = valor;
        }
      } else if (grupo === "diametro") {
        LEV.diametro = valor === "otro" ? "otro" : parseFloat(valor);
      } else if (grupo === "espesor") {
        if (valor === "otro") { LEV.espesorAislamientoOtro = true; }
        else { LEV.espesorAislamientoOtro = false; LEV.espesorAislamiento = parseFloat(valor); }
      } else if (grupo === "anular") {
        if (valor === "otro") { LEV.anularOtro = true; }
        else { LEV.anularOtro = false; LEV.anular = parseFloat(valor); }
      } else if (grupo === "barrera") {
        LEV.barrera = valor;
        if (valor === "Entrepiso") { LEV.material = "Concreto"; LEV.membrana = false; } // no existe Entrepiso + Panel de Yeso
      } else if (grupo === "material") {
        LEV.material = valor;
      } else if (grupo === "frating") {
        LEV.fRating = valor;
      } else if (grupo === "puttySize") {
        LEV.puttySize = parseInt(valor, 10);
      } else if (grupo === "puttyInst") {
        LEV.puttyInst = valor;
      } else if (grupo === "materialMultiple") {
        LEV.materialMultiple = valor;
      } else if (grupo === "cajaPreset") {
        aplicarPresetCaja(valor);
      }
      renderLevantamiento();
    });
  });

  const btnAgregar = document.getElementById("lev-btn-agregar");
  if (btnAgregar) btnAgregar.addEventListener("click", agregarDesdeLevantamiento);

  const btnCancelarEdicion = document.getElementById("lev-cancelar-edicion");
  if (btnCancelarEdicion) btnCancelarEdicion.addEventListener("click", () => {
    if (LEV._filaRespaldo) { ROWS.push(LEV._filaRespaldo); LEV._filaRespaldo = null; marcarCambio(); }
    LEV.editandoId = null; LEV.tipo = null; LEV.diametro = ""; LEV.dimA = ""; LEV.dimB = ""; LEV.cantidad = 1;
    renderLevantamiento();
  });

  cont.querySelectorAll("[data-lev-del-btn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.levDelBtn);
      const idx = ROWS.findIndex(r => r._id === id);
      if (idx !== -1) { pushUndo(); ROWS.splice(idx, 1); renderLevantamiento(); marcarCambio(); }
    });
  });

  cont.querySelectorAll("[data-lev-qty-btn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.levQtyBtn);
      const delta = parseInt(btn.dataset.delta, 10);
      const row = ROWS.find(r => r._id === id);
      if (row) {
        pushUndo();
        row.C = Math.max(1, n(row.C) + delta);
        renderLevantamiento();
        marcarCambio();
      }
    });
  });

  cont.querySelectorAll("[data-lev-edit-btn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.levEditBtn);
      editarItemLevantamiento(id);
    });
  });
}

function editarItemLevantamiento(id, abrirFullscreen) {
  const idx = ROWS.findIndex(r => r._id === id);
  if (idx === -1) return;
  const row = ROWS[idx];
  const usaDim = levUsaDimAB(row.L);

  LEV.zona = row.A || ""; LEV.nivel = row.B || "";
  LEV.tipo = row.L;
  LEV.vacioModo = "dim";
  LEV.dimUnidad = "cm";
  if (levUsaDiametroLibre(row.L)) {
    LEV.diametroLibre = row.F !== "" ? String(Math.round((n(row.F) / 2.54) * 100) / 100) : "";
    LEV.dimA = ""; LEV.dimB = ""; LEV.diametro = "";
  } else if (usaDim) { LEV.dimA = row.F; LEV.dimB = row.G; LEV.diametro = ""; }
  else {
    const esComun = levDiametrosParaTipo(row.L).some(d => d.v === row.D);
    LEV.diametro = esComun ? row.D : "otro";
    LEV.diametroOtroValor = esComun ? "" : row.D;
  }
  LEV.profCaja = row.L === "Caja Electromecánica UL" ? row.H : "";
  if (row.L === "Caja Electromecánica UL") {
    const match = Object.entries(CAJA_PRESETS).find(([, [a, b, h]]) => a === n(row.F) && b === n(row.G) && h === n(row.H));
    LEV.cajaPreset = match ? match[0] : "custom";
  }
  if (levEsAislado(row.L)) {
    const espComun = ESPESOR_AISLAMIENTO_COMUNES.some(a => a.v === row.E);
    LEV.espesorAislamientoOtro = !espComun;
    LEV.espesorAislamiento = espComun ? row.E : "";
    LEV.espesorAislamientoOtroTexto = espComun ? "" : String(row.E);
  } else {
    LEV.espesorAislamiento = ""; LEV.espesorAislamientoOtro = false;
  }
  LEV.ocupacion = levUsaOcupacion(row.L) && row.J ? String(Math.round(n(row.J) * 100)) : "";
  const anularComun = ANULAR_COMUNES.some(a => a.v === row.I);
  LEV.anularOtro = !anularComun;
  LEV.anular = anularComun ? row.I : LEV.anular;
  LEV.anularOtroTexto = anularComun ? "" : String(row.I);
  LEV.barrera = row.M; LEV.material = row.N; LEV.fRating = row.O; LEV.membrana = !!row.MEM;
  LEV.cantidad = row.C;
  LEV.puttySize = row.PPSIZE || 7;
  LEV.puttyInst = row.PPINST || "Fuera";
  LEV.materialMultiple = levUsaSelectorMultiple(row.L) && ["Pasta FS ONE MAX", "Almohadilla CFS-BL", "Espuma CP 620"].includes(row.P) ? row.P : "Pasta FS ONE MAX";
  LEV.nota = row.R || "";
  LEV.editandoId = id;

  LEV._filaRespaldo = Object.assign({}, row); // por si se cancela la edición, se restaura
  ROWS.splice(idx, 1); // se vuelve a agregar al guardar

  if (abrirFullscreen) {
    abrirLevantamiento();
  } else {
    renderLevantamiento();
    const cont = document.getElementById("levantamiento-content");
    if (cont) cont.scrollTop = 0;
    const wrapper = document.getElementById("levantamiento-fullscreen");
    if (wrapper) wrapper.scrollTop = 0;
  }
}

function agregarDesdeLevantamiento() {
  if (!LEV.tipo) return;
  const diametroLibreActivo = levUsaDiametroLibre(LEV.tipo);
  const modoRedondo = levPermiteVacioRedondo(LEV.tipo) && LEV.vacioModo === "diametro";
  const usaDim = levUsaDimAB(LEV.tipo) && !modoRedondo && !diametroLibreActivo;

  let anularVal = 0;
  if (!levOcultaAnular(LEV.tipo)) {
    anularVal = LEV.anular;
    if (LEV.anularOtro) {
      const parsed = parseFraccion(LEV.anularOtroTexto || "");
      if (parsed === null) { mostrarToast("Ingresá un espacio anular válido (ej. 0.5 o 5/8).", "error"); return; }
      anularVal = parsed;
      LEV.anular = parsed; // queda recordado también para el próximo
    }
  }

  let diametroVal = "";
  if (diametroLibreActivo) {
    diametroVal = parseFraccion(String(LEV.diametroLibre || ""));
    if (diametroVal === null || diametroVal <= 0) { mostrarToast("Ingresá el diámetro del ducto en pulgadas.", "error"); return; }
  } else if (!usaDim) {
    // Nota: antes esta rama excluía modoRedondo (Vacío redondo), así que ese
    // caso nunca leía el diámetro elegido y quedaba en 0 — corregido 05/08/2026.
    if (LEV.diametro === "otro") {
      diametroVal = parseFraccion(String(document.getElementById("lev-diametro-otro")?.value || ""));
      if (diametroVal === null) { mostrarToast("Ingresá un diámetro válido.", "error"); return; }
    } else if (LEV.diametro !== "") {
      diametroVal = LEV.diametro;
    } else {
      mostrarToast("Elegí un diámetro para este penetrante.", "error");
      return;
    }
  }
  let dimA = "", dimB = "";
  if (usaDim) {
    dimA = parseFloat(LEV.dimA); dimB = parseFloat(LEV.dimB);
    if (isNaN(dimA) || isNaN(dimB) || dimA <= 0 || dimB <= 0) {
      mostrarToast("Ingresá la Dimensión A y B para este penetrante.", "error");
      return;
    }
    if (LEV.dimUnidad === "in") { dimA *= 2.54; dimB *= 2.54; }
  } else if (diametroLibreActivo) {
    // Ducto redondo: se trata como una abertura cuadrada equivalente al diámetro (aproximación conservadora)
    const diamCm = n(diametroVal) * 2.54;
    dimA = diamCm; dimB = diamCm;
  }
  // Vacío redondo (modoRedondo) YA NO se aproxima a un cuadrado — se guarda el
  // diámetro real en D y F/G quedan en blanco, para que computeRow calcule el
  // área real del círculo (π/4×DIÁM.², según Word 05/08/2026). Antes también
  // tenía el bug de que diametroVal nunca se leía para este caso (quedaba 0).

  let profCajaVal = "";
  let ppInstFinal = LEV.puttyInst;
  if (LEV.tipo === "Caja Electromecánica UL") {
    profCajaVal = parseFloat(LEV.profCaja);
    if (isNaN(profCajaVal) || profCajaVal <= 0) {
      mostrarToast("Ingresá la Profundidad de la caja.", "error");
      return;
    }
    if (LEV.dimUnidad === "in") profCajaVal *= 2.54;
    const areaCajaCm2 = dimA * dimB + 2 * dimA * profCajaVal + 2 * dimB * profCajaVal;
    if (areaCajaCm2 > UMBRAL_CAJA_PUTTY_CM2) ppInstFinal = "Fuera"; // sobre el umbral solo aplica por fuera
  }

  let espesorVal = 0;
  if (levEsAislado(LEV.tipo)) {
    if (LEV.espesorAislamientoOtro) {
      const parsedEsp = parseFraccion(LEV.espesorAislamientoOtroTexto || "");
      if (parsedEsp === null) { mostrarToast("Ingresá un espesor de aislamiento válido (ej. 1 o 3/4), o dejalo sin marcar si no aplica.", "error"); return; }
      espesorVal = parsedEsp;
    } else if (LEV.espesorAislamiento !== "") {
      espesorVal = LEV.espesorAislamiento;
    }
    // si no se eligió nada, queda en 0 (opcional)
  }

  let ocupacionVal = 0;
  if (levUsaOcupacion(LEV.tipo) && LEV.ocupacion !== "") {
    const pct = parseFloat(LEV.ocupacion);
    if (isNaN(pct) || pct < 0 || pct > 100) { mostrarToast("El % de ocupación debe estar entre 0 y 100.", "error"); return; }
    ocupacionVal = pct / 100;
  }

  const nueva = Object.assign(nuevaFila(), {
    A: LEV.zona, B: LEV.nivel, C: LEV.cantidad,
    D: (usaDim || diametroLibreActivo) ? "" : diametroVal, E: espesorVal,
    F: (usaDim || diametroLibreActivo) ? dimA : "", G: (usaDim || diametroLibreActivo) ? dimB : "", H: profCajaVal,
    I: anularVal, J: ocupacionVal,
    L: LEV.tipo, M: LEV.barrera, N: LEV.material, O: LEV.fRating, MEM: LEV.barrera === "Pared" && LEV.membrana, R: LEV.nota,
    PPSIZE: LEV.tipo === "Caja Electromecánica UL" ? LEV.puttySize : 7,
    PPINST: LEV.tipo === "Caja Electromecánica UL" ? ppInstFinal : "Fuera",
    P: levUsaSelectorMultiple(LEV.tipo) ? LEV.materialMultiple : materialRecomendado(LEV.tipo, usaDim ? null : diametroVal),
  });
  // Si la Calculadora todavía tiene solo las filas de ejemplo vacías, se limpian
  // al agregar el primer penetrante real desde Levantamiento.
  if (ROWS.length > 0 && ROWS.every(r => !tieneDatosMinimos(r))) {
    ROWS = [];
  }

  ROWS.unshift(nueva);
  LEV._filaRespaldo = null; // ya se guardó, no hace falta restaurar nada

  const fueEdicion = !!LEV.editandoId;
  // Reset solo lo que suele cambiar penetrante a penetrante; el resto queda pegado
  // El tipo de penetrante se mantiene seleccionado para agilizar el ingreso
  // de múltiples penetrantes del mismo tipo; solo se limpian los valores variables.
  LEV.diametro = ""; LEV.dimA = ""; LEV.dimB = ""; LEV.profCaja = ""; LEV.vacioModo = "dim"; LEV.diametroLibre = "";
  LEV.espesorAislamiento = ""; LEV.espesorAislamientoOtro = false; LEV.ocupacion = ""; LEV.cantidad = 1; LEV.editandoId = null; LEV.nota = "";

  marcarCambio();
  renderLevantamiento();
  // Scroll al inicio — el levantamiento corre en el div fullscreen
  const levFs = document.getElementById("levantamiento-fullscreen");
  if (levFs) levFs.scrollTop = 0;
  const levContent = document.getElementById("levantamiento-content");
  if (levContent) levContent.scrollTop = 0;
  mostrarToast(fueEdicion ? "Cambios guardados." : `Agregado: ${nueva.C}x ${nueva.L}`);
}

// Productos válidos en MAIN_TABLE para cada tipo de penetrante
// (pre-calculado para no iterar la tabla en cada render de fila)
const PRODUCTOS_POR_TIPO = {
  "Tubería Metal": ["Pasta FS ONE MAX","Sellador CP 606","Sellador CFS SIL GG"],
  "Tubería Metal Aislado": ["Pasta FS ONE MAX","Sellador CP 606","Sellador CFS SIL GG"],
  "Tubería Cobre Aislado HVAC": ["Cinta con Collar Metálico CP 648-E/ER","Cinta sin Collar Metálico CP 648-E","Collarín CP 643N/644"],
  "Tubería EMT": ["Pasta FS ONE MAX","Sellador CP 606","Sellador CFS SIL GG"],
  "Tubería Combustible (PVC, CPVC, PEX, PP-R)": ["Pasta FS ONE MAX","Cinta con Collar Metálico CP 648-E/ER","Cinta sin Collar Metálico CP 648-E","Collarín CP 643N/644","Sellador CP 606","Sellador CFS SIL GG"],
  "Tubería Combustible Aislada (PVC, CPVC, PEX, PP-R)": ["Pasta FS ONE MAX","Cinta con Collar Metálico CP 648-E/ER","Cinta sin Collar Metálico CP 648-E","Collarín CP 643N/644","Sellador CP 606","Sellador CFS SIL GG"],
  "Bandeja de Cables": ["Pasta FS ONE MAX","Espuma CP 620","Almohadilla CFS-BL","Sellador CFS SIL GG"],
  "Cable Armado": ["Pasta FS ONE MAX"],
  "Cables en Paso Repenetrable": ['Manga CP 653 4"','Paso de cables MSL M 3"x4"','Paso de cables MSL L 6"x4"'],
  "Cables Sueltos": ["Pasta FS ONE MAX","Sellador CP 606","Sellador CFS SIL GG"],
  "Caja Electromecánica UL": ["Putty Pad CP 617"],
  "Ducto Rectangular": ["Pasta FS ONE MAX","Sellador CP 606","Sellador CFS SIL GG"],
  "Ducto Rectangular Aislado": ["Pasta FS ONE MAX","Sellador CP 606","Sellador CFS SIL GG"],
  "Ducto Redondo": ["Pasta FS ONE MAX","Sellador CP 606","Sellador CFS SIL GG"],
  "Ducto Redondo Aislado": ["Pasta FS ONE MAX","Sellador CP 606","Sellador CFS SIL GG"],
  "Pasante Múltiple": ["Pasta FS ONE MAX","Espuma CP 620","Almohadilla CFS-BL","Mortero CP 637","Sellador CP 606","Sellador CFS SIL GG"],
  "Vacío": ["Pasta FS ONE MAX","Espuma CP 620","Almohadilla CFS-BL","Mortero CP 637","Sellador CP 606","Sellador CFS SIL GG"],
  "Viga W": ["Pasta FS ONE MAX"],
  "Viga Canal": ["Pasta FS ONE MAX","Sellador CP 606"],
  "Viga Tubo Rectangular": ["Pasta FS ONE MAX"],
};

// Etiquetas cortas para el selector de producto
const PROD_LABEL = {
  "Pasta FS ONE MAX": "Pasta FS ONE MAX",
  "Cinta con Collar Metálico CP 648-E/ER": "Cinta + Collar",
  "Cinta sin Collar Metálico CP 648-E": "Cinta sin Collar",
  "Collarín CP 643N/644": "Collarín 643N/644",
  "Sellador CP 606": "Sellador CP 606",
  "Sellador CFS SIL GG": "Sellador SIL GG",
  "Espuma CP 620": "Espuma CP 620",
  "Almohadilla CFS-BL": "Almohadilla CFS-BL",
  "Mortero CP 637": "Mortero CP 637",
  'Manga CP 653 4"': 'Manga CP 653 4"',
  'Paso de cables MSL M 3"x4"': 'MSL M 3"x4"',
  'Paso de cables MSL L 6"x4"': 'MSL L 6"x4"',
  "Putty Pad CP 617": "Putty Pad CP 617",
};

function renderTablaAgrupadaHTML(grupos) {
  if (grupos.length === 0) return `<div class="hint" style="margin:16px 0 0;">Todavía no hay penetrantes registrados. Usá "Levantamiento" arriba.</div>`;

  const filas = [];
  grupos.forEach(g => {
    g.items.forEach((r, i) => filas.push({ r, esInicioZona: i === 0, zona: g.zona }));
  });

  return `
    <div class="table-scroll">
      <table class="resumen-table lev-tabla-resultados">
        <thead><tr>
          <th>Zona</th><th>Nivel</th><th class="num">Cant.</th><th>Penetrante</th><th>Dimensión</th><th>Anular</th><th>%</th>
          <th>Barrera</th><th>Producto</th>
          <th>Sistema UL</th>
          <th class="num">Espesor</th><th class="num">Vueltas</th><th colspan="2">Resultados</th>
          <th>F Rating</th><th>Nota</th><th></th>
        </tr></thead>
        <tbody>
          ${filas.map(({ r, esInicioZona, zona }) => {
            const c = computeRow(r, CONFIG);

            // — Dimensión con detalle de aislamiento —
            const esAisl = n(r.E) > 0;
            const esRedondoLibre = levUsaDiametroLibre(r.L) && r.F !== "";
            let dimBase, dimAisl = "";
            if (r.D !== "") {
              dimBase = formatFraccionPulgadas(r.D);
              if (esAisl) dimAisl = ` (+${formatFraccionPulgadas(r.E)} aisl)`;
            } else if (esRedondoLibre) {
              dimBase = `⌀${formatFraccionPulgadas(n(r.F)/2.54)}`;
            } else if (r.F !== "") {
              dimBase = `${r.F}×${r.G}${r.H !== "" ? "×"+r.H : ""} cm`;
              if (esAisl) dimAisl = ` (+${formatFraccionPulgadas(r.E)} aisl)`;
            } else { dimBase = "—"; }
            const dimHtml = dimBase + (dimAisl ? `<br><span class="lev-dim-aisl">${dimAisl.trim()}</span>` : "");

            // — % ocupación —
            const pctOcup = levUsaOcupacion(r.L) && r.J ? Math.round(n(r.J)*100)+"%" : "—";

            // — Caja electromecánica: dentro/fuera —
            const esCaja = r.L === "Caja Electromecánica UL";
            const tipoLabel = escapeHtml(TIPO_LABEL_CORTO[r.L] || r.L)
              + (esCaja ? `<br><span class="lev-sub-label">${r.PPINST === "Dentro" ? "Por dentro" : "Por fuera"}</span>` : "");

            // — Sistema UL —
            const ulBadge = (c.Qtext && c.Qtext !== "-" && !["Sin sistema","Cambiar material a Pasta FS ONE MAX","Cambiar material a pasta FS ONE MAX"].includes(c.Qtext))
              ? `<a href="${escapeHtml(c.Qlink||"")}" target="_blank" rel="noopener" class="badge badge-ok" title="${escapeHtml(c.Qtext)}">${escapeHtml(c.Qtext.split(" ")[0])}</a>`
              : "—";

            // — Resultados: usar el mismo formato que la columna detalle de la Calculadora —
            const esCinta = r.P === MAT_CINTA_CON || r.P === MAT_CINTA_SIN;
            const vueltas = esCinta ? vueltasCintaPenetrante(r) : null;
            const detalleRes = detalleCalculoTexto(c);

            // — Selector de producto —
            const opcs = PRODUCTOS_POR_TIPO[r.L] || [];
            const prodCell = opcs.length <= 1
              ? `<span>${escapeHtml(r.P) || "—"}</span>`
              : `<select class="cell-input lev-prod-select" data-lev-prod-id="${r._id}">
                  ${opcs.map(p => `<option value="${escapeHtml(p)}" ${p===r.P?"selected":""}>${escapeHtml(PROD_LABEL[p]||p)}</option>`).join("")}
                </select>`;

            return `<tr class="${esInicioZona ? "lev-tabla-nueva-zona" : ""}">
              <td>${esInicioZona ? `<strong>${escapeHtml(zona)}</strong>` : ""}</td>
              <td>${escapeHtml(r.B) || "—"}</td>
              <td class="num">${r.C}</td>
              <td>${tipoLabel}</td>
              <td>${dimHtml}</td>
              <td>${levOcultaAnular(r.L) ? "—" : formatFraccionPulgadas(r.I)}</td>
              <td class="num">${pctOcup}</td>
              <td>${escapeHtml(r.M)}<br><span class="lev-sub-label">${escapeHtml(r.N)}${r.MEM ? " · membrana" : ""}</span></td>
              <td>${prodCell}</td>
              <td>${ulBadge}</td>
              <td class="num">${c.V !== "-" && c.V !== undefined ? formatFraccionPulgadas(c.V) : "—"}</td>
              <td class="num">${vueltas !== null ? vueltas : "—"}</td>
              <td colspan="2" class="lev-col-resultado" style="font-size:var(--fs-xs)">${detalleRes}</td>
              <td>${escapeHtml(r.O)}</td>
              <td>${escapeHtml(r.R) || "—"}</td>
              <td class="row-actions">
                <button class="icon-btn" data-lev-edit-btn="${r._id}" aria-label="Editar"><svg class="icon"><use href="#i-edit"/></svg></button>
                <button class="icon-btn icon-danger" data-lev-del-btn="${r._id}" aria-label="Eliminar"><svg class="icon"><use href="#i-close"/></svg></button>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

function renderLevantamientoTab() {
  const statsBox = document.getElementById("lev-tab-stats");
  const listaBox = document.getElementById("lev-tab-lista");
  if (!statsBox || !listaBox) return;

  const grupos = agruparPorZona();
  const totalItems = grupos.reduce((n, g) => n + g.items.length, 0);
  const totalUnidades = grupos.reduce((acc, g) => acc + g.items.reduce((sum, r) => sum + n(r.C), 0), 0);

  statsBox.innerHTML = `
    <div class="lev-stat"><span class="lev-stat-num">${totalItems}</span><span class="lev-stat-label">Filas</span></div>
    <div class="lev-stat"><span class="lev-stat-num">${totalUnidades}</span><span class="lev-stat-label">Penetrantes</span></div>
    <div class="lev-stat"><span class="lev-stat-num">${grupos.length}</span><span class="lev-stat-label">Zonas</span></div>
  `;

  listaBox.innerHTML = totalItems === 0
    ? `<div class="hint" style="margin:16px 0 0;">Todavía no hay penetrantes registrados. Usá "Levantamiento" arriba, o cargá filas directo en la pestaña Calculadora.</div>`
    : renderTablaAgrupadaHTML(grupos);

  listaBox.querySelectorAll("[data-lev-del-btn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.levDelBtn);
      const idx = ROWS.findIndex(r => r._id === id);
      if (idx !== -1) { pushUndo(); ROWS.splice(idx, 1); renderLevantamientoTab(); marcarCambio(); }
    });
  });
  listaBox.querySelectorAll("[data-lev-edit-btn]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.levEditBtn);
      editarItemLevantamiento(id, true);
    });
  });

  // Selector de producto inline en la tabla del levantamiento
  listaBox.querySelectorAll(".lev-prod-select").forEach(sel => {
    sel.addEventListener("change", () => {
      const id = Number(sel.dataset.levProdId);
      const row = ROWS.find(r => r._id === id);
      if (row) {
        row.P = sel.value;
        marcarCambio();
        renderLevantamientoTab();
      }
    });
  });

  renderLevantamientoTabJuntas();
}

function juntaLabelCorta(r, superiorInferior) {
  let pos = superiorInferior ? r.posicionPI : r.posicion;
  if (!pos || pos === "-") return r.tipo;
  pos = pos.replace(/^Sistema /, "");
  return `${r.tipo} · ${pos}`;
}

// Unidades de lana (sin redondear, para ver el detalle exacto fila por fila;
// el redondeo hacia arriba para compra sucede solo en el Resumen).
function lanaUnidadesSinRedondear(f) {
  if (f.lanaVolumenCm3 > 0) return f.lanaVolumenCm3 / (122 * 61 * 10);
  if (f.lanaAreaCm2 > 0) return f.lanaAreaCm2 / (122 * 61);
  return 0;
}

function renderTablaJuntasHTML(grupos) {
  if (grupos.length === 0) return `<div class="hint" style="margin:16px 0 0;">Todavía no hay juntas registradas. Usá "Levantamiento Juntas" arriba.</div>`;

  const filas = [];
  grupos.forEach(g => {
    g.items.forEach((r, i) => filas.push({ r, esInicioZona: i === 0, zona: g.zona }));
  });

  return `
    <div class="table-scroll">
      <table class="resumen-table">
        <thead><tr>
          <th>Zona</th><th>Nivel</th><th class="num">Cant.</th><th>Junta</th><th>Barreras</th><th>Producto</th>
          <th class="num">Longitud (cm)</th><th class="num">Ancho (cm)</th><th class="num">Espesor</th><th class="num">Sellador (cm³)</th><th class="num">Lana (unid.)</th><th>Nota</th><th></th>
        </tr></thead>
        <tbody>
          ${filas.map(({ r, esInicioZona, zona }) => {
            const f = computeSingleJuntaRow(r);
            const lanaUnid = r.calcularLana ? lanaUnidadesSinRedondear(f) * r.cantidad : 0;
            return `<tr class="${esInicioZona ? "lev-tabla-nueva-zona" : ""}">
              <td>${esInicioZona ? `<strong>${escapeHtml(zona)}</strong>` : ""}</td>
              <td>${escapeHtml(r.B) || "—"}</td>
              <td class="num">${r.cantidad}</td>
              <td>${escapeHtml(juntaLabelCorta(r, f.superiorInferior))}</td>
              <td>${escapeHtml(barrerasLabelCorto(r.barreras))}</td>
              <td>${escapeHtml(r.producto)}</td>
              <td class="num">${r.longitud}</td>
              <td class="num">${r.ancho}</td>
              <td class="num">${f.espesorProductoIn !== null ? formatFraccionPulgadas(f.espesorProductoIn) : "—"}</td>
              <td class="num">${roundup(f.volumenSellador * r.cantidad, 0)}</td>
              <td class="num">${r.calcularLana ? (lanaUnid > 0 ? lanaUnid.toFixed(2) : "—") : "No"}</td>
              <td>${escapeHtml(r.nota) || "—"}</td>
              <td class="row-actions">
                <button class="icon-btn" data-levj-tab-edit="${r._id}" aria-label="Editar"><svg class="icon"><use href="#i-edit"/></svg></button>
                <button class="icon-btn icon-danger" data-levj-tab-del="${r._id}" aria-label="Eliminar"><svg class="icon"><use href="#i-close"/></svg></button>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

function renderLevantamientoTabJuntas() {
  const statsBox = document.getElementById("levj-tab-stats");
  const listaBox = document.getElementById("levj-tab-lista");
  if (!statsBox || !listaBox) return;

  const grupos = agruparJuntasPorZona();
  const totalItems = grupos.reduce((acc, g) => acc + g.items.length, 0);
  const totalUnidades = grupos.reduce((acc, g) => acc + g.items.reduce((sum, r) => sum + n(r.cantidad), 0), 0);

  statsBox.innerHTML = `
    <div class="lev-stat"><span class="lev-stat-num">${totalItems}</span><span class="lev-stat-label">Filas</span></div>
    <div class="lev-stat"><span class="lev-stat-num">${totalUnidades}</span><span class="lev-stat-label">Juntas</span></div>
    <div class="lev-stat"><span class="lev-stat-num">${grupos.length}</span><span class="lev-stat-label">Zonas</span></div>
  `;

  listaBox.innerHTML = totalItems === 0
    ? `<div class="hint" style="margin:16px 0 0;">Todavía no hay juntas registradas. Usá "Seguir capturando" arriba.</div>`
    : renderTablaJuntasHTML(grupos);

  listaBox.querySelectorAll("[data-levj-tab-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.levjTabDel);
      pushUndo();
      ROWS_J = ROWS_J.filter(r => r._id !== id);
      renderLevantamientoTabJuntas();
      marcarCambio();
    });
  });
  listaBox.querySelectorAll("[data-levj-tab-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      abrirLevantamientoJuntas();
      editarItemLevJ(Number(btn.dataset.levjTabEdit));
    });
  });
}

async function compartirReporte() {
  const nombre = (PROJECT_INFO.nombre || "proyecto").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "proyecto";
  let doc;
  try {
    doc = construirReportePDF();
  } catch (err) {
    mostrarToast("No se pudo generar el reporte: " + err.message, "error");
    return;
  }

  const archivo = `${nombre}-reporte-cortafuego.pdf`;
  const titulo = `Reporte cortafuego — ${PROJECT_INFO.nombre || "proyecto"}`;
  const texto = `Reporte de sello cortafuego para ${PROJECT_INFO.nombre || "el proyecto"}${PROJECT_INFO.cliente ? " (" + PROJECT_INFO.cliente + ")" : ""}.`;

  try {
    const blob = doc.output("blob");
    const file = new File([blob], archivo, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: titulo, text: texto });
      mostrarToast("Reporte compartido.");
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return; // el usuario cerró la ventana de compartir
    // si falla compartir el archivo, seguimos con la descarga de respaldo abajo
  }

  // Respaldo: el navegador no permite compartir archivos directamente
  doc.save(archivo);
  mostrarToast("Este navegador no permite compartir el PDF directo — se descargó para que lo adjuntes en WhatsApp, correo, etc.");
}

function switchTab(tab) {
  ACTIVE_TAB = tab;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === "panel-" + tab));
  if (tab === "resumen") renderResumen();
  if (tab === "calculadora") renderTable();
  if (tab === "levantamiento-tab") renderLevantamientoTab();
}

// ============================================================================