// ============================================================================
// planos.js — módulo de planos de referencia con anotaciones y pines
// ============================================================================
// Este módulo maneja la carga, visualización e interacción con planos PDF.
// Encapsulado en un IIFE para evitar polución del namespace global.
// Planos de referencia: subir un PDF, rasterizarlo a 150dpi, verlo con pan/zoom,
// marcar el recorrido a mano alzada, y colocar pines (libres o vinculados a una
// fila de Levantamiento). El módulo también permite exportar el plano anotado a PDF.

(function () {

var PLANOS = [];
var PLANO_SEQ = 1;

const PLANO_DPI = 150; // resolución de rasterizado (px efectivos por pulgada PDF)

// --- Variables de estado del visor ---
let PLANO_ACTIVO_ID = null;
let PLANO_MODO = "mano"; // "mano" | "marcador" | "punto"
let PLANO_COLOR_MARCADOR = "#e2001a";
// Color por defecto para pines nuevos.
// El usuario lo cambia con el mismo selector de color del riel de herramientas
// (que en modo "punto" pinta PLANO_COLOR_PIN en vez de PLANO_COLOR_MARCADOR).
let PLANO_COLOR_PIN = "#e2001a";
// Grosor relativo del trazo: fracción del ancho del canvas (p. ej. 0.003 = 0.3%)
// valor por defecto para trazos viejos guardados sin este campo).
let PLANO_GROSOR = 1; // índice en la lista de grosores (1=delgado, 2=normal, 4=grueso)
let PLANO_RECT_RELLENO = false;
let PLANO_RECT_OPACIDAD = 0.3;

let PLANO_RESALTADOR_OPACIDAD = 0.35;

// Primer punto de una herramienta de 2 clics (línea, etc.).
let PLANO_PUNTO_A = null; // { xFrac, yFrac } o null

// Herramienta activa en el riel
let PLANO_HERRAMIENTA = "mano"; // "mano" | "lapiz" | "resaltador" | "linea" | "rectangulo" | "pin" | "regla" | "borrador"

let PLANO_ESCALA_A = null; // primer punto de calibración
let PLANO_MEDICION_A = null; // primer punto de medición (regla en modo usar)

let PLANO_TOOLS_COLLAPSED = false;
// id del plano cuyo menú "Renombrar/Borrar" está abierto en la galería, o null.
let PLANO_GALERIA_MENU_ID = null;
// "color" | "grosor" | null — cuál de los 2 flyouts del riel (color/grosor)
// está abierto. Se resetea a null al cambiar de herramienta.
let PLANO_RAIL_FLYOUT = null;

// Cuando el visor se abre desde un informe de acreditación, esta variable
// contiene { planoId, planoRef, onCerrar } donde planoRef es el objeto
// mutable del informe (INFORMES_ACREDITACION[n].planoRefs[m]). planoActivo()
// devuelve un plano virtual que mezcla imagen/escala/calibración del plano
// real con las anotaciones propias del informe — los pines de Levantamiento
// no aparecen porque el virtual tiene sus propios arrays.
let PLANO_CAPA_INFORME = null;

// --- Utilidades de arrastre/zoom (puntero + rueda + pellizco de 2 dedos) ---
let PLANO_DRAG_ACTIVO = false;
let PLANO_DRAG_ULTIMO_X = 0;
let PLANO_DRAG_ULTIMO_Y = 0;
let PLANO_PINCH_DIST_INICIAL = null;
let PLANO_PINCH_ZOOM_INICIAL = 1;
// Centro del pellizco en la última muestra (para arrastrar mientras se hace zoom)
let PLANO_PINCH_ULTIMO_CX = 0;
let PLANO_PINCH_ULTIMO_CY = 0;

// Zoom (factor de escala, 1 = tamaño real del canvas) y pan (desplazamiento en px)
let PLANO_ZOOM = 1;
let PLANO_PAN_X = 0;
let PLANO_PAN_Y = 0;

// Contexto de pin: cuando el visor se abre para vincular un pin a una fila,
// guarda los datos de esa fila para usarlos al soltar el pin.
let PLANO_PIN_CONTEXTO = null; // { filaId, filaTipo } o null

// Vista actual del visor ("galeria" = cuadrícula de miniaturas, "visor" = herramientas)
let PLANO_VISTA = "galeria";

const ALTO_BARRAS_APROX = 120; // alto estimado de topbar + riel de herramientas en px

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function cargarLibreriaPDFJS() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement("script");
    script.src = "vendor/pdf.min.mjs";
    script.type = "module";
    script.onload = () => resolve(window.pdfjsLib);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Convierte canvas a dataUrl de forma asíncrona (sin bloquear el hilo).
function canvasADataUrlAsync(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => { if (!blob) { reject(new Error("toBlob devolvió null")); return; } const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); },
      type || "image/webp",
      quality != null ? quality : 0.8
    );
  });
}

async function rasterizarPDF(file) {
  const toastId = mostrarToastProgreso("Cargando PDF…");
  try {
    const lib = await cargarLibreriaPDFJS();
    lib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.mjs";
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await lib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdfDoc.getPage(1); // solo la primera página
    const scale = PLANO_DPI / 72;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = await canvasADataUrlAsync(canvas, "image/webp", 0.8);

    const nombre = (file.name || "Plano").replace(/\.pdf$/i, "");
    const plano = {
      id: PLANO_SEQ++,
      nombre,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      pines: [],
      trazos: [],
      rectangulos: [],
      lineas: [],
      cotas: [], // mediciones persistentes con la herramienta "Regla" — ver procesarMedicion()
      escala: null, // { pxPorCm: number } — se llena al calibrar (ver "Regla y calibración")
    };
    PLANOS.push(plano);
    return plano;
  } finally {
    ocultarToastProgreso(toastId);
  }
}

// Abre el visor de planos. opts.filaId/opts.filaTipo (opcional): si vienen,
// el visor arranca en modo "punto" listo para vincular el próximo pin
// directo a esa fila (sin preguntar nota libre vs. vincular).
// Abre el visor de planos.
// - opts.filaId/opts.filaTipo: fila YA guardada — el próximo pin se vincula
//   directo a ese _id.
// - opts.borrador + opts.onColocar: fila que todavía NO existe (se está
//   agregando, sin _id todavía) — el próximo pin no se guarda en el plano de
//   una vez; se le pasa la ubicación a onColocar(ubicacion) para que quien
//   llamó la guarde como "pendiente" y recién la vincule de verdad cuando la
//   fila se guarde y tenga un _id real.
function abrirVisorPlanos(opts) {
  opts = opts || {};
  PLANO_CAPA_INFORME = null;
  if (opts.filaId != null) {
    PLANO_PIN_CONTEXTO = { filaId: opts.filaId, filaTipo: opts.filaTipo || "penetrante" };
  } else if (opts.borrador) {
    PLANO_PIN_CONTEXTO = { borrador: true, onColocar: opts.onColocar };
  } else {
    PLANO_PIN_CONTEXTO = null;
  }
  PLANO_MODO = PLANO_PIN_CONTEXTO ? "punto" : "mano";
  // Siempre arranca en la galería de miniaturas — el usuario elige la hoja
  // ahí (ver "Cuadrícula de planos" en renderVisorPlanos). abrirVisorPlanosEnPin()
  // es la excepción que salta directo al visor de una hoja puntual.
  PLANO_VISTA = "galeria";
  PLANO_GALERIA_MENU_ID = null;
  PLANO_ACTIVO_ID = null;

  let overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "planos-visor-overlay";
    overlay.className = "planos-visor-overlay";
    document.body.appendChild(overlay);
  }
  document.body.classList.add("modal-open");
  renderVisorPlanos();
}

// Abre el visor en modo "capa de informe": misma imagen y calibración del
// plano real, pero con trazos/pines/etc. propios del informe (aislados de
// Levantamiento). planoRef es el objeto mutable en INFORMES_ACREDITACION.
// Se abre directo en ese plano (salta la galería).
function abrirVisorPlanosConCapaInforme(planoId, planoRef, onCerrar) {
  const real = PLANOS.find(p => p.id === planoId);
  if (!real) { if (window.mostrarToast) mostrarToast("El plano no está cargado en esta sesión.", "error"); return; }
  PLANO_CAPA_INFORME = { planoId, planoRef, onCerrar: onCerrar || null };
  PLANO_PIN_CONTEXTO = null;
  PLANO_MODO = "mano";
  PLANO_VISTA = "visor";
  PLANO_GALERIA_MENU_ID = null;
  PLANO_UNDO_STACK = [];
  PLANO_REDO_STACK = [];
  PLANO_ACTIVO_ID = planoId; // para que planoActivo() encuentre el plano base
  PLANO_ZOOM = calcularZoomAjustado(real);
  const pan = calcularPanCentrado(real, PLANO_ZOOM);
  PLANO_PAN_X = pan.x; PLANO_PAN_Y = pan.y;

  let overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "planos-visor-overlay";
    overlay.className = "planos-visor-overlay";
    document.body.appendChild(overlay);
  }
  document.body.classList.add("modal-open");
  renderVisorPlanos();
}

function cerrarVisorPlanos() {
  const overlay = document.getElementById("planos-visor-overlay");
  if (overlay) overlay.remove();
  document.body.classList.remove("modal-open");
  PLANO_PIN_CONTEXTO = null;
  if (PLANO_CAPA_INFORME && PLANO_CAPA_INFORME.onCerrar) PLANO_CAPA_INFORME.onCerrar();
  PLANO_CAPA_INFORME = null;
}

// Devuelve el plano "de trabajo": en modo capa de informe es un objeto virtual
// que tiene la imagen/dimensiones/escala del plano real pero los arrays de
// anotación del informe (misma referencia → las mutaciones se propagan solas).
function planoActivo() {
  const real = PLANOS.find(p => p.id === PLANO_ACTIVO_ID) || null;
  if (!real || !PLANO_CAPA_INFORME) return real;
  const ref = PLANO_CAPA_INFORME.planoRef;
  // Objeto virtual: comparte arrays con planoRef → push/assign directo funciona.
  return {
    id: real.id,
    nombre: real.nombre,
    dataUrl: real.dataUrl,
    width: real.width,
    height: real.height,
    escala: real.escala,
    pines: ref.pines,
    trazos: ref.trazos,
    rectangulos: ref.rectangulos,
    lineas: ref.lineas,
    cotas: ref.cotas,
  };
}

// Selecciona un plano desde la cuadrícula de galería y pasa al visor de
// herramientas sobre esa hoja, con el zoom inicial "ajustar a pantalla".
function abrirPlanoDesdeGaleria(id) {
  PLANO_ACTIVO_ID = id;
  const p = planoActivo();
  if (!p) return;
  PLANO_ZOOM = calcularZoomAjustado(p);
  const pan = calcularPanCentrado(p, PLANO_ZOOM);
  PLANO_PAN_X = pan.x; PLANO_PAN_Y = pan.y;
  PLANO_VISTA = "visor";
  renderVisorPlanos();
}

// Lista de planos ordenada alfabéticamente por nombre — se usa en todos los
// selectores y cuadrículas para que siempre salgan en el mismo orden.
function planosOrdenados() {
  return PLANOS.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: "base" }));
}

// --- Zoom y pan ---

function calcularZoomAjustado(plano) {
  const availW = Math.max(200, window.innerWidth - 20);
  const availH = Math.max(200, window.innerHeight - ALTO_BARRAS_APROX);
  return Math.min(availW / plano.width, availH / plano.height, 1);
}

function calcularPanCentrado(plano, zoom) {
  const availW = Math.max(200, window.innerWidth - 20);
  const availH = Math.max(200, window.innerHeight - ALTO_BARRAS_APROX);
  return {
    x: (availW - plano.width * zoom) / 2,
    y: (availH - plano.height * zoom) / 2,
  };
}

function aplicarZoomCentrado(nuevoZoom, cx, cy) {
  const z0 = PLANO_ZOOM;
  const z1 = Math.max(0.1, Math.min(10, nuevoZoom));
  PLANO_PAN_X = cx - (cx - PLANO_PAN_X) * (z1 / z0);
  PLANO_PAN_Y = cy - (cy - PLANO_PAN_Y) * (z1 / z0);
  PLANO_ZOOM = z1;
}

function centroDelWrap() {
  const wrap = document.getElementById("planos-canvas-wrap");
  if (!wrap) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = wrap.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Cuadrícula de miniaturas — pantalla inicial del módulo de Planos. Cada
// miniatura muestra el plano con las marcas ya superpuestas (no con el overlay
// de canvas; se re-dibuja en un <canvas> estático para que se vea en la tarjeta).
function renderGaleriaPlanos() {
  const lista = planosOrdenados();
  if (!lista.length) {
    return `
      <div class="planos-galeria-vacia">
        <p>No hay planos cargados.</p>
        <label class="primary">
          <svg class="icon"><use href="#i-upload"/></svg>Subir plano PDF
          <input type="file" accept="application/pdf" id="planos-input-pdf" hidden>
        </label>
      </div>`;
  }
  return `
    <div class="planos-galeria">
      <div class="planos-galeria-grid">
        ${lista.map(p => {
          const npines = (p.pines || []).length;
          const ntrazos = (p.trazos || []).length + (p.rectangulos || []).length + (p.lineas || []).length;
          const menuAbierto = PLANO_GALERIA_MENU_ID === p.id;
          return `
            <div class="planos-card" data-planos-id="${p.id}">
              <div class="planos-card-img-wrap" data-planos-action="abrir" data-id="${p.id}">
                <img src="${p.dataUrl}" alt="${escapeHtml(p.nombre)}" loading="lazy">
                ${npines ? `<span class="planos-card-badge">${npines} pin${npines > 1 ? "es" : ""}</span>` : ""}
              </div>
              <div class="planos-card-footer">
                <span class="planos-card-nombre" title="${escapeHtml(p.nombre)}">${escapeHtml(p.nombre)}</span>
                <div class="planos-card-menu-wrap">
                  <button type="button" class="planos-btn-icono" data-planos-action="menu-galeria" data-id="${p.id}" aria-label="Opciones"><svg class="icon"><use href="#i-more-vertical"/></svg></button>
                  ${menuAbierto ? `
                    <div class="planos-galeria-menu">
                      <button type="button" data-planos-action="renombrar" data-id="${p.id}">Renombrar</button>
                      <button type="button" data-planos-action="borrar" data-id="${p.id}">Borrar plano</button>
                    </div>` : ""}
                </div>
              </div>
            </div>`;
        }).join("")}
      </div>
      <label class="secondary planos-btn-subir-mas">
        <svg class="icon"><use href="#i-upload"/></svg>Subir otro plano
        <input type="file" accept="application/pdf" id="planos-input-pdf" hidden>
      </label>
    </div>`;
}

function renderVisorPlanos() {
  const overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) return;
  const plano = planoActivo();
  const enVisor = PLANO_VISTA === "visor" && plano;
  const enCapaInforme = !!PLANO_CAPA_INFORME;

  overlay.innerHTML = `
    <div class="planos-visor-topbar">
      <button type="button" id="planos-btn-cerrar" class="lev-exit-btn"><svg class="icon"><use href="#i-arrow-left"/></svg>${enVisor && !enCapaInforme ? "Planos" : "Cerrar"}</button>
      ${enVisor ? (enCapaInforme ? `
        <span class="planos-visor-title">Plano del informe <span style="font-weight:400;opacity:0.7">· ${escapeHtml(plano.nombre)}</span></span>
      ` : `
        <select id="planos-select-hoja" class="planos-select-hoja">
          ${planosOrdenados().map(p => `<option value="${p.id}" ${p.id === PLANO_ACTIVO_ID ? "selected" : ""}>${escapeHtml(p.nombre)}</option>`).join("")}
        </select>
        <button type="button" id="planos-btn-renombrar" class="planos-btn-icono" aria-label="Renombrar plano" title="Renombrar plano"><svg class="icon"><use href="#i-edit"/></svg></button>
        <button type="button" id="planos-btn-compartir" class="planos-btn-icono" aria-label="Compartir plano" title="Compartir plano"><svg class="icon"><use href="#i-share"/></svg></button>
      `) : `<span class="planos-visor-title">Planos</span>`}
    </div>
    ${!enVisor ? renderGaleriaPlanos() : renderVisorHerramientasYCanvas(plano)}
  `;

  attachVisorPlanosEvents(overlay);
  const wrapCursor = document.getElementById("planos-canvas-wrap");
  if (wrapCursor) wrapCursor.style.cursor = cursorParaModo(PLANO_MODO);
}

// Riel de herramientas + canvas. Función separada de renderVisorPlanos()
// renderVisorPlanos() para que el template principal no quede gigante.
function renderVisorHerramientasYCanvas(plano) {
  const colorActual = PLANO_MODO === "punto" ? PLANO_COLOR_PIN : PLANO_COLOR_MARCADOR;
  const grosores = [1, 2, 4, 8];
  const colores = ["#e2001a", "#000000", "#1f6fcf", "#d97706", "#16a34a", "#9333ea", "#ffffff"];
  const herramientas = [
    { id: "mano", icono: "i-hand", label: "Mano (arrastrar)" },
    { id: "lapiz", icono: "i-pencil", label: "Lápiz" },
    { id: "resaltador", icono: "i-highlighter", label: "Resaltador" },
    { id: "linea", icono: "i-minus", label: "Línea" },
    { id: "rectangulo", icono: "i-square", label: "Rectángulo" },
    { id: "pin", icono: "i-map-pin", label: "Pin de nota" },
    { id: "regla", icono: "i-ruler", label: "Regla / calibración" },
    { id: "borrador", icono: "i-eraser", label: "Borrador" },
  ];
  return `
    <div class="planos-layout">
      <div class="planos-rail ${PLANO_TOOLS_COLLAPSED ? "rail-collapsed" : ""}">
        <button type="button" id="planos-rail-toggle" class="planos-rail-toggle" title="${PLANO_TOOLS_COLLAPSED ? "Mostrar herramientas" : "Ocultar herramientas"}">
          <svg class="icon"><use href="#i-chevron-${PLANO_TOOLS_COLLAPSED ? "right" : "left"}"/></svg>
        </button>
        ${PLANO_TOOLS_COLLAPSED ? "" : `
        <div class="planos-rail-herramientas">
          ${herramientas.map(h => `
            <button type="button" class="planos-tool-btn ${PLANO_HERRAMIENTA === h.id ? "active" : ""}" data-planos-herramienta="${h.id}" title="${h.label}" aria-label="${h.label}">
              <svg class="icon"><use href="#${h.icono}"/></svg>
            </button>`).join("")}
        </div>
        <div class="planos-rail-separator"></div>
        ${PLANO_HERRAMIENTA !== "mano" && PLANO_HERRAMIENTA !== "borrador" && PLANO_HERRAMIENTA !== "regla" ? `
        <button type="button" id="planos-rail-color-btn" class="planos-rail-color-preview" style="background:${colorActual}" title="Color"></button>
        ${PLANO_RAIL_FLYOUT === "color" ? `
          <div class="planos-rail-flyout">
            ${colores.map(c => `<button type="button" class="planos-color-swatch ${colorActual === c ? "active" : ""}" data-planos-color="${c}" style="background:${c}"></button>`).join("")}
          </div>` : ""}
        <button type="button" id="planos-rail-grosor-btn" class="planos-rail-grosor-btn" title="Grosor">
          <span class="planos-grosor-preview" style="height:${Math.max(1, PLANO_GROSOR)}px"></span>
        </button>
        ${PLANO_RAIL_FLYOUT === "grosor" ? `
          <div class="planos-rail-flyout planos-rail-flyout-grosor">
            ${grosores.map(g => `<button type="button" class="planos-grosor-opcion ${PLANO_GROSOR === g ? "active" : ""}" data-planos-grosor="${g}"><span style="height:${g}px"></span></button>`).join("")}
          </div>` : ""}
        ` : ""}
        ${PLANO_HERRAMIENTA === "rectangulo" ? `
        <label class="planos-rail-label">
          <input type="checkbox" id="planos-relleno-check" ${PLANO_RECT_RELLENO ? "checked" : ""}> Relleno
        </label>
        ${PLANO_RECT_RELLENO ? `
          <div class="planos-rail-opacidad">
            ${[0.1, 0.2, 0.3, 0.5, 0.7].map(op => `<button type="button" class="planos-opacidad-btn ${PLANO_RECT_OPACIDAD === op ? "active" : ""}" data-planos-opacidad="${op}">${Math.round(op * 100)}%</button>`).join("")}
          </div>` : ""}
        ` : ""}
        ${PLANO_HERRAMIENTA === "resaltador" ? `
          <div class="planos-rail-opacidad">
            ${[0.15, 0.25, 0.35, 0.5].map(op => `<button type="button" class="planos-opacidad-btn ${PLANO_RESALTADOR_OPACIDAD === op ? "active" : ""}" data-planos-opacidad-marcador="${op}">${Math.round(op * 100)}%</button>`).join("")}
          </div>` : ""}
        ${PLANO_HERRAMIENTA === "regla" ? `
          <p class="hint" style="font-size:11px;margin:4px 0 0">Toca dos puntos para medir. Mantené presionado el primer punto para calibrar la escala.</p>
          ${plano.escala ? `<p class="hint" style="font-size:11px;margin:2px 0 0">Escala: 1 cm = ${(plano.escala.pxPorCm / PLANO_DPI * 2.54).toFixed(2)} cm reales</p>` : `<p class="hint" style="font-size:11px;margin:2px 0 0">Sin calibrar</p>`}
        ` : ""}
        <div class="planos-rail-separator"></div>
        <button type="button" id="planos-btn-deshacer" class="planos-tool-btn" title="Deshacer" aria-label="Deshacer"><svg class="icon"><use href="#i-undo"/></svg></button>
        <button type="button" id="planos-btn-rehacer" class="planos-tool-btn" title="Rehacer" aria-label="Rehacer"><svg class="icon"><use href="#i-redo"/></svg></button>
        `}
      </div>
      <div class="planos-visor-right">
        <div class="planos-canvas-wrap" id="planos-canvas-wrap">
          <div class="planos-canvas-posicionador" id="planos-posicionador" style="transform:translate(${PLANO_PAN_X}px,${PLANO_PAN_Y}px) scale(${PLANO_ZOOM}); transform-origin: 0 0; position:absolute;">
            <img src="${plano.dataUrl}" style="display:block;width:${plano.width}px;height:${plano.height}px;" alt="">
            <svg class="planos-svg-capa" style="position:absolute;top:0;left:0;width:${plano.width}px;height:${plano.height}px;overflow:visible;" viewBox="0 0 ${plano.width} ${plano.height}">
              ${(plano.rectangulos || []).map(r => {
                const relleno = r.relleno ? `fill="${r.color}" fill-opacity="${r.opacidad || 0.3}"` : 'fill="none"';
                return `<rect data-planos-forma-id="${r.id}" data-planos-forma-tipo="rectangulos" x="${r.x1 * plano.width}" y="${r.y1 * plano.height}" width="${(r.x2 - r.x1) * plano.width}" height="${(r.y2 - r.y1) * plano.height}" stroke="${r.color}" stroke-width="${r.grosor || 2}" ${relleno} stroke-linejoin="round"/>`;
              }).join("")}
              ${(plano.lineas || []).map(l => {
                return `<line data-planos-forma-id="${l.id}" data-planos-forma-tipo="lineas" x1="${l.x1 * plano.width}" y1="${l.y1 * plano.height}" x2="${l.x2 * plano.width}" y2="${l.y2 * plano.height}" stroke="${l.color}" stroke-width="${l.grosor || 2}" stroke-linecap="round"/>`;
              }).join("")}
              ${(plano.trazos || []).map(t => {
                if (!t.puntos || t.puntos.length < 2) return "";
                const d = t.puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x * plano.width},${p.y * plano.height}`).join(" ");
                const esResaltador = t.esResaltador;
                return `<path data-planos-forma-id="${t.id}" data-planos-forma-tipo="trazos" d="${d}" stroke="${t.color}" stroke-width="${t.grosor || 2}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${esResaltador ? `opacity="${t.opacidad || 0.35}"` : ""}/>`;  
              }).join("")}
              ${(plano.cotas || []).map(c => svgCota(plano, c)).join("")}
            </svg>
            <div class="planos-pines-layer">
              ${(plano.pines || []).map((pin, i) => `
                <div class="planos-pin ${pin.filaId != null ? "planos-pin-vinculado" : ""}" data-pin-id="${pin.id}" style="left:${pin.xFrac * 100}%;top:${pin.yFrac * 100}%;">
                  <svg class="icon planos-pin-icono" style="color:${pin.color || "#e2001a"}"><use href="#i-map-pin"/></svg>
                  <span class="planos-pin-label">${pin.nota ? escapeHtml(pin.nota.substring(0, 24)) : (i + 1)}</span>
                </div>`).join("")}
            </div>
            ${PLANO_MODO === "linea" && PLANO_PUNTO_A ? `
              <div class="planos-punto-a-marker" style="left:${PLANO_PUNTO_A.xFrac * 100}%;top:${PLANO_PUNTO_A.yFrac * 100}%;"></div>` : ""}
            ${PLANO_MODO === "regla" && PLANO_MEDICION_A ? `
              <div class="planos-punto-a-marker" style="left:${PLANO_MEDICION_A.xFrac * 100}%;top:${PLANO_MEDICION_A.yFrac * 100}%;"></div>` : ""}
          </div>
        </div>
        <div class="planos-zoom-bar">
          <button type="button" id="planos-zoom-menos" class="secondary icon-only-btn" aria-label="Alejar"><svg class="icon"><use href="#i-minus"/></svg></button>
          <button type="button" id="planos-zoom-reset" class="secondary" aria-label="Zoom ajustar">${Math.round(PLANO_ZOOM * 100)}%</button>
          <button type="button" id="planos-zoom-mas" class="secondary icon-only-btn" aria-label="Acercar"><svg class="icon"><use href="#i-plus"/></svg></button>
        </div>
      </div>
    </div>`;
}

function svgCota(plano, c) {
  const x1 = c.x1 * plano.width, y1 = c.y1 * plano.height;
  const x2 = c.x2 * plano.width, y2 = c.y2 * plano.height;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const texto = textoCota(plano, c);
  const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  return `
    <g data-planos-forma-id="${c.id}" data-planos-forma-tipo="cotas">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0072ce" stroke-width="2" stroke-dasharray="6 3"/>
      <circle cx="${x1}" cy="${y1}" r="4" fill="#0072ce"/>
      <circle cx="${x2}" cy="${y2}" r="4" fill="#0072ce"/>
      <text x="${mx}" y="${my - 6}" fill="#0072ce" font-size="13" font-weight="700" text-anchor="middle" transform="rotate(${Math.abs(ang) > 90 ? ang + 180 : ang},${mx},${my})">${escapeHtml(texto)}</text>
    </g>`;
}

function textoCota(plano, c) {
  if (!plano.escala || !plano.escala.pxPorCm) return "—";
  const pxTotales = Math.hypot((c.x2 - c.x1) * plano.width, (c.y2 - c.y1) * plano.height);
  const cm = pxTotales / plano.escala.pxPorCm;
  if (cm >= 100) return (cm / 100).toFixed(2) + " m";
  if (cm >= 1) return cm.toFixed(1) + " cm";
  return (cm * 10).toFixed(0) + " mm";
}

function cursorParaModo(modo) {
  const mapa = {
    mano: "grab",
    lapiz: "crosshair",
    resaltador: "crosshair",
    linea: "crosshair",
    rectangulo: "crosshair",
    pin: "copy",
    regla: "crosshair",
    borrador: "cell",
    punto: "copy",
  };
  return mapa[modo] || "default";
}

function attachVisorPlanosEvents(overlay) {
  // El botón "Cerrar"/"← Planos" del topbar hace dos cosas distintas según la
  // vista actual: en el visor de una hoja vuelve a la galería; en la galería
  // cierra el overlay completo.
  const btnCerrar = document.getElementById("planos-btn-cerrar");
  if (btnCerrar) btnCerrar.addEventListener("click", () => {
    if (PLANO_CAPA_INFORME || PLANO_VISTA === "galeria") {
      cerrarVisorPlanos();
    } else {
      PLANO_VISTA = "galeria";
      PLANO_ACTIVO_ID = null;
      renderVisorPlanos();
    }
  });

  const inputPDF = document.getElementById("planos-input-pdf");
  if (inputPDF) inputPDF.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const plano = await rasterizarPDF(file);
      marcarCambio();
      abrirPlanoDesdeGaleria(plano.id);
    } catch (err) {
      mostrarToast("No se pudo cargar el PDF: " + err.message, "error");
    }
  });

  const selectHoja = document.getElementById("planos-select-hoja");
  if (selectHoja) selectHoja.addEventListener("change", () => {
    const id = parseInt(selectHoja.value);
    if (!isNaN(id)) abrirPlanoDesdeGaleria(id);
  });

  const btnRenombrar = document.getElementById("planos-btn-renombrar");
  if (btnRenombrar) btnRenombrar.addEventListener("click", () => {
    const p = planoActivo();
    if (!p) return;
    const nombre = prompt("Nuevo nombre del plano:", p.nombre);
    const planoReal = PLANOS.find(pl => pl.id === PLANO_ACTIVO_ID);
    if (nombre && nombre.trim() && planoReal) {
      planoReal.nombre = nombre.trim();
      marcarCambio();
      renderVisorPlanos();
    }
  });

  const btnCompartir = document.getElementById("planos-btn-compartir");
  if (btnCompartir) btnCompartir.addEventListener("click", () => {
    exportarPlanosPDF();
  });

  const railToggle = document.getElementById("planos-rail-toggle");
  if (railToggle) railToggle.addEventListener("click", () => {
    PLANO_TOOLS_COLLAPSED = !PLANO_TOOLS_COLLAPSED;
    renderVisorPlanos();
  });

  document.querySelectorAll("[data-planos-herramienta]").forEach(btn => {
    btn.addEventListener("click", () => {
      const h = btn.dataset.planosHerramienta;
      PLANO_HERRAMIENTA = h;
      PLANO_MODO = h === "pin" ? "punto" : h === "mano" ? "mano" : h;
      PLANO_PUNTO_A = null;
      PLANO_MEDICION_A = null;
      PLANO_RAIL_FLYOUT = null;
      renderVisorPlanos();
    });
  });
  const railColorBtn = document.getElementById("planos-rail-color-btn");
  if (railColorBtn) railColorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    PLANO_RAIL_FLYOUT = PLANO_RAIL_FLYOUT === "color" ? null : "color";
    renderVisorPlanos();
  });
  const railGrosorBtn = document.getElementById("planos-rail-grosor-btn");
  if (railGrosorBtn) railGrosorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    PLANO_RAIL_FLYOUT = PLANO_RAIL_FLYOUT === "grosor" ? null : "grosor";
    renderVisorPlanos();
  });
  document.querySelectorAll("[data-planos-color]").forEach(btn => {
    btn.addEventListener("click", () => {
      // El botón de color es el mismo para dibujo y para pines — pinta uno u
      // otro estado según qué herramienta esté activa en ese momento (ver
      // colorActual en renderVisorHerramientasYCanvas).
      if (PLANO_MODO === "punto") {
        PLANO_COLOR_PIN = btn.dataset.planosColor;
      } else {
        PLANO_COLOR_MARCADOR = btn.dataset.planosColor;
      }
      renderVisorPlanos();
    });
  });
  document.querySelectorAll("[data-planos-grosor]").forEach(btn => {
    btn.addEventListener("click", () => {
      PLANO_GROSOR = parseFloat(btn.dataset.planosGrosor);
      renderVisorPlanos();
    });
  });
  const rellenoCheck = document.getElementById("planos-relleno-check");
  if (rellenoCheck) rellenoCheck.addEventListener("change", () => {
    PLANO_RECT_RELLENO = rellenoCheck.checked;
    renderVisorPlanos();
  });
  document.querySelectorAll("[data-planos-opacidad]").forEach(btn => {
    btn.addEventListener("click", () => {
      PLANO_RECT_OPACIDAD = parseFloat(btn.dataset.planosOpacidad);
      renderVisorPlanos();
    });
  });
  document.querySelectorAll("[data-planos-opacidad-marcador]").forEach(btn => {
    btn.addEventListener("click", () => {
      PLANO_RESALTADOR_OPACIDAD = parseFloat(btn.dataset.planosOpacidadMarcador);
      renderVisorPlanos();
    });
  });
  const btnDeshacer = document.getElementById("planos-btn-deshacer");
  if (btnDeshacer) btnDeshacer.addEventListener("click", planoDeshacer);
  const btnRehacer = document.getElementById("planos-btn-rehacer");
  if (btnRehacer) btnRehacer.addEventListener("click", planoRehacer);


  const zoomMenos = document.getElementById("planos-zoom-menos");
  if (zoomMenos) zoomMenos.addEventListener("click", () => {
    const c = centroDelWrap();
    aplicarZoomCentrado(PLANO_ZOOM - 0.25, c.x, c.y);
    renderVisorPlanos();
  });
  const zoomMas = document.getElementById("planos-zoom-mas");
  if (zoomMas) zoomMas.addEventListener("click", () => {
    const c = centroDelWrap();
    aplicarZoomCentrado(PLANO_ZOOM + 0.25, c.x, c.y);
    renderVisorPlanos();
  });
  const zoomReset = document.getElementById("planos-zoom-reset");
  if (zoomReset) zoomReset.addEventListener("click", () => {
    const p = planoActivo();
    if (!p) return;
    PLANO_ZOOM = calcularZoomAjustado(p);
    const pan = calcularPanCentrado(p, PLANO_ZOOM);
    PLANO_PAN_X = pan.x; PLANO_PAN_Y = pan.y;
    renderVisorPlanos();
  });

  overlay.addEventListener("click", e => {
    const btn = e.target.closest("[data-planos-action]");
    if (!btn) return;
    const action = btn.dataset.planosAction;
    const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;
    if (action === "abrir") abrirPlanoDesdeGaleria(id);
    else if (action === "menu-galeria") {
      PLANO_GALERIA_MENU_ID = PLANO_GALERIA_MENU_ID === id ? null : id;
      renderVisorPlanos();
    }
    else if (action === "renombrar") {
      const plano = PLANOS.find(p => p.id === id);
      if (!plano) return;
      const nombre = prompt("Nuevo nombre del plano:", plano.nombre);
      if (nombre && nombre.trim()) {
        plano.nombre = nombre.trim();
        marcarCambio();
        renderVisorPlanos();
      }
    }
    else if (action === "borrar") {
      const p = PLANOS.find(p => p.id === id);
      if (!p) return;
      if (confirm(`¿Borrar el plano "${p.nombre}"? Se van a perder sus marcas, pines y cotas.`)) {
        PLANOS.splice(PLANOS.indexOf(p), 1);
        PLANO_GALERIA_MENU_ID = null;
        marcarCambio();
        renderVisorPlanos();
      }
    }
  });

  const wrap = document.getElementById("planos-canvas-wrap");
  if (wrap) ligarEventosPuntero(wrap);
}

// --- Interacción puntero (drag, zoom, dibujo) ---

function wrapToFrac(e, canvas) {
  // Convierte evento de puntero en fracciones [0,1] relativas al canvas del plano.
  const posic = document.getElementById("planos-posicionador");
  if (!posic) return null;
  const rect = posic.getBoundingClientRect();
  return {
    xFrac: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
    yFrac: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
  };
}

function ligarEventosPuntero(wrap) {
  let pointers = {};

  wrap.addEventListener("pointerdown", e => {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ids = Object.keys(pointers);

    if (ids.length === 2) {
      // Inicio de pellizco — modo zoom
      const [a, b] = ids.map(id => pointers[id]);
      PLANO_PINCH_DIST_INICIAL = Math.hypot(b.x - a.x, b.y - a.y);
      PLANO_PINCH_ZOOM_INICIAL = PLANO_ZOOM;
      PLANO_PINCH_ULTIMO_CX = (a.x + b.x) / 2;
      PLANO_PINCH_ULTIMO_CY = (a.y + b.y) / 2;
      return;
    }

    if (PLANO_MODO === "mano") {
      PLANO_DRAG_ACTIVO = true;
      PLANO_DRAG_ULTIMO_X = e.clientX;
      PLANO_DRAG_ULTIMO_Y = e.clientY;
      wrap.setPointerCapture(e.pointerId);
      return;
    }

    const plano = planoActivo();
    if (!plano) return;
    const frac = wrapToFrac(e);
    if (!frac) return;

    if (PLANO_MODO === "punto") {
      colocarPin(plano, frac);
      return;
    }

    if (PLANO_MODO === "linea" || PLANO_MODO === "rectangulo") {
      if (!PLANO_PUNTO_A) {
        PLANO_PUNTO_A = frac;
      } else {
        if (PLANO_MODO === "linea") {
          planoPushUndo(plano);
          plano.lineas.push({
            id: Date.now(),
            x1: PLANO_PUNTO_A.xFrac, y1: PLANO_PUNTO_A.yFrac,
            x2: frac.xFrac, y2: frac.yFrac,
            color: PLANO_COLOR_MARCADOR,
            grosor: PLANO_GROSOR,
          });
        } else {
          const x1 = Math.min(PLANO_PUNTO_A.xFrac, frac.xFrac);
          const y1 = Math.min(PLANO_PUNTO_A.yFrac, frac.yFrac);
          const x2 = Math.max(PLANO_PUNTO_A.xFrac, frac.xFrac);
          const y2 = Math.max(PLANO_PUNTO_A.yFrac, frac.yFrac);
          if (x2 - x1 > 0.005 && y2 - y1 > 0.005) {
            planoPushUndo(plano);
            plano.rectangulos.push({
              id: Date.now(),
              x1, y1, x2, y2,
              color: PLANO_COLOR_MARCADOR,
              grosor: PLANO_GROSOR,
              relleno: PLANO_RECT_RELLENO,
              opacidad: PLANO_RECT_OPACIDAD,
            });
          }
        }
        PLANO_PUNTO_A = null;
        marcarCambio();
        renderVisorPlanos();
      }
      return;
    }

    if (PLANO_MODO === "regla") {
      procesarClicRegla(plano, frac, e);
      return;
    }

    if (PLANO_MODO === "lapiz" || PLANO_MODO === "resaltador") {
      wrap.setPointerCapture(e.pointerId);
      const nuevoTrazo = { id: Date.now(), puntos: [frac], color: PLANO_COLOR_MARCADOR, grosor: PLANO_GROSOR * 2, esResaltador: PLANO_MODO === "resaltador", opacidad: PLANO_RESALTADOR_OPACIDAD };
      planoPushUndo(plano);
      plano.trazos.push(nuevoTrazo);
      return;
    }
  }, { passive: true });

  wrap.addEventListener("pointermove", e => {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ids = Object.keys(pointers);

    if (ids.length === 2 && PLANO_PINCH_DIST_INICIAL !== null) {
      const [a, b] = ids.map(id => pointers[id]);
      const distActual = Math.hypot(b.x - a.x, b.y - a.y);
      const nuevoZoom = PLANO_PINCH_ZOOM_INICIAL * (distActual / PLANO_PINCH_DIST_INICIAL);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      PLANO_PAN_X += cx - PLANO_PINCH_ULTIMO_CX;
      PLANO_PAN_Y += cy - PLANO_PINCH_ULTIMO_CY;
      PLANO_PINCH_ULTIMO_CX = cx;
      PLANO_PINCH_ULTIMO_CY = cy;
      aplicarZoomCentrado(nuevoZoom, cx, cy);
      const posic = document.getElementById("planos-posicionador");
      if (posic) posic.style.transform = `translate(${PLANO_PAN_X}px,${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
      return;
    }

    if (PLANO_DRAG_ACTIVO) {
      PLANO_PAN_X += e.clientX - PLANO_DRAG_ULTIMO_X;
      PLANO_PAN_Y += e.clientY - PLANO_DRAG_ULTIMO_Y;
      PLANO_DRAG_ULTIMO_X = e.clientX;
      PLANO_DRAG_ULTIMO_Y = e.clientY;
      const posic = document.getElementById("planos-posicionador");
      if (posic) posic.style.transform = `translate(${PLANO_PAN_X}px,${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
      return;
    }

    if ((PLANO_MODO === "lapiz" || PLANO_MODO === "resaltador")) {
      const plano = planoActivo();
      if (!plano || !plano.trazos.length) return;
      const frac = wrapToFrac(e);
      if (!frac) return;
      const trazo = plano.trazos[plano.trazos.length - 1];
      trazo.puntos.push(frac);
      // Actualización rápida del SVG sin re-renderizar todo
      const svgPath = document.querySelector(`path[data-planos-forma-id="${trazo.id}"]`);
      if (svgPath) {
        const d = trazo.puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.xFrac * plano.width},${p.yFrac * plano.height}`).join(" ");
        svgPath.setAttribute("d", d);
      }
    }
  }, { passive: true });

  wrap.addEventListener("pointerup", e => {
    delete pointers[e.pointerId];
    if (Object.keys(pointers).length < 2) PLANO_PINCH_DIST_INICIAL = null;
    if (PLANO_DRAG_ACTIVO) { PLANO_DRAG_ACTIVO = false; return; }
    if (PLANO_MODO === "lapiz" || PLANO_MODO === "resaltador") {
      marcarCambio();
    }
    if (PLANO_MODO === "borrador") {
      const plano = planoActivo();
      if (!plano) return;
      const frac = wrapToFrac(e);
      if (!frac) return;
      borrarFormaEnPunto(plano, frac);
    }
  }, { passive: true });

  wrap.addEventListener("pointercancel", e => {
    delete pointers[e.pointerId];
    PLANO_DRAG_ACTIVO = false;
    PLANO_PINCH_DIST_INICIAL = null;
  }, { passive: true });

  wrap.addEventListener("wheel", e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    aplicarZoomCentrado(PLANO_ZOOM + delta, e.clientX, e.clientY);
    const posic = document.getElementById("planos-posicionador");
    if (posic) posic.style.transform = `translate(${PLANO_PAN_X}px,${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
  }, { passive: false });
}

// Maneja el clic en la herramienta "Regla": primer clic = punto A (o inicio de
// calibración si se mantiene presionado), segundo clic = punto B (muestra la
// medición o guarda la cota en el plano).
let PLANO_REGLA_CALIBRANDO = false;
function procesarClicRegla(plano, frac, e) {
  if (!PLANO_MEDICION_A) {
    PLANO_MEDICION_A = frac;
    PLANO_REGLA_CALIBRANDO = false;
    renderVisorPlanos();
    return;
  }
  procesarMedicion(plano, PLANO_MEDICION_A, frac);
  PLANO_MEDICION_A = null;
  renderVisorPlanos();
}

function procesarMedicion(plano, a, b) {
  if (PLANO_REGLA_CALIBRANDO) {
    calibrarEscala(plano, a, b);
  } else if (plano.escala) {
    guardarCota(plano, a, b);
  } else {
    mostrarToast("Calibrá la escala primero (mantené presionado el primer punto).");
  }
}

function calibrarEscala(plano, a, b) {
  const pxTotales = Math.hypot((b.xFrac - a.xFrac) * plano.width, (b.yFrac - a.yFrac) * plano.height);
  const distCmStr = prompt("¿Cuántos metros mide esa línea en la realidad?");
  const distReal = parseFloat(distCmStr);
  if (isNaN(distReal) || distReal <= 0) { mostrarToast("Medida inválida.", "error"); return; }
  const distCm = distReal * 100;
  plano.escala = { pxPorCm: pxTotales / distCm };
  marcarCambio();
  mostrarToast(`Escala calibrada: 1 cm = ${(pxTotales / distCm / PLANO_DPI * 2.54).toFixed(2)} cm reales`);
}

function guardarCota(plano, a, b) {
  planoPushUndo(plano);
  plano.cotas = plano.cotas || [];
  plano.cotas.push({ id: Date.now(), x1: a.xFrac, y1: a.yFrac, x2: b.xFrac, y2: b.yFrac });
  marcarCambio();
}

// Borra el trazo/rectángulo/línea/cota más cercano al punto tocado.
function borrarFormaEnPunto(plano, frac) {
  const px = frac.xFrac * plano.width, py = frac.yFrac * plano.height;
  const TOL = 15; // tolerancia en px del canvas
  let eliminado = false;

  // Intentar borrar por el elemento SVG directamente sobre el que se hizo clic
  const svgEl = document.elementFromPoint(px * PLANO_ZOOM + PLANO_PAN_X, py * PLANO_ZOOM + PLANO_PAN_Y);
  if (svgEl) {
    const forma = svgEl.closest("[data-planos-forma-id]");
    if (forma) {
      const id = parseInt(forma.dataset.planosFormaId);
      const tipo = forma.dataset.planosFormaTipo;
      if (tipo && plano[tipo]) {
        planoPushUndo(plano);
        plano[tipo] = plano[tipo].filter(f => f.id !== id);
        marcarCambio();
        renderVisorPlanos();
        return;
      }
    }
  }

  // Fallback: borrar trazos por proximidad
  for (const t of [...(plano.trazos || [])].reverse()) {
    for (let i = 0; i < t.puntos.length - 1; i++) {
      const x1 = t.puntos[i].xFrac * plano.width, y1 = t.puntos[i].yFrac * plano.height;
      const x2 = t.puntos[i + 1].xFrac * plano.width, y2 = t.puntos[i + 1].yFrac * plano.height;
      if (distanciaPuntoASegmento(px, py, x1, y1, x2, y2) < TOL) {
        planoPushUndo(plano);
        plano.trazos = plano.trazos.filter(tr => tr.id !== t.id);
        eliminado = true;
        break;
      }
    }
    if (eliminado) break;
  }

  if (!eliminado) {
    const pinEl = document.elementFromPoint(px * PLANO_ZOOM + PLANO_PAN_X, py * PLANO_ZOOM + PLANO_PAN_Y);
    const pinDiv = pinEl && pinEl.closest(".planos-pin");
    if (pinDiv) {
      const pinId = parseInt(pinDiv.dataset.pinId);
      borrarPin(plano, pinId);
      return;
    }
  }

  if (eliminado) { marcarCambio(); renderVisorPlanos(); }
}

// Encuentra un pin por id.
function buscarPin(plano, id) {
  return plano.pines.find(p => p.id === id) || null;
}

function abrirVisorPlanosEnPin(filaId, filaTipo) {
  const planoConPin = PLANOS.find(p => (p.pines || []).some(pin => pin.filaId === filaId && pin.filaTipo === filaTipo));
  if (!planoConPin) { abrirVisorPlanos(); return; }
  PLANO_ACTIVO_ID = planoConPin.id;
  PLANO_CAPA_INFORME = null;
  PLANO_ZOOM = calcularZoomAjustado(planoConPin);
  const pan = calcularPanCentrado(planoConPin, PLANO_ZOOM);
  PLANO_PAN_X = pan.x; PLANO_PAN_Y = pan.y;
  PLANO_VISTA = "visor";
  PLANO_MODO = "mano";
  PLANO_PIN_CONTEXTO = null;
  let overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "planos-visor-overlay";
    overlay.className = "planos-visor-overlay";
    document.body.appendChild(overlay);
  }
  document.body.classList.add("modal-open");
  renderVisorPlanos();
  // Hacer scroll hasta el pin (esperar un frame para que el DOM esté listo)
  requestAnimationFrame(() => {
    const pin = (planoConPin.pines || []).find(p => p.filaId === filaId && p.filaTipo === filaTipo);
    if (!pin) return;
    const wrap = document.getElementById("planos-canvas-wrap");
    if (!wrap) return;
    const posic = document.getElementById("planos-posicionador");
    if (!posic) return;
    const pinX = pin.xFrac * planoConPin.width * PLANO_ZOOM + PLANO_PAN_X;
    const pinY = pin.yFrac * planoConPin.height * PLANO_ZOOM + PLANO_PAN_Y;
    const wRect = wrap.getBoundingClientRect();
    PLANO_PAN_X += wRect.width / 2 - pinX;
    PLANO_PAN_Y += wRect.height / 2 - pinY;
    posic.style.transform = `translate(${PLANO_PAN_X}px,${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
  });
}

function colocarPin(plano, frac) {
  let nota = "";
  let filaId = null;
  let filaTipo = null;

  if (PLANO_PIN_CONTEXTO) {
    if (PLANO_PIN_CONTEXTO.borrador && PLANO_PIN_CONTEXTO.onColocar) {
      PLANO_PIN_CONTEXTO.onColocar({ planoId: plano.id, xFrac: frac.xFrac, yFrac: frac.yFrac });
      cerrarVisorPlanos();
      return;
    }
    filaId = PLANO_PIN_CONTEXTO.filaId;
    filaTipo = PLANO_PIN_CONTEXTO.filaTipo;
  } else {
    nota = prompt("Nota para el pin (opcional):") || "";
  }

  // Para pines de Levantamiento: eliminar cualquier pin previo vinculado a la
  // misma fila (en cualquier plano) antes de colocar el nuevo. Así hay siempre
  // máximo 1 pin por fila.
  const pin = { id: Date.now(), xFrac: frac.xFrac, yFrac: frac.yFrac, nota, filaId, filaTipo, color: PLANO_COLOR_PIN };
  if (pin.filaId != null) {
    for (const p of PLANOS) {
      p.pines = (p.pines || []).filter(existente => !(existente.filaId === pin.filaId && existente.filaTipo === pin.filaTipo));
    }
  }
  planoPushUndo(plano);
  plano.pines.push(pin);
  marcarCambio();
  if (PLANO_PIN_CONTEXTO) {
    mostrarToast("Pin vinculado a la fila.");
    cerrarVisorPlanos();
  } else {
    renderVisorPlanos();
  }
}

// Crea de verdad un pin ya vinculado a una fila real (se usa al confirmar un
// pin "pendiente" en el momento en que la fila se guarda y recibe su _id).
function confirmarPinPendiente(pendiente, filaId, filaTipo) {
  const plano = PLANOS.find(p => p.id === pendiente.planoId);
  if (!plano) return;
  plano.pines.push({ id: Date.now(), xFrac: pendiente.xFrac, yFrac: pendiente.yFrac, filaId, filaTipo, nota: "" });
  marcarCambio();
}

function borrarPin(plano, pinId) {
  planoPushUndo(plano);
  plano.pines = plano.pines.filter(p => p.id !== pinId);
  marcarCambio();
  renderVisorPlanos();
}

// --- Generación de PDF del plano anotado ---
// (imagen del plano ya rasterizado a 150dpi con sus marcas/pines dibujados
// encima, exportado como PDF tamaño carta con membrete de Superba)
async function exportarPlanosPDF() {
  const plano = planoActivo();
  if (!plano) return;
  if (!window.jspdf) { mostrarToast("No se pudo cargar el motor de PDF.", "error"); return; }
  const toastId = mostrarToastProgreso("Generando PDF del plano…");
  try {
    const { jsPDF } = window.jspdf;
    // Orientación: si el plano es más ancho que alto → apaisado; si no → portrait.
    const esPaisaje = plano.width > plano.height;
    const doc = new jsPDF({ unit: "pt", format: "letter", orientation: esPaisaje ? "landscape" : "portrait" });
    const titulo = plano.nombre;
    const safe = window.dibujarLetterheadPDF ? window.dibujarLetterheadPDF(doc, titulo) : { top: 120, bottom: 720 };
    const disponibleW = doc.internal.pageSize.getWidth() - 72;
    const disponibleH = safe.bottom - safe.top;
    // Dibujar la imagen del plano con las marcas superpuestas en un canvas temporal
    const imgData = await dibujarPlanoEnCanvas(plano);
    const escalaW = disponibleW / plano.width;
    const escalaH = disponibleH / plano.height;
    const escala = Math.min(escalaW, escalaH);
    const w = plano.width * escala, h = plano.height * escala;
    const x = 36 + (disponibleW - w) / 2;
    const y = safe.top + (disponibleH - h) / 2;
    doc.addImage(imgData, "JPEG", x, y, w, h);
    if (window.dibujarNumeroPaginaPDF) dibujarNumeroPaginaPDF(doc, 1, 1);
    doc.save(`Plano-${plano.nombre.replace(/[^a-z0-9]+/gi, "-")}.pdf`);
    mostrarToast("PDF del plano generado.");
  } catch (err) {
    mostrarToast("No se pudo generar el PDF: " + err.message, "error");
  } finally {
    ocultarToastProgreso(toastId);
  }
}

// Dibuja el plano + sus trazos/pines en un canvas temporal (para que el PDF
// tenga una sola imagen en vez de vectores separados; evita problemas de
// clip/opacity con jsPDF).
function dibujarPlanoEnCanvas(plano) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = plano.width;
    canvas.height = plano.height;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const W = plano.width, H = plano.height;

      // Rectángulos
      (plano.rectangulos || []).forEach(r => {
        ctx.save();
        ctx.strokeStyle = r.color; ctx.lineWidth = r.grosor || 2;
        if (r.relleno) {
          ctx.fillStyle = r.color;
          ctx.globalAlpha = r.opacidad || 0.3;
          ctx.fillRect(r.x1 * W, r.y1 * H, (r.x2 - r.x1) * W, (r.y2 - r.y1) * H);
          ctx.globalAlpha = 1;
        }
        ctx.strokeRect(r.x1 * W, r.y1 * H, (r.x2 - r.x1) * W, (r.y2 - r.y1) * H);
        ctx.restore();
      });
      // Líneas
      (plano.lineas || []).forEach(l => {
        ctx.save();
        ctx.strokeStyle = l.color; ctx.lineWidth = l.grosor || 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(l.x1 * W, l.y1 * H);
        ctx.lineTo(l.x2 * W, l.y2 * H);
        ctx.stroke();
        ctx.restore();
      });
      // Trazos
      (plano.trazos || []).forEach(t => {
        if (!t.puntos || t.puntos.length < 2) return;
        ctx.save();
        ctx.strokeStyle = t.color; ctx.lineWidth = t.grosor || 2;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (t.esResaltador) ctx.globalAlpha = t.opacidad || 0.35;
        ctx.beginPath();
        t.puntos.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.xFrac * W, p.yFrac * H);
          else ctx.lineTo(p.xFrac * W, p.yFrac * H);
        });
        ctx.stroke();
        ctx.restore();
      });
      // Cotas
      (plano.cotas || []).forEach(c => {
        const x1 = c.x1 * W, y1 = c.y1 * H, x2 = c.x2 * W, y2 = c.y2 * H;
        ctx.save();
        ctx.strokeStyle = "#0072ce"; ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#0072ce";
        [[x1, y1], [x2, y2]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill(); });
        const texto = textoCota(plano, c);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        ctx.font = "bold 13px Arial, sans-serif"; ctx.fillStyle = "#0072ce"; ctx.textAlign = "center";
        ctx.fillText(texto, mx, my - 6);
        ctx.restore();
      });
      // Pines
      (plano.pines || []).forEach((pin, i) => {
        const px = pin.xFrac * W, py = pin.yFrac * H;
        ctx.save();
        ctx.fillStyle = pin.color || "#e2001a";
        ctx.beginPath(); ctx.arc(px, py - 6, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center";
        ctx.fillText(String(i + 1), px, py - 3);
        ctx.restore();
      });
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = plano.dataUrl;
  });
}

// sería lento); recién al soltar se guarda el trazo completo en plano.trazos.
function distanciaPuntoASegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const largo2 = dx * dx + dy * dy;
  let t = largo2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / largo2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

let PLANO_UNDO_STACK = [];
let PLANO_REDO_STACK = [];

function snapshotPlano(plano) {
  return {
    planoId: plano.id,
    pines: JSON.parse(JSON.stringify(plano.pines)),
    trazos: JSON.parse(JSON.stringify(plano.trazos)),
    rectangulos: JSON.parse(JSON.stringify(plano.rectangulos || [])),
    lineas: JSON.parse(JSON.stringify(plano.lineas || [])),
    cotas: JSON.parse(JSON.stringify(plano.cotas || [])),
  };
}

function planoPushUndo(plano) {
  PLANO_UNDO_STACK.push(snapshotPlano(plano));
  if (PLANO_UNDO_STACK.length > 25) PLANO_UNDO_STACK.shift();
  // Cualquier acción nueva invalida el historial de "rehacer" — igual que en
  // cualquier editor (Word, Photoshop, etc.): no tiene sentido rehacer algo
  // viejo si mientras tanto ya dibujaste otra cosa distinta.
  PLANO_REDO_STACK = [];
}

// Aplica un snapshot restaurado — en modo capa escribe en planoRef;
// en modo normal escribe en el plano real.
function aplicarSnapshot(snap) {
  if (PLANO_CAPA_INFORME) {
    const ref = PLANO_CAPA_INFORME.planoRef;
    ref.pines = snap.pines;
    ref.trazos = snap.trazos;
    ref.rectangulos = snap.rectangulos || [];
    ref.lineas = snap.lineas || [];
    ref.cotas = snap.cotas || [];
  } else {
    const plano = PLANOS.find(p => p.id === snap.planoId);
    if (!plano) return;
    plano.pines = snap.pines;
    plano.trazos = snap.trazos;
    plano.rectangulos = snap.rectangulos || [];
    plano.lineas = snap.lineas || [];
    plano.cotas = snap.cotas || [];
  }
  marcarCambio();
}

function planoDeshacer() {
  const snap = PLANO_UNDO_STACK.pop();
  if (!snap) { mostrarToast("No hay nada para deshacer en el plano."); return; }
  const actual = planoActivo();
  if (actual) {
    PLANO_REDO_STACK.push(snapshotPlano(actual));
    if (PLANO_REDO_STACK.length > 25) PLANO_REDO_STACK.shift();
  }
  aplicarSnapshot(snap);
  renderVisorPlanos();
}

function planoRehacer() {
  const snap = PLANO_REDO_STACK.pop();
  if (!snap) { mostrarToast("No hay nada para rehacer en el plano."); return; }
  const actual = planoActivo();
  if (actual) {
    PLANO_UNDO_STACK.push(snapshotPlano(actual));
    if (PLANO_UNDO_STACK.length > 25) PLANO_UNDO_STACK.shift();
  }
  aplicarSnapshot(snap);
  renderVisorPlanos();
}

// Modo "Borrador": tocar/arrastrar cerca de un trazo lo borra (el trazo
// entero, no un pedacito — más simple y predecible que borrar por tramos).
function distPuntoATrazo(px, py, trazo, W, H) {
  let minDist = Infinity;
  for (let i = 0; i < trazo.puntos.length - 1; i++) {
    const x1 = trazo.puntos[i].xFrac * W, y1 = trazo.puntos[i].yFrac * H;
    const x2 = trazo.puntos[i + 1].xFrac * W, y2 = trazo.puntos[i + 1].yFrac * H;
    const d = distanciaPuntoASegmento(px, py, x1, y1, x2, y2);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-abrir-planos");
  if (btn) btn.addEventListener("click", () => abrirVisorPlanos());
});

// --- Exports usados por otros módulos ---
window.abrirVisorPlanos = abrirVisorPlanos;
window.abrirVisorPlanosConCapaInforme = abrirVisorPlanosConCapaInforme;
window.abrirVisorPlanosEnPin = abrirVisorPlanosEnPin;
window.exportarPlanosPDF = exportarPlanosPDF;
window.confirmarPinPendiente = confirmarPinPendiente;
})();
