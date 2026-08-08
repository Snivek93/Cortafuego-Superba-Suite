/**
 * sw.js — Service Worker de la Calculadora Cortafuego Hilti.
 *
 * Qué hace: guarda una copia local (offline) de la app para que abra rápido
 * y funcione aunque no haya internet. Cuando hay una versión nueva, la
 * descarga en segundo plano y la aplica la próxima vez que se abre la app.
 *
 * IMPORTANTE al actualizar la app: cambiar el número de CACHE_VERSION de
 * abajo (ej. "v1" -> "v2") cada vez que se suba una versión nueva a GitHub.
 * Eso obliga a los teléfonos/computadoras que ya tienen la app instalada a
 * bajar los archivos nuevos en vez de seguir usando los viejos guardados.
 */
const CACHE_VERSION = "v1.0.60";
const CACHE_NAME = `cortafuego-hilti-${CACHE_VERSION}`;

const ARCHIVOS_PRECACHE = [
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./vendor/jspdf.js",
  "./vendor/jspdf.plugin.autotable.js",
  "./vendor/pdf-lib.js",
  "./vendor/xlsx.js",
  "./src/modules/archivo-estado-app.js",
  "./src/modules/archivo-guardar-cargar.js",
  "./src/modules/calc-detalle-y-filtro.js",
  "./src/modules/calc-engine.js",
  "./src/modules/calc-juntas.js",
  "./src/modules/compartir-tabla-imagen.js",
  "./src/modules/constantes.js",
  "./src/modules/data-ul-systems.js",
  "./src/modules/excel-export-import.js",
  "./src/modules/helpers.js",
  "./src/modules/importar-texto-libre.js",
  "./src/modules/pdf-comun.js",
  "./src/modules/pdf-memoria.js",
  "./src/modules/pdf-submittal-y-descargas.js",
  "./src/modules/tema-claro-oscuro.js",
  "./src/modules/ui-comun-y-cuantificacion.js",
  "./src/modules/ui-levantamiento.js",
  "./src/modules/ui-tabla-calculadora.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
];

// Instalar: descarga y guarda los archivos principales.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_PRECACHE))
  );
  self.skipWaiting();
});

// Activar: borra cachés de versiones anteriores y notifica a todos los
// clientes abiertos para que recarguen y vean la versión nueva de inmediato
// (en combinación con self.skipWaiting() arriba, que hace que el SW nuevo
// tome control sin esperar a que se cierren las pestañas).
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    ).then(() => {
      self.clients.claim();
      // Avisa a todas las pestañas/ventanas abiertas que hay una versión
      // nueva lista — la app escucha este mensaje y recarga.
      return self.clients.matchAll({ type: "window" }).then((clientes) => {
        clientes.forEach((cliente) => cliente.postMessage({ tipo: "SW_ACTUALIZADO", version: CACHE_VERSION }));
      });
    })
  );
});

// Peticiones: responde primero con lo guardado (rápido, funciona offline),
// y en paralelo pide la versión nueva a internet para la próxima vez.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((respuestaGuardada) => {
      const buscarEnRed = fetch(event.request)
        .then((respuestaRed) => {
          if (respuestaRed && respuestaRed.status === 200) {
            const copia = respuestaRed.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return respuestaRed;
        })
        .catch(() => respuestaGuardada);

      return respuestaGuardada || buscarEnRed;
    })
  );
});
