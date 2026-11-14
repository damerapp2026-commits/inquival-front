import fs from "fs";
import PDFDocument from "pdfkit";

const OUT = new URL("./COT-2026-001-Sistema-Gestion-Produccion.pdf", import.meta.url);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 46;
const HEADER_H = 36;
const FOOTER_H = 32;
const TOP = 54;
const BOTTOM = 50;
const CW = PAGE_W - MX * 2;

const NAVY = "#1B365D";
const STEEL = "#2C5282";
const LIGHT = "#E8EEF4";
const ALT = "#F4F7FA";
const AMBER = "#F8F1DC";
const GREEN = "#1F6B4A";
const RED_SOFT = "#F8E8E8";
const MUTED = "#5B6573";
const INK = "#1A1A1A";
const WHITE = "#FFFFFF";
const BORDER = "#C5CDD6";

const ZERO = { top: 0, bottom: 0, left: 0, right: 0 };

const doc = new PDFDocument({
  size: "A4",
  bufferPages: true,
  margins: ZERO,
  info: {
    Title: "COT-2026-001 — Sistema de gestión, facturación, guías de remisión y producción",
    Author: "Cotización comercial",
    Subject: "Cotización formal de sistema a medida",
  },
});

const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

let y = TOP;

function font(bold, italic) {
  if (bold && italic) doc.font("Helvetica-BoldOblique");
  else if (bold) doc.font("Helvetica-Bold");
  else if (italic) doc.font("Helvetica-Oblique");
  else doc.font("Helvetica");
}

function remaining() {
  return PAGE_H - BOTTOM - y;
}

function addPage() {
  doc.addPage({ size: "A4", margins: ZERO });
  y = TOP;
}

function ensure(h) {
  if (h > remaining()) addPage();
}

function rule(color = NAVY, w = 1.4) {
  doc.save().strokeColor(color).lineWidth(w).moveTo(MX, y).lineTo(MX + CW, y).stroke().restore();
}

function h2(text) {
  ensure(36);
  y += 10;
  font(true);
  doc.fontSize(12.5).fillColor(NAVY).text(text, MX, y, { width: CW });
  y = doc.y + 4;
  rule(NAVY, 1.1);
  y += 8;
}

function h3(text) {
  ensure(24);
  y += 6;
  font(true);
  doc.fontSize(11).fillColor(STEEL).text(text, MX, y, { width: CW });
  y = doc.y + 6;
}

function para(text, opts = {}) {
  const {
    size = 9.5,
    bold = false,
    italic = false,
    color = INK,
    align = "left",
    after = 6,
    width = CW,
    x = MX,
  } = opts;
  font(bold, italic);
  doc.fontSize(size);
  const h = doc.heightOfString(text, { width, align, lineGap: 1.6 });
  ensure(h + after);
  doc.fillColor(color).text(text, x, y, { width, align, lineGap: 1.6 });
  y = doc.y + after;
}

function bullet(text, opts = {}) {
  const size = opts.size || 9.5;
  const indent = 14;
  font(false);
  doc.fontSize(size);
  const h = doc.heightOfString(text, { width: CW - indent, lineGap: 1.6 });
  ensure(h + 4);
  doc.fillColor(NAVY).text("•", MX, y, { width: 12 });
  doc.fillColor(INK).text(text, MX + indent, y, { width: CW - indent, lineGap: 1.6 });
  y = doc.y + 3.5;
}

function numbered(n, text) {
  const indent = 16;
  font(false);
  doc.fontSize(9.5);
  const h = doc.heightOfString(text, { width: CW - indent, lineGap: 1.6 });
  ensure(h + 4);
  font(true);
  doc.fontSize(9.5).fillColor(NAVY).text(`${n}.`, MX, y, { width: 14 });
  font(false);
  doc.fillColor(INK).text(text, MX + indent, y, { width: CW - indent, lineGap: 1.6 });
  y = doc.y + 3.5;
}

function cellTextHeight(text, width, size, bold) {
  font(bold);
  doc.fontSize(size);
  return doc.heightOfString(String(text), { width: width - 12, lineGap: 1.2 });
}

function drawTable(colWidths, rows, opts = {}) {
  const x0 = MX;
  for (const row of rows) {
    const sizes = row.cells.map((c, i) =>
      cellTextHeight(c.text, colWidths[i], c.size || (row.header ? 8.2 : 8.4), c.bold || row.header)
    );
    const rowH = Math.max(18, ...sizes.map((h) => h + 10));
    ensure(rowH + 1);
    let x = x0;
    row.cells.forEach((c, i) => {
      const w = colWidths[i];
      const fill = c.fill || (row.header ? NAVY : undefined);
      if (fill) {
        doc.save().rect(x, y, w, rowH).fill(fill).restore();
      }
      doc.save().strokeColor(BORDER).lineWidth(0.5).rect(x, y, w, rowH).stroke().restore();
      font(c.bold || row.header);
      doc.fontSize(c.size || (row.header ? 8.2 : 8.4))
        .fillColor(c.color || (row.header ? WHITE : INK))
        .text(String(c.text), x + 6, y + 5, {
          width: w - 12,
          align: c.align || "left",
          lineGap: 1.2,
        });
      x += w;
    });
    y += rowH;
  }
  y += opts.after ?? 8;
}

function box(fill, pad, drawInner) {
  const startY = y;
  // measure by drawing off-page then... simpler: draw content first tracking height
  const contentStart = y + pad;
  y = contentStart;
  drawInner();
  const contentEnd = y;
  const h = contentEnd - startY + pad - 6;
  // We already advanced y; draw background behind by replaying is hard.
  // Instead, draw fill first with estimated height — use two-pass:
  return { startY, contentEnd, h };
}

function filledBlock(fill, padding, render, extra = 0) {
  // first pass: measure
  const start = y;
  const savedY = y;
  const dummyStart = y;
  render();
  const h = y - dummyStart + padding * 2 + extra;
  y = savedY;
  ensure(h + 4);
  const drawY = y;
  doc.save().rect(MX, drawY, CW, h).fill(fill).restore();
  y = drawY + padding;
  render();
  y = drawY + h + 8;
}

// ----- Header / content -----

font(true);
doc.fontSize(16).fillColor(NAVY).text("Sistema a medida de gestión, facturación y producción", MX, y, { width: CW });
y = doc.y + 3;
font(false);
doc.fontSize(10).fillColor(STEEL).text("Facturación electrónica  ·  Guías de remisión  ·  Recetario y envasado", MX, y, { width: CW });
y = doc.y + 12;

drawTable(
  [CW / 2, CW / 2],
  [
    { header: true, cells: [{ text: "DATOS DEL CLIENTE" }, { text: "DATOS DEL PROVEEDOR" }] },
    {
      cells: [
        {
          text: "Razón social: ________________________________\nRUC: ______________________________________\nContacto: __________________________________\nCorreo / teléfono: __________________________\nDirección: _________________________________",
          size: 8.3,
        },
        {
          text: "Nombre / razón social: _____________________\nRUC / DNI: ________________________________\nContacto: __________________________________\nCorreo / teléfono: __________________________\nLugar: Lima, Perú",
          size: 8.3,
        },
      ],
    },
  ]
);

drawTable(
  [CW * 0.25, CW * 0.25, CW * 0.25, CW * 0.25],
  [
    {
      header: true,
      cells: [
        { text: "N.° de cotización", align: "center" },
        { text: "Fecha", align: "center" },
        { text: "Validez", align: "center" },
        { text: "Moneda", align: "center" },
      ],
    },
    {
      cells: [
        { text: "COT-2026-001", bold: true, align: "center", fill: ALT },
        { text: "15 de septiembre de 2026", align: "center", fill: ALT },
        { text: "15 días calendario", align: "center", fill: ALT },
        { text: "Soles (PEN)", align: "center", fill: ALT },
      ],
    },
  ],
  { after: 10 }
);

ensure(78);
doc.save().rect(MX, y, CW, 72).fill(NAVY).restore();
font(true);
doc.fontSize(8.2).fillColor(WHITE).text("INVERSIÓN TOTAL DEL PROYECTO", MX, y + 10, { width: CW, align: "center" });
doc.fontSize(22).text("S/ 5,000.00", MX, y + 24, { width: CW, align: "center" });
font(false);
doc.fontSize(8.2).fillColor("#D6E2F0").text("Cinco mil con 00/100 soles  ·  Primera versión acotada, lista para operar", MX, y + 52, { width: CW, align: "center" });
y += 82;

para("El importe cubre el desarrollo, la configuración inicial y la puesta en marcha del alcance descrito. No incluye hosting, dominio ni las tarifas del operador de facturación electrónica (OSE/PSE), que el cliente contrata por su cuenta.", {
  size: 8.4,
  italic: true,
  color: MUTED,
  after: 4,
});

h2("1. Objeto");
para("Desarrollo e implementación de un sistema web a medida para una empresa que fabrica y comercializa productos, con tres bloques operativos:");
bullet("Gestión comercial e inventario: clientes, productos, compras de insumos, ventas, stock y kardex.");
bullet("Comprobantes electrónicos: factura, boleta, nota de crédito por anulación y guía de remisión electrónica de remitente (GRE), emitidos a través de un operador OSE/PSE.");
bullet("Producción: recetario de insumos, órdenes de producción y envasado por presentación (litro, galón u otra capacidad que registre el cliente).");
para("La propuesta corresponde a una primera versión operativa para una (1) empresa, una (1) sede, un (1) almacén y hasta cinco (5) usuarios. Está pensada para empezar a facturar, despachar y producir con control de stock, sin convertir el proyecto en un ERP contable o industrial completo.");

h2("2. Cómo funciona el negocio en el sistema");
para("El sistema distingue cuatro tipos de ítem, para que el recetario y el envasado no se mezclen con la venta:");
drawTable(
  [158, CW - 158],
  [
    { header: true, cells: [{ text: "Tipo" }, { text: "Rol en la operación" }] },
    { cells: [{ text: "Materia prima / insumo", bold: true, fill: LIGHT }, { text: "Se compra y se consume al producir. Ejemplo: solvente, pigmento, activo, aditivo.", fill: LIGHT }] },
    { cells: [{ text: "Producto a granel", bold: true, fill: ALT }, { text: "Resultado de la receta, aún sin envase de venta. Se mide en la unidad de la fórmula (por lo general litros o kilos).", fill: ALT }] },
    { cells: [{ text: "Material de empaque", bold: true, fill: LIGHT }, { text: "Envase, tapa, etiqueta, caja u otro material que se descuenta al envasar.", fill: LIGHT }] },
    { cells: [{ text: "Producto terminado", bold: true, fill: ALT }, { text: "Presentación vendible: 1 L, 4 L, galón u otra capacidad registrada, con su precio y código.", fill: ALT }] },
  ]
);
para("La receta define cómo se obtiene el granel. El envasado define en qué presentación se vende. No se copia la receta completa por cada tamaño de envase: se produce una vez y luego se fracciona.");

h2("3. Alcance incluido");
h3("3.1 Plataforma de gestión");
drawTable(
  [150, CW - 150],
  [
    { header: true, cells: [{ text: "Módulo" }, { text: "Qué incluye esta versión" }] },
    { cells: [{ text: "Acceso y usuarios", bold: true, fill: LIGHT }, { text: "Inicio de sesión, hasta 5 usuarios, roles de administrador y vendedor, y bitácora básica de operaciones sensibles.", fill: LIGHT }] },
    { cells: [{ text: "Clientes", bold: true, fill: ALT }, { text: "Alta y edición con DNI/RUC, dirección y datos de contacto. Búsqueda para la venta y la guía.", fill: ALT }] },
    { cells: [{ text: "Productos y catálogo", bold: true, fill: LIGHT }, { text: "Insumos, granel, empaques y productos terminados. Precios de venta. Estado activo/inactivo.", fill: LIGHT }] },
    { cells: [{ text: "Unidades y presentaciones", bold: true, fill: ALT }, { text: "Unidades de medida (kg, L, und, etc.) con capacidad registrada por envase. El sistema no asume que un «galón» equivale siempre a 4 litros: usa la capacidad que indique el cliente.", fill: ALT }] },
    { cells: [{ text: "Compras", bold: true, fill: LIGHT }, { text: "Registro de compra de insumos y empaques, con ingreso a stock. Control de comprobante del proveedor (serie y número).", fill: LIGHT }] },
    { cells: [{ text: "Ventas / punto de venta", bold: true, fill: ALT }, { text: "Venta de producto terminado, descuento de stock, PDF interno de la operación y vínculo con el comprobante electrónico.", fill: ALT }] },
    { cells: [{ text: "Inventario y kardex", bold: true, fill: LIGHT }, { text: "Stock actual, movimientos de entrada/salida/ajuste, y rastro del documento que originó cada movimiento (compra, producción, envasado, venta o guía).", fill: LIGHT }] },
    { cells: [{ text: "Panel inicial", bold: true, fill: ALT }, { text: "Resumen de ventas del período, stock bajo y últimas producciones o emisiones.", fill: ALT }] },
  ]
);

h3("3.2 Facturación electrónica");
para("El sistema emite comprobantes electrónicos mediante un único operador OSE/PSE que el cliente contrata. No se desarrolla una conexión directa con SUNAT desde cero.");
bullet("Factura electrónica y boleta electrónica, con serie y correlativo del emisor.");
bullet("Datos del adquirente (DNI o RUC), ítems, cantidades, unidad, precios, IGV y totales.");
bullet("PDF de representación impresa y descarga de XML cuando el operador lo entregue.");
bullet("Consulta de estado de emisión (aceptado, rechazado o pendiente) y registro del CDR cuando exista.");
bullet("Nota de crédito por anulación total del comprobante original. No incluye notas de débito ni notas de crédito por descuento parcial o por ítem en esta versión.");
bullet("Anulación o baja según el procedimiento que permita el operador contratado.");
para("Antes de cerrar el calendario de este bloque se confirma que el operador elegido cubre factura, boleta, nota de crédito y GRE. Un proveedor de comprobantes no siempre cubre guías.");

h3("3.3 Guías de remisión electrónicas");
para("Se incluye la GRE de remitente asociada a ventas y despachos de la empresa. SUNAT distingue guía de remitente, de transportista y por evento; esta cotización cubre únicamente la de remitente.");
bullet("Emisión de GRE de remitente con destinatario, punto de partida y llegada, bienes, cantidades y unidad.");
bullet("Datos de traslado: motivo, modalidad (privado o público) y datos del vehículo/conductor o transportista, en el nivel que exija el operador.");
bullet("Relación de la guía con la venta o el comprobante, para no descontar el stock dos veces por la misma salida física.");
bullet("PDF de la guía y consulta de estado de aceptación.");
para("No se incluyen GRE de transportista, GRE por evento, ni el flujo de múltiples almacenes o traslados entre sedes.");

h3("3.4 Producción: recetario, órdenes y envasado");
para("Este es el módulo nuevo del proyecto. Permite saber qué insumos consume cada producto, cuánto rinde la fórmula y en qué envase queda listo para la venta.");

font(true);
ensure(18);
doc.fontSize(10.5).fillColor(STEEL).text("Recetario", MX, y);
y = doc.y + 5;
bullet("Cada receta pertenece a un producto a granel y declara un rendimiento base.");
bullet("Lista de insumos con cantidad y unidad (kg, L, g, mL, unidades, etc.).");
bullet("Al ejecutar una orden, el sistema guarda una copia de la receta usada, para no alterar el historial si más adelante se cambia la fórmula.");
bullet("El recetario no se duplica por cada tamaño de envase. El tamaño se resuelve en el envasado.");

font(true);
ensure(18);
y += 4;
doc.fontSize(10.5).fillColor(STEEL).text("Órdenes de producción", MX, y);
y = doc.y + 5;
bullet("Alta de orden: receta, cantidad a producir, lote, fecha y responsable.");
bullet("Validación de stock de insumos antes de confirmar.");
bullet("Registro de cantidad prevista y cantidad real, con merma.");
bullet("Al confirmar: descuento de insumos e ingreso del producto a granel al inventario, con kardex.");

font(true);
ensure(18);
y += 4;
doc.fontSize(10.5).fillColor(STEEL).text("Envasado y presentaciones", MX, y);
y = doc.y + 5;
bullet("Cada presentación vendible declara su capacidad exacta (por ejemplo 1,00 L; 3,785 L; 4,00 L; 20 L) y los materiales de empaque que consume.");
bullet("Una orden de envasado toma granel de un lote, elige la presentación y la cantidad de envases, y descuenta granel + envase + tapa + etiqueta (según lo configurado).");
bullet("Ingresa al stock el producto terminado listo para vender y facturar.");
bullet("El sistema muestra el saldo a granel restante después de envasar.");

y += 4;
ensure(88);
{
  const text1 = "Ejemplo ilustrativo de envasado (no es una fórmula química)";
  const text2 = "Si una receta rinde 100 litros a granel, el operador puede envasar, por ejemplo, 60 unidades de 1 litro y 10 unidades de 4 litros. El sistema descuenta 100 L de granel, descuenta 70 envases (más tapas y etiquetas si están en la presentación) e ingresa 70 unidades vendibles. El cliente define la capacidad real de cada envase; un «galón» comercial no se convierte automáticamente a 4 litros.";
  const text3 = "No se convierten kilos a litros sin densidad y una regla validada con el cliente al inicio del proyecto.";
  font(true); doc.fontSize(9);
  const h1 = doc.heightOfString(text1, { width: CW - 24 });
  font(false); doc.fontSize(8.6);
  const h2b = doc.heightOfString(text2, { width: CW - 24, lineGap: 1.4 });
  font(false, true); doc.fontSize(8.4);
  const h3b = doc.heightOfString(text3, { width: CW - 24 });
  const boxH = 16 + h1 + 6 + h2b + 6 + h3b + 12;
  ensure(boxH);
  doc.save().rect(MX, y, CW, boxH).fill(AMBER).restore();
  let ty = y + 10;
  font(true); doc.fontSize(9).fillColor(NAVY).text(text1, MX + 12, ty, { width: CW - 24 });
  ty = doc.y + 5;
  font(false); doc.fontSize(8.6).fillColor(INK).text(text2, MX + 12, ty, { width: CW - 24, lineGap: 1.4 });
  ty = doc.y + 4;
  font(false, true); doc.fontSize(8.4).fillColor(MUTED).text(text3, MX + 12, ty, { width: CW - 24 });
  y += boxH + 8;
}

h3("3.5 Regla de inventario (crítica para no duplicar salidas)");
para("Toda salida física de mercadería descuenta stock una sola vez. Si una venta genera factura y guía, el inventario no se reduce dos veces. Cada movimiento queda ligado al documento que originó: compra, orden de producción, envasado, venta, guía o ajuste.");

h2("4. Inversión");
para("El precio es cerrado para el alcance de esta versión. El desglose es comercial; no es una tasación por horas ni un menú para contratar módulos por separado.");
drawTable(
  [CW - 110, 110],
  [
    { header: true, cells: [{ text: "Concepto" }, { text: "Importe", align: "right" }] },
    { cells: [{ text: "Adaptación de la plataforma de gestión (usuarios, clientes, productos, unidades, compras, ventas, stock y kardex)", fill: LIGHT }, { text: "S/ 1,500.00", align: "right", fill: LIGHT }] },
    { cells: [{ text: "Facturación electrónica: factura, boleta y nota de crédito por anulación (integración con un OSE/PSE)", fill: ALT }, { text: "S/ 1,200.00", align: "right", fill: ALT }] },
    { cells: [{ text: "Guías de remisión electrónicas de remitente, ligadas a la venta y al inventario", fill: LIGHT }, { text: "S/ 800.00", align: "right", fill: LIGHT }] },
    { cells: [{ text: "Módulo de producción: recetario, órdenes, merma, envasado por presentación e inventario asociado", fill: ALT }, { text: "S/ 1,500.00", align: "right", fill: ALT }] },
    { cells: [{ text: "TOTAL DEL PROYECTO", bold: true, fill: GREEN, color: WHITE, size: 9 }, { text: "S/ 5,000.00", bold: true, align: "right", fill: GREEN, color: WHITE, size: 9 }] },
  ]
);
para("Incluido en el total: configuración inicial, carga asistida del catálogo y recetas que el cliente entregue en la plantilla, una sesión de capacitación de 2 horas y un instructivo breve de uso.");

h2("5. Forma de pago");
drawTable(
  [95, CW - 95 - 95, 95],
  [
    { header: true, cells: [{ text: "Hito" }, { text: "Condición" }, { text: "Importe", align: "right" }] },
    { cells: [
      { text: "50%  ·  Inicio", bold: true, fill: LIGHT },
      { text: "Al aceptar esta cotización por escrito. El plazo de entrega se cuenta desde el abono y la recepción de la información mínima de la sección 9.", fill: LIGHT },
      { text: "S/ 2,500.00", align: "right", fill: LIGHT },
    ] },
    { cells: [
      { text: "30%  ·  Avance", bold: true, fill: ALT },
      { text: "Al demostrar en ambiente de prueba: receta + producción + envasado con movimiento de stock, y emisión de prueba de un comprobante (factura o boleta) y una GRE.", fill: ALT },
      { text: "S/ 1,500.00", align: "right", fill: ALT },
    ] },
    { cells: [
      { text: "20%  ·  Cierre", bold: true, fill: LIGHT },
      { text: "Al entregar el sistema en producción con el alcance de esta versión y la capacitación acordada.", fill: LIGHT },
      { text: "S/ 1,000.00", align: "right", fill: LIGHT },
    ] },
  ]
);
para("El pago se realiza por transferencia o depósito a la cuenta que indique el proveedor. Cada hito se factura o se documenta según el régimen tributario del proveedor.");

h2("6. Plazo");
para("Treinta y cinco (35) días hábiles, contados desde el abono del 50% y la entrega por el cliente de: datos de la empresa, catálogo inicial, recetas, presentaciones con capacidad real, y acceso de pruebas al operador OSE/PSE.");
para("Si el operador electrónico, el certificado o la información de recetas se retrasan, el calendario se desplaza el mismo número de días hábiles, sin que ello se considere incumplimiento del proveedor.");

h2("7. Fuera de alcance");
para("Lo siguiente no forma parte de los S/ 5,000. Si se requiere, se cotiza en un presupuesto adicional:");

{
  const items = [
    "Caja, créditos a clientes, comisiones, viáticos, cuentas por pagar, cotizaciones comerciales y reportes contables o de rentabilidad avanzada.",
    "Múltiples empresas, múltiples sedes o múltiples almacenes; transferencias entre almacenes.",
    "Costeo industrial, MRP, planificación de planta, control de calidad de laboratorio, trazabilidad sanitaria completa o fórmulas con densidad y conversiones automáticas kilo/litro.",
    "Integración directa con SUNAT (OSE propio), facturación de exportación, detracción, percepción, retención, notas de débito y notas de crédito parciales.",
    "GRE de transportista, GRE por evento y manifiestos de traslado distintos a la GRE de remitente de venta.",
    "Aplicación móvil nativa, tienda en línea, pasarela de pagos o integración con otro ERP o software contable.",
    "Hosting, dominio, correo corporativo, certificado digital y tarifas mensuales o por documento del OSE/PSE.",
    "Migración masiva desde Excel u otro sistema más allá de la plantilla inicial acordada; personalizaciones de PDF distintas a la plantilla estándar.",
    "Capacitación adicional, soporte continuo o nuevas funciones después de la entrega.",
  ];
  font(false); doc.fontSize(9);
  let innerH = 10;
  items.forEach((t) => {
    innerH += doc.heightOfString(t, { width: CW - 36, lineGap: 1.4 }) + 4;
  });
  innerH += 8;
  ensure(innerH);
  const boxY = y;
  doc.save().rect(MX, boxY, CW, innerH).fill(RED_SOFT).restore();
  y = boxY + 8;
  items.forEach((t) => {
    font(true); doc.fontSize(9).fillColor(NAVY).text("•", MX + 10, y, { width: 12 });
    font(false); doc.fontSize(9).fillColor(INK).text(t, MX + 22, y, { width: CW - 36, lineGap: 1.4 });
    y = doc.y + 3;
  });
  y = boxY + innerH + 8;
}

h2("8. Condiciones comerciales");
[
  "El precio cubre el alcance de las secciones 2 y 3. Todo pedido fuera de ese alcance se estima y se cobra aparte, por escrito, antes de desarrollarlo.",
  "El cliente obtiene una licencia de uso perpetua, no exclusiva, para una empresa, una sede y un almacén, con hasta cinco usuarios. El código fuente permanece en propiedad del proveedor. La cesión de código, la exclusividad o una instalación adicional se cotizan aparte.",
  "El cliente es el contribuyente emisor ante SUNAT. El proveedor desarrolla e integra el sistema; no asume la representación tributaria ni las sanciones por datos, series o certificados incorrectos que suministre el cliente.",
  "El operador OSE/PSE, sus tarifas y su certificado, si aplica, son contrato y costo del cliente. El proveedor no puede garantizar la aceptación de un CPE si el operador, el ambiente o el certificado fallan.",
  "Garantía de treinta (30) días calendario desde la entrega, limitada a defectos del alcance pactado. No cubre mal uso, cambios de SUNAT o del operador, pérdida de claves, ni funciones nuevas.",
  "Tras la garantía, el soporte y las mejoras se cotizan por hora o por un mantenimiento mensual opcional.",
  "El cliente designa un responsable del proyecto con autoridad para validar recetas, presentaciones, series y pruebas. Las observaciones de cada entrega se concentran en un plazo de cinco (5) días hábiles.",
  "Esta cotización no es una factura. La aceptación se formaliza con la firma de la sección 10 y el abono del 50%.",
  "Si el cliente no entrega la información mínima o no contrata un operador que cubre factura, boleta, nota de crédito y GRE, el proveedor puede reestimar plazo y precio de la parte tributaria antes de comprometer ese bloque.",
  "La vigencia de esta oferta es de quince (15) días calendario a partir de la fecha de emisión.",
].forEach((t, i) => numbered(i + 1, t));

h2("9. Información que debe entregar el cliente");
para("El trabajo arranca cuando exista, como mínimo:");
bullet("Razón social, RUC, domicilio fiscal, serie de factura, boleta, nota de crédito y GRE.");
bullet("Contrato o acceso de pruebas al OSE/PSE, y confirmación de que cubre los cuatro documentos.");
bullet("Lista de insumos, empaques y productos terminados, con unidad y capacidad real de cada envase.");
bullet("Recetas: producto, rendimiento, insumos y cantidades. Si una receta rinde en kilos y se envasa en litros, indicar la regla (densidad) o se trabajará sin conversión automática.");
bullet("Presentaciones de venta y materiales de empaque de cada una (botella, galonera, tapa, etiqueta, etc.).");
bullet("Usuarios iniciales y el responsable que aprobará las pruebas.");

h2("10. Aceptación");
para("La firma de esta sección y el abono del 50% implican la conformidad con el objeto, el alcance, el precio, el plazo y las condiciones de este documento.");

ensure(148);
drawTable(
  [CW / 2, CW / 2],
  [
    { header: true, cells: [{ text: "POR EL CLIENTE", align: "center" }, { text: "POR EL PROVEEDOR", align: "center" }] },
    {
      cells: [
        { text: "\n\n________________________________\nNombre y firma\nCargo: ________________________\nDNI: ___________________________\nFecha: _________________________", align: "center", size: 8.4 },
        { text: "\n\n________________________________\nNombre y firma\nCargo: ________________________\nDNI / RUC: ____________________\nFecha: _________________________", align: "center", size: 8.4 },
      ],
    },
  ]
);

para("Lima, 15 de septiembre de 2026.", { italic: true, color: MUTED, size: 8.6, after: 4 });
para("Este documento describe una primera versión operativa. Cualquier ampliación se tratará como un nuevo alcance, con su propio presupuesto.", { italic: true, color: MUTED, size: 8.2 });

// Headers and footers
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  doc.save();
  doc.rect(0, 0, PAGE_W, 28).fill(WHITE);
  font(true);
  doc.fontSize(8).fillColor(NAVY).text("COTIZACIÓN COMERCIAL", MX, 16, { width: CW / 2, lineBreak: false });
  doc.text("COT-2026-001", MX, 16, { width: CW, align: "right", lineBreak: false });
  doc.strokeColor(NAVY).lineWidth(1.4).moveTo(MX, 28).lineTo(MX + CW, 28).stroke();
  doc.strokeColor(BORDER).lineWidth(0.6).moveTo(MX, PAGE_H - 28).lineTo(MX + CW, PAGE_H - 28).stroke();
  font(false, true);
  doc.fontSize(7.5).fillColor(MUTED).text("Documento confidencial · Uso exclusivo del destinatario", MX, PAGE_H - 22, { width: CW / 2, lineBreak: false });
  font(false);
  doc.fontSize(7.5).fillColor(MUTED).text(`Página ${i + 1} de ${range.count}`, MX, PAGE_H - 22, { width: CW, align: "right", lineBreak: false });
  doc.restore();
}

doc.end();
await new Promise((resolve, reject) => {
  stream.on("finish", resolve);
  stream.on("error", reject);
});
console.log("Wrote", OUT.pathname);
