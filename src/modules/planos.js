// ============================================================================
// planos.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
// PLANOS y PLANO_SEQ se declaran fuera del IIFE a propósito (con `var`, no `let`).
// El guardado/carga de proyecto les hace reasignación directa (ej.
// `PLANOS = data.planos || []` al importar), no solo mutación -- ver la nota
// igual en ui-tabla-calculadora.js sobre por qué esto es necesario. Si quedaran
// como `let` acá adentro, esa reasignación externa crearía una copia global
// desconectada de la que este módulo sigue usando internamente.
var PLANOS = [];
var PLANO_SEQ = 1;

(function () {
// ============================================================================
// planos.js
// Planos de referencia: subir un PDF, rasterizarlo a 150dpi, verlo con pan/zoom,
// marcar el recorrido a mano alzada, y colocar pines (libres o vinculados a una
// fila de Levantamiento).
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// Resolución fija a la que se rasteriza TODO plano subido, sin importar el
// peso/tipo del PDF original — decisión tomada tras probar 3 PDFs reales de
// Kevin (ver guía de continuidad): 150dpi se ve nítido en un visor real
// (Fotos/Adobe) incluso con zoom agresivo, y es la resolución que unifica el
// comportamiento sin tener que medir y decidir caso por caso.
const PLANO_DPI = 150;

// Estado del visor (vive mientras el modal está abierto, no se guarda con el proyecto).
let PLANO_ACTIVO_ID = null;
let PLANO_MODO = "mano"; // "mano" | "marcador" | "punto"
let PLANO_COLOR_MARCADOR = "#e2001a";
// Paleta básica para lápiz/marcador — colores comunes en anotación de planos.
const PLANO_PALETA_COLORES = ["#e2001a", "#ff9900", "#ffe100", "#00a651", "#0072ce", "#111111"];
// Grosor seleccionable — es un multiplicador sobre el grosorFactor base de
// cada herramienta (ver TRAZO_ESTILOS), así "fino"/"medio"/"grueso" tienen
// sentido relativo tanto para el lápiz como para el marcador.
let PLANO_GROSOR = 1;
let PLANO_RECT_RELLENO = false;
let PLANO_RECT_OPACIDAD = 0.3;
const PLANO_OPACIDADES = [
  { valor: 0.15, nombre: "Muy transparente" },
  { valor: 0.3, nombre: "Transparente" },
  { valor: 0.6, nombre: "Semi-opaco" },
  { valor: 1, nombre: "Opaco" },
];
// Estado del punto A al dibujar una línea, o al calibrar/medir (necesitan 2
// toques en vez del arrastre continuo que usan lápiz/marcador/rectángulo).
let PLANO_PUNTO_A = null; // { xFrac, yFrac } o null
const PLANO_GROSORES = [
  { valor: 0.15, nombre: "Muy fino", puntoPx: 3 },
  { valor: 0.3, nombre: "Extra fino", puntoPx: 4 },
  { valor: 0.5, nombre: "Fino", puntoPx: 6 },
  { valor: 1, nombre: "Medio", puntoPx: 10 },
  { valor: 2, nombre: "Grueso", puntoPx: 14 },
];
// Lápiz: trazo fino, opaco — para apuntes/detalle. Marcador: trazo grueso,
// semitransparente tipo resaltador — para señalar recorridos/zonas.
const TRAZO_ESTILOS = {
  lapiz: { grosorFactor: 0.004, opacidad: 1 },
  resaltador: { grosorFactor: 0.016, opacidad: 0.35 },
};
let PLANO_ZOOM = 1;
let PLANO_PAN_X = 0;
let PLANO_PAN_Y = 0;
// Si se abrió el visor desde el formulario de una fila (botón "Vincular punto
// en plano"), acá queda el contexto — el próximo pin que se coloque se vincula
// automático a esa fila, sin preguntar "nota libre o vincular".
let PLANO_PIN_CONTEXTO = null; // { filaId, filaTipo } o null

// --- Utilidades de arrastre/zoom (puntero + rueda + pellizco de 2 dedos) ---
let PLANO_DRAG_ACTIVO = false;
let PLANO_DRAG_ULTIMO_X = 0;
let PLANO_DRAG_ULTIMO_Y = 0;
let PLANO_PINCH_DIST_INICIAL = null;
let PLANO_PINCH_ZOOM_INICIAL = 1;
const PLANO_PUNTEROS_ACTIVOS = new Map();

function esperarPdfJsListo() {
  return new Promise((resolve, reject) => {
    let intentos = 0;
    const check = () => {
      if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
      intentos++;
      if (intentos > 100) { reject(new Error("PDF.js no cargó a tiempo.")); return; }
      setTimeout(check, 50);
    };
    check();
  });
}

// Convierte un canvas a dataURL sin bloquear el hilo principal — toDataURL()
// es sincrónico y en un canvas grande (un plano a 150dpi puede ser ~30
// megapíxeles) puede tardar varios segundos trabados, lo que en el celular se
// sentiría como que la app se congeló. canvas.toBlob() es asíncrono y evita eso.
function canvasADataUrlAsync(canvas, tipo, calidad) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("No se pudo generar la imagen del plano.")); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer la imagen generada."));
      reader.readAsDataURL(blob);
    }, tipo, calidad);
  });
}

// Sube un PDF, lo rasteriza a PLANO_DPI (siempre, sin excepción — ver nota
// arriba) y lo agrega a PLANOS como WebP. Devuelve el plano nuevo.
async function subirPlano(file) {
  const pdfjsLib = await esperarPdfJsListo();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
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
    escala: null, // { pxPorCm: number } — se llena al calibrar (ver "Regla y calibración")
  };
  PLANOS.push(plano);
  return plano;
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
  if (opts.filaId != null) {
    PLANO_PIN_CONTEXTO = { filaId: opts.filaId, filaTipo: opts.filaTipo || "penetrante" };
  } else if (opts.borrador) {
    PLANO_PIN_CONTEXTO = { borrador: true, onColocar: opts.onColocar };
  } else {
    PLANO_PIN_CONTEXTO = null;
  }
  PLANO_MODO = PLANO_PIN_CONTEXTO ? "punto" : "mano";
  const ordenados = planosOrdenados();
  PLANO_ACTIVO_ID = ordenados.length ? ordenados[0].id : null;
  const plano0 = planoActivo();
  PLANO_ZOOM = plano0 ? calcularZoomAjustado(plano0) : 1;
  const pan0 = plano0 ? calcularPanCentrado(plano0, PLANO_ZOOM) : { x: 0, y: 0 };
  PLANO_PAN_X = pan0.x; PLANO_PAN_Y = pan0.y;

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
}

function planoActivo() {
  return PLANOS.find(p => p.id === PLANO_ACTIVO_ID) || null;
}

// Lista de planos ordenada alfabéticamente por nombre — se usa en todos los
// lugares donde se enumeran/listan planos (selector de hoja, etc.), sin
// reordenar el array PLANOS real (no hace falta, y evita mover referencias).
function planosOrdenados() {
  return PLANOS.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

// Calcula el zoom inicial para que el plano completo entre en pantalla (menos
// el alto aproximado de la barra superior + la barra de herramientas), en vez
// de arrancar siempre al 100% (que para un plano de varios miles de píxeles
// de ancho es solo una esquina).
function calcularZoomAjustado(plano) {
  const ALTO_BARRAS_APROX = 110;
  const availW = Math.max(200, window.innerWidth - 20);
  const availH = Math.max(200, window.innerHeight - ALTO_BARRAS_APROX);
  const z = Math.min(availW / plano.width, availH / plano.height);
  return Math.max(0.05, Math.min(z, 3));
}

// Centra el plano en pantalla al zoom dado — si el plano no llena el ancho
// completo del área disponible (o el alto), reparte el espacio sobrante en
// vez de dejarlo pegado a la esquina superior izquierda.
function calcularPanCentrado(plano, zoom) {
  const ALTO_BARRAS_APROX = 110;
  const availW = Math.max(200, window.innerWidth - 20);
  const availH = Math.max(200, window.innerHeight - ALTO_BARRAS_APROX);
  const contentW = plano.width * zoom;
  const contentH = plano.height * zoom;
  return {
    x: Math.max(0, (availW - contentW) / 2),
    y: Math.max(0, (availH - contentH) / 2),
  };
}

const PLANO_ZOOM_MAX = 8;

// Ajusta el zoom manteniendo fijo el punto de la imagen que está bajo
// (clientX, clientY) — así el zoom "crece desde donde está el dedo/cursor"
// en vez de siempre hacia la esquina superior izquierda.
function aplicarZoomCentrado(nuevoZoom, clientX, clientY) {
  const wrap = document.getElementById("planos-canvas-wrap");
  const plano = planoActivo();
  if (!wrap || !plano) { PLANO_ZOOM = nuevoZoom; return; }
  const zoomMin = Math.min(0.05, calcularZoomAjustado(plano));
  nuevoZoom = Math.max(zoomMin, Math.min(PLANO_ZOOM_MAX, nuevoZoom));
  const rect = wrap.getBoundingClientRect();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;
  const contentX = (screenX - PLANO_PAN_X) / PLANO_ZOOM;
  const contentY = (screenY - PLANO_PAN_Y) / PLANO_ZOOM;
  PLANO_ZOOM = nuevoZoom;
  PLANO_PAN_X = screenX - contentX * PLANO_ZOOM;
  PLANO_PAN_Y = screenY - contentY * PLANO_ZOOM;
}

function centroDelWrap() {
  const wrap = document.getElementById("planos-canvas-wrap");
  if (!wrap) return { x: 0, y: 0 };
  const rect = wrap.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Pantalla de carga simple mientras se rasteriza un PDF — el paso de codificar
// la imagen final puede tardar varios segundos en un plano grande (ver nota en
// canvasADataUrlAsync), así que sin esto el celular parecería trabado.
function mostrarCargandoPlano(mostrar) {
  const overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) return;
  let cargando = document.getElementById("planos-cargando");
  if (mostrar) {
    if (!cargando) {
      cargando = document.createElement("div");
      cargando.id = "planos-cargando";
      cargando.className = "planos-cargando";
      cargando.innerHTML = `<div class="planos-spinner"></div><p>Procesando plano… puede tardar varios segundos</p>`;
      overlay.appendChild(cargando);
    }
  } else if (cargando) {
    cargando.remove();
  }
}

// Cursor por herramienta — que el puntero del mouse muestre la herramienta
// activa en vez de siempre la manita, para saber de un vistazo qué modo está
// puesto sin mirar la barra. "Mano"/formas usan cursores nativos del navegador
// (grab/crosshair, sin costo y con soporte garantizado); lápiz/marcador/
// borrador usan un ícono chico armado a mano (blanco con contorno negro, para
// que se vea tanto sobre el plano claro como sobre el fondo gris del visor).
function cursorSVG(pathD, hotspotX, hotspotY, viewBox) {
  const vb = viewBox || "0 0 24 24";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='${vb}'>` +
    `<g fill='none' stroke='white' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'>${pathD}</g>` +
    `<g fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>${pathD}</g>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}`;
}
const PLANO_CURSORES = {
  lapiz: cursorSVG('<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 3, 22) + ", crosshair",
  resaltador: cursorSVG('<path d="M14.5 3.5a2 2 0 0 1 2.83 0l3.17 3.17a2 2 0 0 1 0 2.83L9.5 20.5H3v-6.5Z"/>', 3, 22) + ", crosshair",
  borrador: cursorSVG('<g transform="rotate(-12 12 12.5)"><rect x="4" y="8" width="16" height="9" rx="2.5"/></g>', 12, 13) + ", crosshair",
};
function cursorParaModo(modo) {
  if (modo === "mano") return "grab";
  if (PLANO_CURSORES[modo]) return PLANO_CURSORES[modo];
  // rectángulo, línea, pin, calibrar, regla: cursor nativo de precisión.
  return "crosshair";
}

function renderVisorPlanos() {
  const overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) return;
  const plano = planoActivo();

  overlay.innerHTML = `
    <div class="planos-visor-topbar">
      <button type="button" id="planos-btn-cerrar" class="lev-exit-btn"><svg class="icon"><use href="#i-arrow-left"/></svg>Cerrar</button>
      ${PLANOS.length ? `
        <select id="planos-select-hoja" class="planos-select-hoja">
          ${planosOrdenados().map(p => `<option value="${p.id}" ${p.id === PLANO_ACTIVO_ID ? "selected" : ""}>${escapeHtml(p.nombre)}</option>`).join("")}
        </select>
        <button type="button" id="planos-btn-renombrar" class="planos-btn-icono" aria-label="Renombrar plano" title="Renombrar plano"><svg class="icon"><use href="#i-edit"/></svg></button>
      ` : `<span class="planos-visor-title">Planos</span>`}
      <label class="planos-btn-subir">
        <svg class="icon"><use href="#i-upload"/></svg><span class="planos-btn-subir-label">Subir plano</span>
        <input type="file" accept="application/pdf" id="planos-input-subir" class="lev-foto-input-oculto">
      </label>
    </div>
    ${plano ? `
      <div class="planos-toolbar">
        <div class="planos-modo-group">
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "mano" ? "planos-modo-active" : ""}" data-planos-modo="mano" title="Mover"><svg class="icon"><use href="#i-move"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "lapiz" ? "planos-modo-active" : ""}" data-planos-modo="lapiz" title="Lápiz (apuntes)"><svg class="icon"><use href="#i-edit"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "resaltador" ? "planos-modo-active" : ""}" data-planos-modo="resaltador" title="Marcador"><svg class="icon"><use href="#i-highlighter"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "rectangulo" ? "planos-modo-active" : ""}" data-planos-modo="rectangulo" title="Recuadro"><svg class="icon"><use href="#i-rectangle"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "linea" ? "planos-modo-active" : ""}" data-planos-modo="linea" title="Línea recta"><svg class="icon"><use href="#i-line"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "punto" ? "planos-modo-active" : ""}" data-planos-modo="punto" title="Pin"><svg class="icon"><use href="#i-pin"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "calibrar" ? "planos-modo-active" : ""}" data-planos-modo="calibrar" title="Calibrar escala"><svg class="icon"><use href="#i-calibrate"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "regla" ? "planos-modo-active" : ""}" data-planos-modo="regla" title="Medir"><svg class="icon"><use href="#i-ruler"/></svg></button>
          <button type="button" class="planos-modo-btn ${PLANO_MODO === "borrador" ? "planos-modo-active" : ""}" data-planos-modo="borrador" title="Borrador (toca un trazo para quitarlo)"><svg class="icon"><use href="#i-eraser"/></svg></button>
        </div>
        ${(PLANO_MODO === "lapiz" || PLANO_MODO === "resaltador" || PLANO_MODO === "rectangulo" || PLANO_MODO === "linea") ? `
          <div class="planos-color-group">
            ${PLANO_PALETA_COLORES.map(c => `<button type="button" class="planos-color-swatch ${c === PLANO_COLOR_MARCADOR ? "planos-color-activo" : ""}" data-planos-color="${c}" style="background:${c};" aria-label="Color ${c}"></button>`).join("")}
          </div>
          <div class="planos-grosor-group">
            ${PLANO_GROSORES.map(g => `<button type="button" class="planos-grosor-btn ${g.valor === PLANO_GROSOR ? "planos-grosor-activo" : ""}" data-planos-grosor="${g.valor}" aria-label="${g.nombre}" title="${g.nombre}"><span style="width:${g.puntoPx}px; height:${g.puntoPx}px;"></span></button>`).join("")}
          </div>
        ` : ""}
        ${PLANO_MODO === "rectangulo" ? `
          <div class="planos-relleno-group">
            <label class="planos-relleno-check">
              <input type="checkbox" id="planos-relleno-check" ${PLANO_RECT_RELLENO ? "checked" : ""}>
              Relleno
            </label>
            ${PLANO_RECT_RELLENO ? `
              <div class="planos-grosor-group">
                ${PLANO_OPACIDADES.map(o => `<button type="button" class="planos-grosor-btn ${o.valor === PLANO_RECT_OPACIDAD ? "planos-grosor-activo" : ""}" data-planos-opacidad="${o.valor}" title="${o.nombre}"><span style="opacity:${o.valor};background:currentColor;width:14px;height:14px;border-radius:3px;"></span></button>`).join("")}
              </div>
            ` : ""}
          </div>
        ` : ""}
        ${PLANO_PIN_CONTEXTO ? `<span class="planos-vinculo-hint">Tocá el plano para ubicar esta fila</span>` : ""}
        ${PLANO_MODO === "calibrar" ? `<span class="planos-vinculo-hint">${plano.escala ? "Tocá 2 puntos para volver a calibrar" : "Tocá 2 puntos de distancia conocida"}</span>` : ""}
        ${PLANO_MODO === "regla" ? `<span class="planos-vinculo-hint">${plano.escala ? "Tocá 2 puntos para medir" : "Primero calibrá la escala de este plano"}</span>` : ""}
        <button type="button" id="planos-btn-deshacer" class="planos-btn-icono" aria-label="Deshacer" title="Deshacer última acción en el plano">↩️</button>
        <div class="planos-zoom-group">
          <button type="button" id="planos-zoom-menos" aria-label="Alejar">−</button>
          <button type="button" id="planos-zoom-reset" aria-label="Restablecer zoom">${Math.round(PLANO_ZOOM * 100)}%</button>
          <button type="button" id="planos-zoom-mas" aria-label="Acercar">+</button>
        </div>
      </div>
      <div class="planos-canvas-wrap" id="planos-canvas-wrap">
        <div class="planos-canvas-inner" id="planos-canvas-inner" style="transform: translate(${PLANO_PAN_X}px, ${PLANO_PAN_Y}px) scale(${PLANO_ZOOM});">
          <img src="${plano.dataUrl}" class="planos-img" id="planos-img" draggable="false" alt="${escapeHtml(plano.nombre)}">
          <svg class="planos-svg-overlay" id="planos-svg-overlay" viewBox="0 0 ${plano.width} ${plano.height}" preserveAspectRatio="none">
            ${(plano.rectangulos || []).map(r => {
              const grosor = r.grosor || 1;
              return `<rect x="${r.xFrac * plano.width}" y="${r.yFrac * plano.height}" width="${r.wFrac * plano.width}" height="${r.hFrac * plano.height}" fill="${r.relleno ? r.color : "none"}" fill-opacity="${r.relleno ? r.opacidadRelleno : 0}" stroke="${r.color}" stroke-width="${Math.max(plano.width, plano.height) * 0.004 * grosor}" data-planos-forma-id="${r.id}" data-planos-forma-tipo="rectangulo"/>`;
            }).join("")}
            ${(plano.lineas || []).map(l => {
              const grosor = l.grosor || 1;
              return `<line x1="${l.x1Frac * plano.width}" y1="${l.y1Frac * plano.height}" x2="${l.x2Frac * plano.width}" y2="${l.y2Frac * plano.height}" stroke="${l.color}" stroke-width="${Math.max(plano.width, plano.height) * 0.005 * grosor}" stroke-linecap="round" data-planos-forma-id="${l.id}" data-planos-forma-tipo="linea"/>`;
            }).join("")}
            ${(plano.trazos || []).map(t => {
              const estilo = TRAZO_ESTILOS[t.tipo] || TRAZO_ESTILOS.lapiz;
              const grosor = t.grosor || 1;
              return `<polyline points="${t.puntos.map(pt => `${pt.xFrac * plano.width},${pt.yFrac * plano.height}`).join(" ")}" fill="none" stroke="${t.color}" stroke-opacity="${estilo.opacidad}" stroke-width="${Math.max(plano.width, plano.height) * estilo.grosorFactor * grosor}" stroke-linecap="round" stroke-linejoin="round"/>`;
            }).join("")}
          </svg>
          <div class="planos-pines-layer">
            ${(plano.pines || []).map((pin, i) => `
              <button type="button" class="planos-pin" data-planos-pin-id="${pin.id}" style="left:${pin.xFrac * 100}%; top:${pin.yFrac * 100}%;" title="${escapeHtml(pin.nota || (pin.filaId != null ? "Vinculado a fila" : "Nota"))}"><span>${i + 1}</span></button>
            `).join("")}
          </div>
        </div>
      </div>
    ` : `
      <div class="planos-vacio">
        <p>Todavía no subiste ningún plano.</p>
        <label class="lev-foto-btn" for="planos-input-subir-vacio">
          <svg class="icon"><use href="#i-upload"/></svg>Subir el primer plano (PDF)
        </label>
        <input type="file" accept="application/pdf" id="planos-input-subir-vacio" class="lev-foto-input-oculto">
      </div>
    `}
  `;

  attachVisorPlanosEvents(overlay);
  const wrapCursor = document.getElementById("planos-canvas-wrap");
  if (wrapCursor) wrapCursor.style.cursor = cursorParaModo(PLANO_MODO);
}

function attachVisorPlanosEvents(overlay) {
  const btnCerrar = document.getElementById("planos-btn-cerrar");
  if (btnCerrar) btnCerrar.addEventListener("click", cerrarVisorPlanos);

  const selectHoja = document.getElementById("planos-select-hoja");
  if (selectHoja) selectHoja.addEventListener("change", () => {
    PLANO_ACTIVO_ID = parseInt(selectHoja.value, 10);
    const p = planoActivo();
    PLANO_ZOOM = p ? calcularZoomAjustado(p) : 1;
    const pan = p ? calcularPanCentrado(p, PLANO_ZOOM) : { x: 0, y: 0 };
    PLANO_PAN_X = pan.x; PLANO_PAN_Y = pan.y;
    renderVisorPlanos();
  });
  const btnRenombrar = document.getElementById("planos-btn-renombrar");
  if (btnRenombrar) btnRenombrar.addEventListener("click", () => {
    const plano = planoActivo();
    if (!plano) return;
    const nuevoNombre = prompt("Nombre del plano:", plano.nombre);
    if (nuevoNombre && nuevoNombre.trim()) {
      plano.nombre = nuevoNombre.trim();
      marcarCambio();
      renderVisorPlanos();
    }
  });

  ["planos-input-subir", "planos-input-subir-vacio"].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      mostrarCargandoPlano(true);
      try {
        const plano = await subirPlano(file);
        PLANO_ACTIVO_ID = plano.id;
        PLANO_ZOOM = calcularZoomAjustado(plano);
        const panSubida = calcularPanCentrado(plano, PLANO_ZOOM);
        PLANO_PAN_X = panSubida.x; PLANO_PAN_Y = panSubida.y;
        marcarCambio();
      } catch (e) {
        mostrarToast("No se pudo procesar el PDF del plano.", "error");
      } finally {
        mostrarCargandoPlano(false);
        renderVisorPlanos();
      }
    });
  });

  document.querySelectorAll("[data-planos-modo]").forEach(btn => {
    btn.addEventListener("click", () => {
      PLANO_MODO = btn.dataset.planosModo;
      renderVisorPlanos();
    });
  });
  document.querySelectorAll("[data-planos-color]").forEach(btn => {
    btn.addEventListener("click", () => {
      PLANO_COLOR_MARCADOR = btn.dataset.planosColor;
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
  const btnDeshacer = document.getElementById("planos-btn-deshacer");
  if (btnDeshacer) btnDeshacer.addEventListener("click", planoDeshacer);


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
    PLANO_ZOOM = p ? calcularZoomAjustado(p) : 1;
    const panR = p ? calcularPanCentrado(p, PLANO_ZOOM) : { x: 0, y: 0 };
    PLANO_PAN_X = panR.x; PLANO_PAN_Y = panR.y;
    renderVisorPlanos();
  });

  const wrap = document.getElementById("planos-canvas-wrap");
  const inner = document.getElementById("planos-canvas-inner");
  if (wrap && inner) {
    wrap.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.10 : -0.10;
      aplicarZoomCentrado(PLANO_ZOOM + delta, e.clientX, e.clientY);
      inner.style.transform = `translate(${PLANO_PAN_X}px, ${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
      const zoomLabel = document.getElementById("planos-zoom-reset");
      if (zoomLabel) zoomLabel.textContent = Math.round(PLANO_ZOOM * 100) + "%";
    }, { passive: false });

    wrap.addEventListener("pointerdown", (e) => {
      PLANO_PUNTEROS_ACTIVOS.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Botón central del mouse: mover el plano sin importar qué herramienta
      // esté activa (lápiz, marcador, pin, borrador) — atajo universal, igual
      // que en la mayoría de apps de diseño.
      if (e.button === 1) {
        e.preventDefault();
        PLANO_DRAG_ACTIVO = true;
        PLANO_TRAZO_EN_CURSO = null;
        PLANO_DRAG_ULTIMO_X = e.clientX; PLANO_DRAG_ULTIMO_Y = e.clientY;
        wrap.style.cursor = "grabbing";
        return;
      }
      if (PLANO_PUNTEROS_ACTIVOS.size === 2) {
        const pts = Array.from(PLANO_PUNTEROS_ACTIVOS.values());
        PLANO_PINCH_DIST_INICIAL = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        PLANO_PINCH_ZOOM_INICIAL = PLANO_ZOOM;
        PLANO_DRAG_ACTIVO = false;
        PLANO_TRAZO_EN_CURSO = null;
      } else if (PLANO_MODO === "mano" && PLANO_PUNTEROS_ACTIVOS.size === 1) {
        PLANO_DRAG_ACTIVO = true;
        PLANO_DRAG_ULTIMO_X = e.clientX; PLANO_DRAG_ULTIMO_Y = e.clientY;
        wrap.style.cursor = "grabbing";
      } else if ((PLANO_MODO === "lapiz" || PLANO_MODO === "resaltador") && PLANO_PUNTEROS_ACTIVOS.size === 1) {
        iniciarTrazo(e);
      } else if ((PLANO_MODO === "rectangulo" || PLANO_MODO === "linea" || PLANO_MODO === "calibrar" || PLANO_MODO === "regla") && PLANO_PUNTEROS_ACTIVOS.size === 1) {
        iniciarForma(e, PLANO_MODO);
      } else if (PLANO_MODO === "borrador" && PLANO_PUNTEROS_ACTIVOS.size === 1) {
        borrarCercaDe(e);
      }
    });
    wrap.addEventListener("pointermove", (e) => {
      if (!PLANO_PUNTEROS_ACTIVOS.has(e.pointerId)) return;
      PLANO_PUNTEROS_ACTIVOS.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (PLANO_PUNTEROS_ACTIVOS.size === 2 && PLANO_PINCH_DIST_INICIAL) {
        const pts = Array.from(PLANO_PUNTEROS_ACTIVOS.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
        aplicarZoomCentrado(PLANO_PINCH_ZOOM_INICIAL * (dist / PLANO_PINCH_DIST_INICIAL), cx, cy);
        inner.style.transform = `translate(${PLANO_PAN_X}px, ${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
        return;
      }
      if (PLANO_DRAG_ACTIVO) {
        const dx = e.clientX - PLANO_DRAG_ULTIMO_X;
        const dy = e.clientY - PLANO_DRAG_ULTIMO_Y;
        PLANO_PAN_X += dx; PLANO_PAN_Y += dy;
        PLANO_DRAG_ULTIMO_X = e.clientX; PLANO_DRAG_ULTIMO_Y = e.clientY;
        inner.style.transform = `translate(${PLANO_PAN_X}px, ${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
      }
      if (PLANO_TRAZO_EN_CURSO) {
        continuarTrazo(e);
      }
      if (PLANO_FORMA_EN_CURSO) {
        continuarForma(e);
      }
      if (PLANO_MODO === "borrador" && PLANO_PUNTEROS_ACTIVOS.size === 1 && !PLANO_DRAG_ACTIVO) {
        borrarCercaDe(e);
      }
    });
    const soltarPuntero = (e) => {
      PLANO_PUNTEROS_ACTIVOS.delete(e.pointerId);
      if (PLANO_PUNTEROS_ACTIVOS.size < 2) PLANO_PINCH_DIST_INICIAL = null;
      if (PLANO_TRAZO_EN_CURSO) finalizarTrazo();
      if (PLANO_FORMA_EN_CURSO) finalizarForma(e);
      if (PLANO_PUNTEROS_ACTIVOS.size === 0) {
        PLANO_DRAG_ACTIVO = false;
        wrap.style.cursor = cursorParaModo(PLANO_MODO);
        const zoomLabel = document.getElementById("planos-zoom-reset");
        if (zoomLabel) zoomLabel.textContent = Math.round(PLANO_ZOOM * 100) + "%";
      }
    };
    wrap.addEventListener("pointerup", soltarPuntero);
    wrap.addEventListener("pointercancel", soltarPuntero);
    wrap.addEventListener("pointerleave", soltarPuntero);

    // Click simple (no arrastre) en modo "punto": coloca un pin en esa posición.
    const img = document.getElementById("planos-img");
    if (img) img.addEventListener("click", (e) => {
      if (PLANO_MODO !== "punto") return;
      const rect = img.getBoundingClientRect();
      const xFrac = (e.clientX - rect.left) / rect.width;
      const yFrac = (e.clientY - rect.top) / rect.height;
      colocarPin(xFrac, yFrac);
    });
  }

  // Tocar un pin ya colocado ofrece quitarlo (no importa el modo activo —
  // siempre se puede borrar un pin tocándolo directo).
  document.querySelectorAll("[data-planos-pin-id]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pin = pinBtnAPin(btn);
      if (!pin) return;
      if (confirm("¿Quitar este pin del plano?")) {
        quitarPin(pin.id);
      }
    });
  });
}

function pinBtnAPin(btn) {
  const plano = planoActivo();
  if (!plano) return null;
  const id = parseInt(btn.dataset.planosPinId, 10);
  return plano.pines.find(p => p.id === id) || null;
}

// Abre el visor ya centrado en el pin vinculado a una fila específica —
// usado desde el ícono de pin en la tabla Detallado de Levantamiento (mismo
// patrón que el ícono de fotos).
function abrirVisorPlanosEnPin(filaId, filaTipo) {
  let encontrado = null;
  for (const plano of PLANOS) {
    const pin = (plano.pines || []).find(p => p.filaId === filaId && p.filaTipo === filaTipo);
    if (pin) { encontrado = { plano, pin }; break; }
  }
  if (!encontrado) return;

  PLANO_PIN_CONTEXTO = null;
  PLANO_MODO = "mano";
  PLANO_ACTIVO_ID = encontrado.plano.id;
  PLANO_ZOOM = Math.min(Math.max(calcularZoomAjustado(encontrado.plano), 1.2), PLANO_ZOOM_MAX);

  let overlay = document.getElementById("planos-visor-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "planos-visor-overlay";
    overlay.className = "planos-visor-overlay";
    document.body.appendChild(overlay);
  }
  document.body.classList.add("modal-open");
  renderVisorPlanos();

  // Centrar el pan en el pin — se hace después de renderizar (necesita medir
  // el tamaño real del contenedor ya en el DOM).
  requestAnimationFrame(() => {
    const wrap = document.getElementById("planos-canvas-wrap");
    const inner = document.getElementById("planos-canvas-inner");
    if (!wrap || !inner) return;
    const rect = wrap.getBoundingClientRect();
    const contentX = encontrado.pin.xFrac * encontrado.plano.width;
    const contentY = encontrado.pin.yFrac * encontrado.plano.height;
    PLANO_PAN_X = rect.width / 2 - contentX * PLANO_ZOOM;
    PLANO_PAN_Y = rect.height / 2 - contentY * PLANO_ZOOM;
    inner.style.transform = `translate(${PLANO_PAN_X}px, ${PLANO_PAN_Y}px) scale(${PLANO_ZOOM})`;
  });
}

function quitarPin(pinId) {
  const plano = planoActivo();
  if (!plano) return;
  planoPushUndo(plano);
  plano.pines = plano.pines.filter(p => p.id !== pinId);
  marcarCambio();
  renderVisorPlanos();
}

// Exporta todos los planos guardados como un único PDF, una hoja por página
// (imagen del plano ya rasterizado a 150dpi con sus marcas/pines dibujados
// encima). Ojo: como el plano internamente ya es raster (no vectorial), este
// PDF de salida es esa imagen metida en un contenedor PDF — no recupera la
// nitidez del PDF original que se subió.
async function exportarPlanosPDF() {
  if (!PLANOS.length) {
    mostrarToast("No hay planos subidos todavía.", "error");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  for (let i = 0; i < PLANOS.length; i++) {
    const plano = PLANOS[i];
    if (i > 0) doc.addPage();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2 - 20; // deja espacio para el título
    const escala = Math.min(maxW / plano.width, maxH / plano.height);
    const w = plano.width * escala;
    const h = plano.height * escala;
    const x = (pageW - w) / 2;
    const y = margin + 20;
    doc.setFontSize(11);
    doc.text(plano.nombre, margin, margin + 10);
    const imgConMarcas = await dibujarPlanoConMarcasCanvas(plano);
    doc.addImage(imgConMarcas, "JPEG", x, y, w, h);
  }
  doc.save("planos.pdf");
}

// Dibuja el plano + sus trazos/pines en un canvas temporal (para que el PDF
// exportado los incluya, no solo la imagen pelada) y devuelve el dataURL.
function dibujarPlanoConMarcasCanvas(plano) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("No se pudo cargar la imagen del plano."));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = plano.width;
      canvas.height = plano.height;
      const ctx = canvas.getContext("2d");
      // Fondo blanco opaco antes de dibujar: el plano rasterizado puede tener
      // zonas transparentes, y JPEG (a diferencia de WebP) no soporta canal
      // alfa — sin esto, esas zonas saldrían negras en el PDF final.
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      (plano.rectangulos || []).forEach(r => {
        const x = r.xFrac * plano.width, y = r.yFrac * plano.height;
        const w = r.wFrac * plano.width, h = r.hFrac * plano.height;
        if (r.relleno) {
          ctx.globalAlpha = r.opacidadRelleno;
          ctx.fillStyle = r.color;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = r.color;
        ctx.lineWidth = Math.max(plano.width, plano.height) * 0.004 * (r.grosor || 1);
        ctx.strokeRect(x, y, w, h);
      });
      (plano.lineas || []).forEach(l => {
        ctx.strokeStyle = l.color;
        ctx.lineWidth = Math.max(plano.width, plano.height) * 0.005 * (l.grosor || 1);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(l.x1Frac * plano.width, l.y1Frac * plano.height);
        ctx.lineTo(l.x2Frac * plano.width, l.y2Frac * plano.height);
        ctx.stroke();
      });
      (plano.trazos || []).forEach(t => {
        const estilo = TRAZO_ESTILOS[t.tipo] || TRAZO_ESTILOS.lapiz;
        ctx.strokeStyle = t.color;
        ctx.globalAlpha = estilo.opacidad;
        ctx.lineWidth = Math.max(plano.width, plano.height) * estilo.grosorFactor * (t.grosor || 1);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        t.puntos.forEach((p, i) => {
          const px = p.xFrac * plano.width, py = p.yFrac * plano.height;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      (plano.pines || []).forEach((pin, i) => {
        const px = pin.xFrac * plano.width, py = pin.yFrac * plano.height;
        const r = Math.max(plano.width, plano.height) * 0.006;
        ctx.fillStyle = "#e2001a";
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = `${r}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), px, py);
      });
      canvasADataUrlAsync(canvas, "image/jpeg", 0.85).then(resolve).catch(reject);
    };
    img.src = plano.dataUrl;
  });
}


// --- Marcador (dibujo libre) — se dibuja en vivo sobre un <polyline> propio,
// manipulando el SVG directamente (sin re-render completo por cada punto, que
// sería lento); recién al soltar se guarda el trazo completo en plano.trazos.
let PLANO_TRAZO_EN_CURSO = null; // { puntos: [{xFrac,yFrac}], elemento: <polyline> }

function fraccionDesdeEvento(e) {
  const img = document.getElementById("planos-img");
  if (!img) return null;
  const rect = img.getBoundingClientRect();
  return { xFrac: (e.clientX - rect.left) / rect.width, yFrac: (e.clientY - rect.top) / rect.height };
}

// --- Rectángulo / Línea / Calibrar / Regla — todas usan el mismo gesto de
// arrastre (tocar en el punto A, arrastrar hasta el punto B, soltar), con
// una vista previa en vivo mientras se arrastra.
let PLANO_FORMA_EN_CURSO = null;

function iniciarForma(e, tipo) {
  const frac = fraccionDesdeEvento(e);
  const plano = planoActivo();
  const svg = document.getElementById("planos-svg-overlay");
  if (!frac || !plano || !svg) return;
  let el;
  if (tipo === "rectangulo") {
    el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    el.setAttribute("stroke", PLANO_COLOR_MARCADOR);
    el.setAttribute("stroke-width", String(Math.max(plano.width, plano.height) * 0.004 * PLANO_GROSOR));
    el.setAttribute("fill", PLANO_RECT_RELLENO ? PLANO_COLOR_MARCADOR : "none");
    if (PLANO_RECT_RELLENO) el.setAttribute("fill-opacity", String(PLANO_RECT_OPACIDAD));
  } else {
    el = document.createElementNS("http://www.w3.org/2000/svg", "line");
    el.setAttribute("stroke", tipo === "calibrar" ? "#5856D6" : tipo === "regla" ? "#34C759" : PLANO_COLOR_MARCADOR);
    el.setAttribute("stroke-width", String(Math.max(plano.width, plano.height) * 0.005));
    el.setAttribute("stroke-linecap", "round");
    if (tipo === "calibrar" || tipo === "regla") el.setAttribute("stroke-dasharray", String(Math.max(plano.width, plano.height) * 0.008) + "," + String(Math.max(plano.width, plano.height) * 0.005));
  }
  svg.appendChild(el);
  PLANO_FORMA_EN_CURSO = { tipo, inicio: frac, elemento: el, plano };
  actualizarForma(frac);
}

function actualizarForma(fracActual) {
  if (!PLANO_FORMA_EN_CURSO) return;
  const { tipo, inicio, elemento, plano } = PLANO_FORMA_EN_CURSO;
  if (tipo === "rectangulo") {
    const x0 = Math.min(inicio.xFrac, fracActual.xFrac) * plano.width;
    const y0 = Math.min(inicio.yFrac, fracActual.yFrac) * plano.height;
    const w = Math.abs(fracActual.xFrac - inicio.xFrac) * plano.width;
    const h = Math.abs(fracActual.yFrac - inicio.yFrac) * plano.height;
    elemento.setAttribute("x", x0); elemento.setAttribute("y", y0);
    elemento.setAttribute("width", w); elemento.setAttribute("height", h);
  } else {
    elemento.setAttribute("x1", inicio.xFrac * plano.width);
    elemento.setAttribute("y1", inicio.yFrac * plano.height);
    elemento.setAttribute("x2", fracActual.xFrac * plano.width);
    elemento.setAttribute("y2", fracActual.yFrac * plano.height);
  }
}

function continuarForma(e) {
  const frac = fraccionDesdeEvento(e);
  if (!frac || !PLANO_FORMA_EN_CURSO) return;
  actualizarForma(frac);
}

function finalizarForma(e) {
  if (!PLANO_FORMA_EN_CURSO) return;
  const { tipo, inicio, elemento, plano } = PLANO_FORMA_EN_CURSO;
  const fin = fraccionDesdeEvento(e) || inicio;
  elemento.remove();
  const distFrac = Math.hypot(fin.xFrac - inicio.xFrac, fin.yFrac - inicio.yFrac);
  PLANO_FORMA_EN_CURSO = null;
  if (distFrac < 0.006) { renderVisorPlanos(); return; } // gesto muy chico, probable toque accidental

  if (tipo === "rectangulo") {
    planoPushUndo(plano);
    plano.rectangulos.push({
      id: Date.now(),
      xFrac: Math.min(inicio.xFrac, fin.xFrac), yFrac: Math.min(inicio.yFrac, fin.yFrac),
      wFrac: Math.abs(fin.xFrac - inicio.xFrac), hFrac: Math.abs(fin.yFrac - inicio.yFrac),
      color: PLANO_COLOR_MARCADOR, grosor: PLANO_GROSOR,
      relleno: PLANO_RECT_RELLENO, opacidadRelleno: PLANO_RECT_OPACIDAD,
    });
    marcarCambio();
    renderVisorPlanos();
  } else if (tipo === "linea") {
    planoPushUndo(plano);
    plano.lineas.push({
      id: Date.now(),
      x1Frac: inicio.xFrac, y1Frac: inicio.yFrac, x2Frac: fin.xFrac, y2Frac: fin.yFrac,
      color: PLANO_COLOR_MARCADOR, grosor: PLANO_GROSOR,
    });
    marcarCambio();
    renderVisorPlanos();
  } else if (tipo === "calibrar") {
    procesarCalibracion(plano, inicio, fin);
  } else if (tipo === "regla") {
    procesarMedicion(plano, inicio, fin);
  }
}

function distanciaPx(plano, a, b) {
  const dx = (b.xFrac - a.xFrac) * plano.width;
  const dy = (b.yFrac - a.yFrac) * plano.height;
  return Math.hypot(dx, dy);
}

// Acepta "3.5m", "3,5 m", "250cm", "250" (asume metros si no se indica unidad).
function parsearDistancia(texto) {
  const t = texto.trim().toLowerCase().replace(",", ".");
  const m = t.match(/^([\d.]+)\s*(m|cm)?$/);
  if (!m) return null;
  const valor = parseFloat(m[1]);
  if (isNaN(valor) || valor <= 0) return null;
  const unidad = m[2] || "m";
  const cm = unidad === "cm" ? valor : valor * 100;
  return { cm, original: texto.trim() + (m[2] ? "" : " m") };
}

function procesarCalibracion(plano, a, b) {
  const px = distanciaPx(plano, a, b);
  const respuesta = prompt("Distancia real entre esos 2 puntos (ej: 3.5m o 250cm):", "");
  if (!respuesta) { renderVisorPlanos(); return; }
  const parsed = parsearDistancia(respuesta);
  if (!parsed) {
    mostrarToast("No se entendió la distancia. Usá algo como 3.5m o 250cm.", "error");
    renderVisorPlanos();
    return;
  }
  planoPushUndo(plano);
  plano.escala = { pxPorCm: px / parsed.cm };
  marcarCambio();
  mostrarToast(`Escala calibrada: ${parsed.original}`);
  renderVisorPlanos();
}

function procesarMedicion(plano, a, b) {
  if (!plano.escala) {
    mostrarToast("Este plano todavía no tiene escala calibrada — usá \"Calibrar\" primero.", "error");
    renderVisorPlanos();
    return;
  }
  const px = distanciaPx(plano, a, b);
  const cm = px / plano.escala.pxPorCm;
  const texto = cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${cm.toFixed(0)} cm`;
  mostrarToast(`Distancia: ${texto}`);
  renderVisorPlanos();
}

function iniciarTrazo(e) {
  const frac = fraccionDesdeEvento(e);
  const plano = planoActivo();
  const svg = document.getElementById("planos-svg-overlay");
  if (!frac || !plano || !svg) return;
  const tipo = PLANO_MODO === "resaltador" ? "resaltador" : "lapiz";
  const estilo = TRAZO_ESTILOS[tipo];
  const el = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  el.setAttribute("fill", "none");
  el.setAttribute("stroke", PLANO_COLOR_MARCADOR);
  el.setAttribute("stroke-opacity", String(estilo.opacidad));
  el.setAttribute("stroke-width", String(Math.max(plano.width, plano.height) * estilo.grosorFactor * PLANO_GROSOR));
  el.setAttribute("stroke-linecap", "round");
  el.setAttribute("stroke-linejoin", "round");
  svg.appendChild(el);
  PLANO_TRAZO_EN_CURSO = { puntos: [frac], elemento: el, plano, tipo, grosor: PLANO_GROSOR };
  actualizarPuntosSvg();
}
function continuarTrazo(e) {
  const frac = fraccionDesdeEvento(e);
  if (!frac || !PLANO_TRAZO_EN_CURSO) return;
  PLANO_TRAZO_EN_CURSO.puntos.push(frac);
  actualizarPuntosSvg();
}
function actualizarPuntosSvg() {
  const { puntos, elemento, plano } = PLANO_TRAZO_EN_CURSO;
  const attr = puntos.map(p => `${p.xFrac * plano.width},${p.yFrac * plano.height}`).join(" ");
  elemento.setAttribute("points", attr);
}
function finalizarTrazo() {
  if (!PLANO_TRAZO_EN_CURSO) return;
  const { puntos, plano, tipo, grosor } = PLANO_TRAZO_EN_CURSO;
  if (puntos.length > 1) {
    planoPushUndo(plano);
    plano.trazos.push({ color: PLANO_COLOR_MARCADOR, tipo, grosor, puntos });
    marcarCambio();
  }
  PLANO_TRAZO_EN_CURSO = null;
}

// --- Deshacer local del plano (pines + trazos de la hoja activa) — pila
// aparte del "deshacer" general de la app, para no mezclar acciones de dibujo
// con acciones de filas/tabla.
let PLANO_UNDO_STACK = [];

function planoPushUndo(plano) {
  PLANO_UNDO_STACK.push({
    planoId: plano.id,
    pines: JSON.parse(JSON.stringify(plano.pines)),
    trazos: JSON.parse(JSON.stringify(plano.trazos)),
    rectangulos: JSON.parse(JSON.stringify(plano.rectangulos || [])),
    lineas: JSON.parse(JSON.stringify(plano.lineas || [])),
  });
  if (PLANO_UNDO_STACK.length > 25) PLANO_UNDO_STACK.shift();
}

function planoDeshacer() {
  const snap = PLANO_UNDO_STACK.pop();
  if (!snap) { mostrarToast("No hay nada para deshacer en el plano."); return; }
  const plano = PLANOS.find(p => p.id === snap.planoId);
  if (plano) {
    plano.pines = snap.pines;
    plano.trazos = snap.trazos;
    plano.rectangulos = snap.rectangulos || [];
    plano.lineas = snap.lineas || [];
    marcarCambio();
  }
  renderVisorPlanos();
}

// Modo "Borrador": tocar/arrastrar cerca de un trazo lo borra (el trazo
// entero, no un pedacito — más simple y predecible que borrar por tramos).
function distanciaPuntoASegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const largo2 = dx * dx + dy * dy;
  let t = largo2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / largo2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Borrador: busca el elemento más cercano al toque entre trazos, líneas y
// rectángulos (bordes), y borra ese — sea cual sea el tipo.
function borrarCercaDe(e) {
  const plano = planoActivo();
  const frac = fraccionDesdeEvento(e);
  if (!plano || !frac) return;
  const px = frac.xFrac * plano.width, py = frac.yFrac * plano.height;
  const umbral = Math.max(plano.width, plano.height) * 0.015;
  let mejor = null; // { tipo, idx, dist }

  (plano.trazos || []).forEach((t, i) => {
    t.puntos.forEach(p => {
      const d = Math.hypot(p.xFrac * plano.width - px, p.yFrac * plano.height - py);
      if (!mejor || d < mejor.dist) mejor = { tipo: "trazos", idx: i, dist: d };
    });
  });
  (plano.lineas || []).forEach((l, i) => {
    const d = distanciaPuntoASegmento(px, py, l.x1Frac * plano.width, l.y1Frac * plano.height, l.x2Frac * plano.width, l.y2Frac * plano.height);
    if (!mejor || d < mejor.dist) mejor = { tipo: "lineas", idx: i, dist: d };
  });
  (plano.rectangulos || []).forEach((r, i) => {
    const x0 = r.xFrac * plano.width, y0 = r.yFrac * plano.height;
    const x1 = x0 + r.wFrac * plano.width, y1 = y0 + r.hFrac * plano.height;
    const bordes = [
      distanciaPuntoASegmento(px, py, x0, y0, x1, y0),
      distanciaPuntoASegmento(px, py, x1, y0, x1, y1),
      distanciaPuntoASegmento(px, py, x1, y1, x0, y1),
      distanciaPuntoASegmento(px, py, x0, y1, x0, y0),
    ];
    const d = Math.min(...bordes);
    if (!mejor || d < mejor.dist) mejor = { tipo: "rectangulos", idx: i, dist: d };
  });

  if (mejor && mejor.dist <= umbral) {
    planoPushUndo(plano);
    plano[mejor.tipo].splice(mejor.idx, 1);
    marcarCambio();
    renderVisorPlanos();
  }
}

function colocarPin(xFrac, yFrac) {
  const plano = planoActivo();
  if (!plano) return;

  // Modo borrador: la fila todavía no existe (se está agregando). No se
  // guarda el pin todavía — se le pasa la ubicación a quien abrió el visor
  // para que la guarde como pendiente y la vincule recién al guardar la fila.
  if (PLANO_PIN_CONTEXTO && PLANO_PIN_CONTEXTO.borrador) {
    if (typeof PLANO_PIN_CONTEXTO.onColocar === "function") {
      PLANO_PIN_CONTEXTO.onColocar({ planoId: plano.id, planoNombre: plano.nombre, xFrac, yFrac });
    }
    mostrarToast("Ubicación guardada — se vincula al guardar la fila.");
    cerrarVisorPlanos();
    return;
  }

  const pin = {
    id: Date.now(),
    xFrac, yFrac,
    filaId: PLANO_PIN_CONTEXTO ? PLANO_PIN_CONTEXTO.filaId : null,
    filaTipo: PLANO_PIN_CONTEXTO ? PLANO_PIN_CONTEXTO.filaTipo : null,
    nota: "",
  };
  // Si esta fila ya tenía un pin vinculado en algún plano (modo "Modificar" —
  // reubicar), se quita el viejo antes de poner el nuevo, para no dejar dos
  // pines apuntando a la misma fila.
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

// --- Exports usados por otros módulos ---
window.abrirVisorPlanos = abrirVisorPlanos;
window.abrirVisorPlanosEnPin = abrirVisorPlanosEnPin;
window.exportarPlanosPDF = exportarPlanosPDF;
window.confirmarPinPendiente = confirmarPinPendiente;
})();
