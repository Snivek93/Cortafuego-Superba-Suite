// Genera una imagen JPG de la tabla de "Cuantificación de Materiales Hilti"
// dibujándola en un <canvas> (sin depender de librerías externas tipo
// html2canvas) y la comparte con navigator.share, o la descarga si el
// navegador no soporta compartir archivos.

function medirTextoCanvas(ctx, texto, maxWidth) {
  // Envuelve texto en líneas que no excedan maxWidth (wrapping simple por palabras)
  const palabras = String(texto).split(" ");
  const lineas = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? actual + " " + palabra : palabra;
    if (ctx.measureText(prueba).width > maxWidth && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function generarImagenTablaMateriales() {
  const tabla = document.getElementById("tabla-materiales");
  if (!tabla) return null;

  // Extraer filas visibles (header + body), columnas: Código, Cantidad, Producto, Presentación, Tipo
  // (se omite la última columna de acciones)
  const theadRow = tabla.querySelector("thead tr");
  const headers = Array.from(theadRow.querySelectorAll("th")).slice(0, -1).map(th => th.textContent.trim());

  const filas = Array.from(tabla.querySelectorAll("tbody tr")).map(tr => {
    const celdas = Array.from(tr.querySelectorAll("td")).slice(0, -1);
    return celdas.map(td => td.textContent.trim());
  }).filter(fila => fila.length > 0 && fila.some(c => c));

  if (filas.length === 0) return null;

  // Colores según el tema activo
  const esOscuro = document.documentElement.getAttribute("data-theme") === "dark" ||
    (document.documentElement.getAttribute("data-theme") !== "light" &&
     window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const colores = esOscuro
    ? { fondo: "#1e1e21", filaAlt: "#28282c", header: "#1a1a1a", texto: "#ececee", textoHeader: "#ffffff", borde: "#333338" }
    : { fondo: "#ffffff", filaAlt: "#f8f8fa", header: "#1a1a1a", texto: "#111111", textoHeader: "#ffffff", borde: "#d1d1d6" };

  // Configuración de columnas: [ancho relativo, alineación]
  const cols = [
    { label: headers[0] || "Código", w: 0.16, align: "left" },
    { label: headers[1] || "Cantidad", w: 0.10, align: "center" },
    { label: headers[2] || "Producto", w: 0.34, align: "left" },
    { label: headers[3] || "Presentación", w: 0.20, align: "left" },
    { label: headers[4] || "Tipo", w: 0.20, align: "left" },
  ];

  const anchoTotal = 1000;
  const padCelda = 14;
  const altoFila = 40;
  const altoHeader = 46;
  const altoTitulo = 70;
  const altoPie = 46;

  // Canvas temporal para medir texto y calcular alto real (por wrapping)
  const canvasMedida = document.createElement("canvas");
  const ctxMedida = canvasMedida.getContext("2d");
  ctxMedida.font = "14px -apple-system, Arial, sans-serif";

  const anchosCol = cols.map(c => Math.floor(anchoTotal * c.w));
  const filasConLineas = filas.map(fila => {
    let maxLineas = 1;
    const lineasFila = fila.map((valor, i) => {
      const maxW = (anchosCol[i] || 100) - padCelda * 2;
      const lineas = medirTextoCanvas(ctxMedida, valor, maxW);
      maxLineas = Math.max(maxLineas, lineas.length);
      return lineas;
    });
    return { lineasFila, maxLineas };
  });

  const altoFilas = filasConLineas.reduce((acc, f) => acc + Math.max(altoFila, f.maxLineas * 20 + 16), 0);
  const altoTotal = altoTitulo + altoHeader + altoFilas + altoPie;

  const escala = 2; // para nitidez (retina)
  const canvas = document.createElement("canvas");
  canvas.width = anchoTotal * escala;
  canvas.height = altoTotal * escala;
  const ctx = canvas.getContext("2d");
  ctx.scale(escala, escala);

  // Fondo general
  ctx.fillStyle = colores.fondo;
  ctx.fillRect(0, 0, anchoTotal, altoTotal);

  // Título
  const nombreProyecto = (typeof PROJECT_INFO !== "undefined" && PROJECT_INFO.nombre) ? PROJECT_INFO.nombre : "";
  ctx.fillStyle = colores.texto;
  ctx.font = "bold 22px -apple-system, Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("Cuantificación de Materiales Hilti", padCelda, 30);
  if (nombreProyecto) {
    ctx.font = "14px -apple-system, Arial, sans-serif";
    ctx.fillStyle = esOscuro ? "#b6b6bc" : "#555558";
    ctx.fillText(nombreProyecto, padCelda, 54);
  }

  // Header de tabla
  let y = altoTitulo;
  ctx.fillStyle = colores.header;
  ctx.fillRect(0, y, anchoTotal, altoHeader);
  ctx.font = "bold 14px -apple-system, Arial, sans-serif";
  ctx.fillStyle = colores.textoHeader;
  let x = 0;
  cols.forEach((col, i) => {
    const w = anchosCol[i];
    const tx = col.align === "center" ? x + w / 2 : x + padCelda;
    ctx.textAlign = col.align === "center" ? "center" : "left";
    ctx.fillText(col.label, tx, y + altoHeader / 2);
    x += w;
  });
  y += altoHeader;

  // Filas
  ctx.font = "13px -apple-system, Arial, sans-serif";
  filasConLineas.forEach((f, idxFila) => {
    const altoEstaFila = Math.max(altoFila, f.maxLineas * 20 + 16);
    if (idxFila % 2 === 1) {
      ctx.fillStyle = colores.filaAlt;
      ctx.fillRect(0, y, anchoTotal, altoEstaFila);
    }
    ctx.fillStyle = colores.texto;
    let cx = 0;
    f.lineasFila.forEach((lineas, i) => {
      const w = anchosCol[i];
      const tx = cols[i].align === "center" ? cx + w / 2 : cx + padCelda;
      ctx.textAlign = cols[i].align === "center" ? "center" : "left";
      const offsetY = y + altoEstaFila / 2 - ((lineas.length - 1) * 10);
      lineas.forEach((linea, li) => {
        ctx.fillText(linea, tx, offsetY + li * 20);
      });
      cx += w;
    });
    // Línea separadora
    ctx.strokeStyle = colores.borde;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + altoEstaFila);
    ctx.lineTo(anchoTotal, y + altoEstaFila);
    ctx.stroke();
    y += altoEstaFila;
  });

  // Pie
  ctx.textAlign = "left";
  ctx.font = "11px -apple-system, Arial, sans-serif";
  ctx.fillStyle = esOscuro ? "#8a8a90" : "#8a8a90";
  const fecha = new Date().toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" });
  ctx.fillText(`Generado el ${fecha} · Firestop Suite · Superba`, padCelda, y + altoPie / 2);

  return canvas;
}

async function compartirTablaMaterialesImagen() {
  const canvas = generarImagenTablaMateriales();
  if (!canvas) {
    mostrarToast("No hay materiales en la tabla para compartir.", "error");
    return;
  }

  const nombre = (typeof PROJECT_INFO !== "undefined" && PROJECT_INFO.nombre
    ? PROJECT_INFO.nombre : "proyecto").replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "-") || "proyecto";
  const archivo = `${nombre}-cuantificacion-materiales.jpg`;

  canvas.toBlob(async (blob) => {
    if (!blob) {
      mostrarToast("No se pudo generar la imagen.", "error");
      return;
    }
    const file = new File([blob], archivo, { type: "image/jpeg" });

    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Cuantificación de Materiales",
          text: "Cuantificación de materiales Hilti para el proyecto.",
        });
        mostrarToast("Imagen compartida.");
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
      // si falla, seguimos con la descarga de respaldo
    }

    // Respaldo: descargar directo
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = archivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    mostrarToast("Este navegador no permite compartir directo — se descargó la imagen.");
  }, "image/jpeg", 0.92);
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btn-compartir-tabla-materiales");
  if (btn) btn.addEventListener("click", compartirTablaMaterialesImagen);
});
