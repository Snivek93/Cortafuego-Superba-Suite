// ============================================================================
// tema-claro-oscuro.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
// Módulo: Configuración (tema + calculadora)
// Maneja el modal de Configuración que reemplazó al botón de tema.
const TEMA_CLAVE_STORAGE = "cf-hilti-tema";
const TEMA_ORDEN = ["auto", "light", "dark"];
const CALC_VIS_STORAGE = "cf-hilti-calc-vis";

function temaLeerPreferencia() {
  try { return localStorage.getItem(TEMA_CLAVE_STORAGE) || "auto"; } catch (e) { return "auto"; }
}
function temaGuardarPreferencia(valor) {
  try { localStorage.setItem(TEMA_CLAVE_STORAGE, valor); } catch (e) {}
}
function temaSistemaEsOscuro() {
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}
function temaEstaOscuroActivo(pref) {
  return pref === "dark" || (pref === "auto" && temaSistemaEsOscuro());
}
function temaAplicar(pref) {
  document.documentElement.setAttribute("data-theme", pref);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", temaEstaOscuroActivo(pref) ? "#1a1a1a" : "#ffffff");
  // Resaltar botón activo en el modal
  document.querySelectorAll(".btn-tema-opt").forEach(b =>
    b.classList.toggle("active", b.dataset.tema === pref)
  );
}

function calcVisLeer() {
  try { return localStorage.getItem(CALC_VIS_STORAGE) || "oculta"; } catch (e) { return "oculta"; }
}
function calcVisGuardar(val) {
  try { localStorage.setItem(CALC_VIS_STORAGE, val); } catch (e) {}
}
function calcVisAplicar(val) {
  const btn = document.querySelector(".tab-btn[data-tab=\"calculadora\"]");
  if (btn) btn.style.display = val === "visible" ? "" : "none";
  document.querySelectorAll(".btn-calc-vis").forEach(b =>
    b.classList.toggle("active", b.dataset.vis === val)
  );
}

let temaActual = temaLeerPreferencia();
temaAplicar(temaActual);

// Seguir cambio de tema del sistema cuando está en "auto"
if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (temaActual === "auto") temaAplicar("auto");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Aplicar visibilidad de calculadora guardada
  calcVisAplicar(calcVisLeer());

  const overlay = document.getElementById("modal-config-overlay");
  const btnAbrir = document.getElementById("btn-configuracion");
  const btnCerrar = document.getElementById("btn-cerrar-config");

  const abrirConfig = () => {
    if (!overlay) return;
    temaAplicar(temaActual);          // resalta el botón activo
    calcVisAplicar(calcVisLeer());    // resalta el botón activo
    overlay.style.display = "flex";
    document.body.classList.add("modal-open");
  };
  const cerrarConfig = () => {
    if (!overlay) return;
    overlay.style.display = "none";
    document.body.classList.remove("modal-open");
  };

  if (btnAbrir) btnAbrir.addEventListener("click", abrirConfig);
  if (btnCerrar) btnCerrar.addEventListener("click", cerrarConfig);
  if (overlay) overlay.addEventListener("click", e => { if (e.target === overlay) cerrarConfig(); });

  // Botones de tema
  document.querySelectorAll(".btn-tema-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      temaActual = btn.dataset.tema;
      temaGuardarPreferencia(temaActual);
      temaAplicar(temaActual);
    });
  });

  // Botones de visibilidad calculadora
  document.querySelectorAll(".btn-calc-vis").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.vis;
      calcVisGuardar(val);
      calcVisAplicar(val);
      // Si se oculta y está activa, cambiar a levantamiento
      if (val === "oculta") {
        const tabCalc = document.querySelector(".tab-btn[data-tab=\"calculadora\"]");
        if (tabCalc && tabCalc.classList.contains("active")) switchTab("levantamiento-tab");
      }
    });
  });
});

// --- Exports usados por otros módulos ---

})();
