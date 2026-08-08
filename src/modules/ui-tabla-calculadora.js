// ============================================================================
// ui-tabla-calculadora.js
// UI: estado de filas (ROWS) y render de la tabla Calculadora + Resumen en pantalla.
// (Parte del proyecto Calculadora Cortafuego Hilti — ver src/app.js para
// el archivo original sin dividir, y README.md para el mapa completo de módulos.)
// ============================================================================

// ============================================================================
// UI: estado de filas, render de tabla CALCULADORA y RESUMEN
// ============================================================================

let ROWS = [];
let ROW_SEQ = 1;
let ROWS_J = [];
let ROW_J_SEQ = 1;
let ACTIVE_TAB = "levantamiento-tab";

const CONFIG = { C13: 15, C14: 12.5, C15: 20, C17: 0.10, C17_JUNTAS: 0.10, UMB_FS: 17, UMB_CP606: 17, UMB_SILGG: 17 };
const CONFIG_DEFAULT = { C13: 15, C14: 12.5, C15: 20, C17: 0.10, C17_JUNTAS: 0.10, UMB_FS: 17, UMB_CP606: 17, UMB_SILGG: 17 };

// Modo de presentación para los 3 productos que existen en cartucho y cubeta.
// "auto" = misma regla de siempre (17 cartuchos convierte a cubeta extra).
// "cartuchos" = todo en cartuchos. "cubetas" = todo en cubetas (cualquier
// remanente redondea a 1 cubeta más).
let RESUMEN_MODO_PRODUCTO = { "FS ONE MAX": "auto", "CP 606": "auto", "CFS SIL GG": "auto" };

// Productos agregados a mano en Cuantificación (fuera del cálculo, ej. "el
// cliente ya pidió 3 manguitos CP 653 aparte"). Se guardan y exportan junto
// con el resto del proyecto.
let MANUAL_ITEM_SEQ = 1;
let MANUAL_ITEMS = [];
let MODAL_MANUAL_ABIERTO = false;
let MODAL_MANUAL_PRODUCTO_SEL = "otro"; // clave "nombre|||presentacion" de PRODUCTOS, o "otro"

function itemsManualesComoResumen() {
  return MANUAL_ITEMS.map(m => ({
    tipo: m.tipo, producto: m.producto, presentacion: m.presentacion, codigo: m.codigo,
    cantidad: m.cantidad, manual: true, _manualId: m._id,
  }));
}
const PROJECT_INFO = { nombre: "", cliente: "", fecha: new Date().toISOString().slice(0, 10) };

function nuevaFila() {
  return {
    _id: ROW_SEQ++,
    A: "", B: "", C: 1, D: "", E: 0, F: "", G: "", H: "", I: 0, J: 0,
    L: OPTS_L[0], M: OPTS_M[0], N: OPTS_N[0], O: OPTS_O[0], P: OPTS_P[0], MEM: false, R: "", PPSIZE: 7, PPINST: "Fuera",
    AJ_override: null   // override manual de talla de collarín (null = usar la automática)
  };
}

function kFromL(L) {
  const map = {
    "Tubería Metal": "Tubería", "Tubería Metal Aislado": "Tubería Aislada",
    "Tubería Cobre Aislado HVAC": "Tubería Aislada", "Tubería EMT": "Tubería",
    "Tubería Combustible (PVC, CPVC, PEX, PP-R)": "Tubería",
    "Tubería Combustible Aislada (PVC, CPVC, PEX, PP-R)": "Tubería Aislada",
    "Bandeja de Cables": "Bandeja", "Cable Armado": "Cable",
    "Cables en Paso Repenetrable": "Cable", "Cables Sueltos": "Cable",
    "Caja Electromecánica UL": "Caja Electromecánica UL",
    "Ducto Rectangular": "Ducto Rectangular", "Ducto Rectangular Aislado": "Ducto Rectangular",
    "Ducto Redondo": "Ducto Redondo", "Ducto Redondo Aislado": "Ducto Redondo",
    "Pasante Múltiple": "Multiple", "Vacío": "Vacio",
    "Viga W": "Viga", "Viga Canal": "Viga", "Viga Tubo Rectangular": "Viga"
  };
  return map[L] || "";
}

// Campos relevantes según el tipo de penetrante (para mostrar/ocultar inputs)
function camposVisibles(L) {
  // Todas las celdas quedan siempre editables (igual que en el Excel original);
  // esto solo se usa para saber si un campo es relevante para el resumen mínimo.
  return { D: true, E: true, F: true, G: true, H: true, J: true };
}

function fieldLabel(f) {
  const labels = {
    A: "Zona / Descripción", B: "Nivel", C: "Cantidad", D: "Diámetro (in)",
    E: "Esp. Aislamiento (in)", F: "Dimensión A (cm)", G: "Dimensión B (cm)",
    H: "Prof. Caja (cm)", I: "Espacio Anular (in)", J: "% Ocupación",
    L: "Tipo de Penetrante", M: "Tipo de Barrera", N: "Material de Barrera",
    O: "F Rating", P: "Material Hilti"
  };
  return labels[f] || f;
}

// ============================================================================