// ============================================================================
// helpers.js — encapsulado en IIFE (sin exponer todo a window; ver export list abajo)
// ============================================================================
(function () {
// ============================================================================
// helpers.js
// Funciones genéricas de propósito general (comparar texto, redondear tipo Excel, detectar vacío) — sin dependencias, usadas por todos los demás módulos.
// (Parte del proyecto Calculadora Cortafuego Hilti — ver README.md para el mapa completo de módulos.)
// ============================================================================

// ============================================================================
// MOTOR DE CÁLCULO - Réplica fiel de la hoja CALCULADORA del Excel Hilti
// ============================================================================

function eq(a, b) {
  if (a === null || a === undefined) a = "";
  if (b === null || b === undefined) b = "";
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}
function neq(a, b) { return !eq(a, b); }
function isBlank(v) { return v === null || v === undefined || v === "" || (typeof v === "number" && isNaN(v)); }
function n(v) { const x = parseFloat(v); return isNaN(x) ? 0 : x; }
function round2(v) { return Math.round(v * 100) / 100; }

// Excel ROUNDUP: away from zero, `digits` decimal places
function roundup(x, digits = 0) {
  const f = Math.pow(10, digits);
  if (x >= 0) return Math.ceil(x * f - 1e-9) / f;
  return Math.floor(x * f + 1e-9) / f;
}
function rounddown(x, digits = 0) {
  const f = Math.pow(10, digits);
  if (x >= 0) return Math.floor(x * f + 1e-9) / f;
  return Math.ceil(x * f - 1e-9) / f;
}

// --- Exports usados por otros módulos ---
window.eq = eq;
window.neq = neq;
window.isBlank = isBlank;
window.n = n;
window.round2 = round2;
window.roundup = roundup;
})();
