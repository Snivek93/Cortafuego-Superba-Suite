#!/usr/bin/env node
// Validador de integridad: MAIN_TABLE <-> NORMA_APLICACION
//
// Por qué existe: al agregar un producto con un sistema UL nuevo hay que
// actualizar dos diccionarios independientes en data-ul-systems.js:
// MAIN_TABLE (o JUNTAS_TABLE) y NORMA_APLICACION. Son independientes,
// nada obliga a mantenerlos sincronizados. Si se actualiza uno y se
// olvida el otro, no falla en el momento: el sistema UL queda sin
// "Normativa aplicable" completa y el texto sale degradado (fallback a
// solo nombres de materiales) recién cuando alguien lo selecciona en un
// proyecto real.
//
// Nota: JUNTAS_TABLE NO se valida acá. Se revisó calc-juntas.js y el
// producto de cada fila de Juntas ya viene embebido en la tabla misma
// (prod: "CP 606"), no se consulta NORMA_APLICACION en ningún punto de
// ese flujo. Agregarlo a este validador generaría ~25 falsos positivos.
//
// Uso: node tools/validar-datos.js
// Exit code 0 si todo cuadra, 1 si faltan códigos (para usar en CI o
// como smoke test de sesión).

const vm = require("vm");
const fs = require("fs");
const path = require("path");

const rutaDatos = path.join(__dirname, "..", "src", "modules", "data-ul-systems.js");
const codigo = fs.readFileSync(rutaDatos, "utf8");
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(codigo, sandbox);

const codigosMain = new Set();
for (const v of Object.values(sandbox.MAIN_TABLE)) {
  const cod = v[1];
  if (cod) codigosMain.add(cod);
}

const codigosNorma = new Set(Object.keys(sandbox.window.NORMA_APLICACION));
const faltantes = [...codigosMain].filter((c) => !codigosNorma.has(c)).sort();

if (faltantes.length === 0) {
  console.log(`✅ Validación OK — ${codigosMain.size} códigos UL en MAIN_TABLE, todos con entrada en NORMA_APLICACION.`);
  process.exit(0);
} else {
  console.error(`❌ Faltan ${faltantes.length} código(s) UL de MAIN_TABLE en NORMA_APLICACION:\n`);
  for (const cod of faltantes) {
    const claves = Object.entries(sandbox.MAIN_TABLE)
      .filter(([, v]) => v[1] === cod)
      .map(([k]) => k);
    console.error(`  ${cod}`);
    claves.forEach((k) => console.error(`    <- ${k}`));
  }
  console.error("\nAgregar la entrada correspondiente en NORMA_APLICACION (data-ul-systems.js).");
  process.exit(1);
}
