import fs from "fs";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  TabStopPosition,
  TabStopType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const OUT = new URL("./COT-2026-001-Sistema-Gestion-Produccion.docx", import.meta.url);

const NAVY = "1B365D";
const STEEL = "2C5282";
const LIGHT = "E8EEF4";
const ALT = "F4F7FA";
const AMBER = "F8F1DC";
const GREEN = "1F6B4A";
const GREEN_BG = "E8F4EE";
const BORDER = "C5CDD6";
const MUTED = "5B6573";
const INK = "1A1A1A";
const WHITE = "FFFFFF";
const RED_SOFT = "F8E8E8";

const PAGE_W = 11906;
const MARGIN_X = 1080;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 9746

const thin = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const none = { style: BorderStyle.NONE, size: 0, color: WHITE };
const noBorders = { top: none, bottom: none, left: none, right: none };
const bottomOnly = {
  top: none,
  left: none,
  right: none,
  bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY },
};

function p(text, opts = {}) {
  const {
    bold,
    size = 21,
    color = INK,
    italics,
    align,
    spacingAfter = 120,
    spacingBefore = 0,
    font = "Arial",
  } = opts;
  return new Paragraph({
    alignment: align,
    spacing: { after: spacingAfter, before: spacingBefore, line: 276 },
    children: [
      new TextRun({ text, bold, italics, color, size, font }),
    ],
  });
}

function rich(runs, opts = {}) {
  const { align, spacingAfter = 120, spacingBefore = 0, heading } = opts;
  return new Paragraph({
    heading,
    alignment: align,
    spacing: { after: spacingAfter, before: spacingBefore, line: heading ? 276 : 276 },
    children: runs.map((r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italics,
        color: r.color || INK,
        size: r.size || 21,
        font: "Arial",
      })
    ),
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 4 } },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 26, color: NAVY })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 22, color: STEEL })],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, font: "Arial", size: 21, color: INK })],
  });
}

function bulletRich(runs, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 276 },
    children: runs.map((r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italics,
        color: r.color || INK,
        size: 21,
        font: "Arial",
      })
    ),
  });
}

function numbered(text, ref = "numbers") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, font: "Arial", size: 21, color: INK })],
  });
}

function cell(children, width, opts = {}) {
  const { fill, span, alignV = VerticalAlign.CENTER, b = borders, margins } = opts;
  return new TableCell({
    borders: b,
    width: { size: width, type: WidthType.DXA },
    columnSpan: span,
    verticalAlign: alignV,
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: margins || { top: 70, bottom: 70, left: 110, right: 110 },
    children: Array.isArray(children) ? children : [children],
  });
}

function textCell(text, width, opts = {}) {
  const {
    bold,
    fill,
    color = INK,
    size = 19,
    align = AlignmentType.LEFT,
    span,
    italics,
    b,
  } = opts;
  return cell(
    new Paragraph({
      alignment: align,
      children: [
        new TextRun({ text, bold, italics, color, size, font: "Arial" }),
      ],
    }),
    width,
    { fill, span, b }
  );
}

function headerCell(text, width, opts = {}) {
  return textCell(text, width, {
    bold: true,
    fill: NAVY,
    color: WHITE,
    size: 18,
    align: opts.align || AlignmentType.LEFT,
    span: opts.span,
  });
}

function makeTable(columnWidths, rows) {
  const width = columnWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths,
    rows,
  });
}

const spacer = (after = 160) =>
  new Paragraph({ spacing: { after }, children: [] });

const doc = new Document({
  creator: "Cotización comercial",
  title: "COT-2026-001 — Sistema de gestión, facturación, guías de remisión y producción",
  description:
    "Cotización formal de un sistema a medida con facturación electrónica, guías de remisión y módulo de producción con recetario y envasado.",
  styles: {
    default: {
      document: { run: { font: "Arial", size: 21, color: INK } },
    },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 0, after: 120 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: NAVY },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: STEEL },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "bullets-prod",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "bullets-out",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "bullets-client",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 240 } } },
          },
        ],
      },
      {
        reference: "conds",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 420, hanging: 240 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: 16838 },
          margin: { top: 900, right: MARGIN_X, bottom: 900, left: MARGIN_X },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: NAVY, space: 6 } },
              spacing: { after: 80 },
              children: [
                new TextRun({ text: "COTIZACIÓN COMERCIAL", bold: true, font: "Arial", size: 18, color: NAVY }),
                new TextRun({ text: "\tCOT-2026-001", bold: true, font: "Arial", size: 18, color: STEEL }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
              border: { top: { style: BorderStyle.SINGLE, size: 8, color: BORDER, space: 6 } },
              spacing: { before: 80 },
              children: [
                new TextRun({
                  text: "Documento confidencial · Uso exclusivo del destinatario",
                  font: "Arial",
                  size: 16,
                  color: MUTED,
                  italics: true,
                }),
                new TextRun({ text: "\tPágina ", font: "Arial", size: 16, color: MUTED }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: MUTED }),
                new TextRun({ text: " de ", font: "Arial", size: 16, color: MUTED }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 16, color: MUTED }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: "Sistema a medida de gestión, facturación y producción",
              bold: true,
              font: "Arial",
              size: 36,
              color: NAVY,
            }),
          ],
        }),
        p("Facturación electrónica · Guías de remisión · Recetario y envasado", {
          size: 22,
          color: STEEL,
          spacingAfter: 200,
        }),

        makeTable(
          [4873, 4873],
          [
            new TableRow({
              children: [
                headerCell("DATOS DEL CLIENTE", 4873),
                headerCell("DATOS DEL PROVEEDOR", 4873),
              ],
            }),
            new TableRow({
              children: [
                cell(
                  [
                    rich([{ text: "Razón social: ", bold: true, size: 19 }, { text: "________________________________", size: 19 }], { spacingAfter: 40 }),
                    rich([{ text: "RUC: ", bold: true, size: 19 }, { text: "______________________________", size: 19 }], { spacingAfter: 40 }),
                    rich([{ text: "Contacto: ", bold: true, size: 19 }, { text: "__________________________", size: 19 }], { spacingAfter: 40 }),
                    rich([{ text: "Correo / teléfono: ", bold: true, size: 19 }, { text: "____________________", size: 19 }], { spacingAfter: 40 }),
                    rich([{ text: "Dirección: ", bold: true, size: 19 }, { text: "__________________________", size: 19 }], { spacingAfter: 20 }),
                  ],
                  4873,
                  { alignV: VerticalAlign.TOP }
                ),
                cell(
                  [
                    rich([{ text: "Nombre / razón social: ", bold: true, size: 19 }, { text: "________________", size: 19 }], { spacingAfter: 40 }),
                    rich([{ text: "RUC / DNI: ", bold: true, size: 19 }, { text: "________________________", size: 19 }], { spacingAfter: 40 }),
                    rich([{ text: "Contacto: ", bold: true, size: 19 }, { text: "__________________________", size: 19 }], { spacingAfter: 40 }),
                    rich([{ text: "Correo / teléfono: ", bold: true, size: 19 }, { text: "____________________", size: 19 }], { spacingAfter: 40 }),
                    rich([{ text: "Lugar: ", bold: true, size: 19 }, { text: "Lima, Perú", size: 19 }], { spacingAfter: 20 }),
                  ],
                  4873,
                  { alignV: VerticalAlign.TOP }
                ),
              ],
            }),
          ]
        ),
        spacer(180),

        makeTable(
          [2436, 2437, 2437, 2436],
          [
            new TableRow({
              children: [
                headerCell("N.° de cotización", 2436, { align: AlignmentType.CENTER }),
                headerCell("Fecha", 2437, { align: AlignmentType.CENTER }),
                headerCell("Validez", 2437, { align: AlignmentType.CENTER }),
                headerCell("Moneda", 2436, { align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                textCell("COT-2026-001", 2436, { bold: true, align: AlignmentType.CENTER, fill: ALT }),
                textCell("15 de septiembre de 2026", 2437, { align: AlignmentType.CENTER, fill: ALT }),
                textCell("15 días calendario", 2437, { align: AlignmentType.CENTER, fill: ALT }),
                textCell("Soles (PEN)", 2436, { align: AlignmentType.CENTER, fill: ALT }),
              ],
            }),
          ]
        ),
        spacer(200),

        makeTable(
          [CONTENT_W],
          [
            new TableRow({
              children: [
                cell(
                  [
                    p("INVERSIÓN TOTAL DEL PROYECTO", {
                      bold: true,
                      size: 18,
                      color: WHITE,
                      align: AlignmentType.CENTER,
                      spacingAfter: 40,
                    }),
                    p("S/ 5,000.00", {
                      bold: true,
                      size: 48,
                      color: WHITE,
                      align: AlignmentType.CENTER,
                      spacingAfter: 40,
                    }),
                    p("Cinco mil con 00/100 soles  ·  Primera versión acotada, lista para operar", {
                      size: 18,
                      color: "D6E2F0",
                      align: AlignmentType.CENTER,
                      spacingAfter: 20,
                    }),
                  ],
                  CONTENT_W,
                  { fill: NAVY, margins: { top: 140, bottom: 140, left: 200, right: 200 } }
                ),
              ],
            }),
          ]
        ),
        spacer(80),
        p("El importe cubre el desarrollo, la configuración inicial y la puesta en marcha del alcance descrito. No incluye hosting, dominio ni las tarifas del operador de facturación electrónica (OSE/PSE), que el cliente contrata por su cuenta.", {
          size: 19,
          color: MUTED,
          italics: true,
          spacingAfter: 80,
        }),

        h2("1. Objeto"),
        p("Desarrollo e implementación de un sistema web a medida para una empresa que fabrica y comercializa productos, con tres bloques operativos:"),
        bulletRich([{ text: "Gestión comercial e inventario: ", bold: true }, { text: "clientes, productos, compras de insumos, ventas, stock y kardex." }]),
        bulletRich([{ text: "Comprobantes electrónicos: ", bold: true }, { text: "factura, boleta, nota de crédito por anulación y guía de remisión electrónica de remitente (GRE), emitidos a través de un operador OSE/PSE." }]),
        bulletRich([{ text: "Producción: ", bold: true }, { text: "recetario de insumos, órdenes de producción y envasado por presentación (litro, galón u otra capacidad que registre el cliente)." }]),
        p("La propuesta corresponde a una primera versión operativa para una (1) empresa, una (1) sede, un (1) almacén y hasta cinco (5) usuarios. Está pensada para empezar a facturar, despachar y producir con control de stock, sin convertir el proyecto en un ERP contable o industrial completo."),

        h2("2. Cómo funciona el negocio en el sistema"),
        p("El sistema distingue cuatro tipos de ítem, para que el recetario y el envasado no se mezclen con la venta:"),
        makeTable(
          [2200, 7546],
          [
            new TableRow({
              children: [
                headerCell("Tipo", 2200),
                headerCell("Rol en la operación", 7546),
              ],
            }),
            new TableRow({
              children: [
                textCell("Materia prima / insumo", 2200, { bold: true, fill: LIGHT, size: 18 }),
                textCell("Se compra y se consume al producir. Ejemplo: solvente, pigmento, activo, aditivo.", 7546, { fill: LIGHT, size: 18 }),
              ],
            }),
            new TableRow({
              children: [
                textCell("Producto a granel", 2200, { bold: true, fill: ALT, size: 18 }),
                textCell("Resultado de la receta, aún sin envase de venta. Se mide en la unidad de la fórmula (por lo general litros o kilos).", 7546, { fill: ALT, size: 18 }),
              ],
            }),
            new TableRow({
              children: [
                textCell("Material de empaque", 2200, { bold: true, fill: LIGHT, size: 18 }),
                textCell("Envase, tapa, etiqueta, caja u otro material que se descuenta al envasar.", 7546, { fill: LIGHT, size: 18 }),
              ],
            }),
            new TableRow({
              children: [
                textCell("Producto terminado", 2200, { bold: true, fill: ALT, size: 18 }),
                textCell("Presentación vendible: 1 L, 4 L, galón u otra capacidad registrada, con su precio y código.", 7546, { fill: ALT, size: 18 }),
              ],
            }),
          ]
        ),
        spacer(120),
        p("La receta define cómo se obtiene el granel. El envasado define en qué presentación se vende. No se copia la receta completa por cada tamaño de envase: se produce una vez y luego se fracciona."),

        h2("3. Alcance incluido"),

        h3("3.1 Plataforma de gestión"),
        makeTable(
          [2800, 6946],
          [
            new TableRow({
              children: [headerCell("Módulo", 2800), headerCell("Qué incluye esta versión", 6946)],
            }),
            ...[
              ["Acceso y usuarios", "Inicio de sesión, hasta 5 usuarios, roles de administrador y vendedor, y bitácora básica de operaciones sensibles."],
              ["Clientes", "Alta y edición con DNI/RUC, dirección y datos de contacto. Búsqueda para la venta y la guía."],
              ["Productos y catálogo", "Insumos, granel, empaques y productos terminados. Precios de venta. Estado activo/inactivo."],
              ["Unidades y presentaciones", "Unidades de medida (kg, L, und, etc.) con capacidad registrada por envase. El sistema no asume que un «galón» equivale siempre a 4 litros: usa la capacidad que indique el cliente."],
              ["Compras", "Registro de compra de insumos y empaques, con ingreso a stock. Control de comprobante del proveedor (serie y número)."],
              ["Ventas / punto de venta", "Venta de producto terminado, descuento de stock, PDF interno de la operación y vínculo con el comprobante electrónico."],
              ["Inventario y kardex", "Stock actual, movimientos de entrada/salida/ajuste, y rastro del documento que originó cada movimiento (compra, producción, envasado, venta o guía)."],
              ["Panel inicial", "Resumen de ventas del período, stock bajo y últimas producciones o emisiones."],
            ].map(([mod, det], i) =>
              new TableRow({
                children: [
                  textCell(mod, 2800, { bold: true, fill: i % 2 === 0 ? LIGHT : ALT, size: 18 }),
                  textCell(det, 6946, { fill: i % 2 === 0 ? LIGHT : ALT, size: 18 }),
                ],
              })
            ),
          ]
        ),

        h3("3.2 Facturación electrónica"),
        p("El sistema emite comprobantes electrónicos mediante un único operador OSE/PSE que el cliente contrata. No se desarrolla una conexión directa con SUNAT desde cero."),
        bullet("Factura electrónica y boleta electrónica, con serie y correlativo del emisor."),
        bullet("Datos del adquirente (DNI o RUC), ítems, cantidades, unidad, precios, IGV y totales."),
        bullet("PDF de representación impresa y descarga de XML cuando el operador lo entregue."),
        bullet("Consulta de estado de emisión (aceptado, rechazado o pendiente) y registro del CDR cuando exista."),
        bullet("Nota de crédito por anulación total del comprobante original. No incluye notas de débito ni notas de crédito por descuento parcial o por ítem en esta versión."),
        bullet("Anulación o baja según el procedimiento que permita el operador contratado."),
        p("Antes de cerrar el calendario de este bloque se confirma que el operador elegido cubre factura, boleta, nota de crédito y GRE. Un proveedor de comprobantes no siempre cubre guías."),

        h3("3.3 Guías de remisión electrónicas"),
        p("Se incluye la GRE de remitente asociada a ventas y despachos de la empresa. SUNAT distingue guía de remitente, de transportista y por evento; esta cotización cubre únicamente la de remitente."),
        bullet("Emisión de GRE de remitente con destinatario, punto de partida y llegada, bienes, cantidades y unidad."),
        bullet("Datos de traslado: motivo, modalidad (privado o público) y datos del vehículo/conductor o transportista, en el nivel que exija el operador."),
        bullet("Relación de la guía con la venta o el comprobante, para no descontar el stock dos veces por la misma salida física."),
        bullet("PDF de la guía y consulta de estado de aceptación."),
        p("No se incluyen GRE de transportista, GRE por evento, ni el flujo de múltiples almacenes o traslados entre sedes."),

        h3("3.4 Producción: recetario, órdenes y envasado"),
        p("Este es el módulo nuevo del proyecto. Permite saber qué insumos consume cada producto, cuánto rinde la fórmula y en qué envase queda listo para la venta."),

        rich([{ text: "Recetario", bold: true, color: STEEL, size: 22 }], { spacingBefore: 80, spacingAfter: 80 }),
        bulletRich([{ text: "Cada receta pertenece a un producto a granel y declara un rendimiento base", size: 21 }], "bullets-prod"),
        bulletRich([{ text: "Lista de insumos con cantidad y unidad (kg, L, g, mL, unidades, etc.).", size: 21 }], "bullets-prod"),
        bulletRich([{ text: "Al ejecutar una orden, el sistema guarda una copia de la receta usada, para no alterar el historial si más adelante se cambia la fórmula.", size: 21 }], "bullets-prod"),
        bulletRich([{ text: "El recetario no se duplica por cada tamaño de envase. El tamaño se resuelve en el envasado.", size: 21 }], "bullets-prod"),

        rich([{ text: "Órdenes de producción", bold: true, color: STEEL, size: 22 }], { spacingBefore: 120, spacingAfter: 80 }),
        bulletRich([{ text: "Alta de orden: receta, cantidad a producir, lote, fecha y responsable.", size: 21 }], "bullets-prod"),
        bulletRich([{ text: "Validación de stock de insumos antes de confirmar.", size: 21 }], "bullets-prod"),
        bulletRich([{ text: "Registro de cantidad prevista y cantidad real, con merma.", size: 21 }], "bullets-prod"),
        bulletRich([{ text: "Al confirmar: descuento de insumos e ingreso del producto a granel al inventario, con kardex.", size: 21 }], "bullets-prod"),

        rich([{ text: "Envasado y presentaciones", bold: true, color: STEEL, size: 22 }], { spacingBefore: 120, spacingAfter: 80 }),
        bulletRich([{ text: "Cada presentación vendible declara su capacidad exacta (por ejemplo 1,00 L; 3,785 L; 4,00 L; 20 L) y los materiales de empaque que consume.", size: 21 }], "bullets-prod"),
        bulletRich([{ text: "Una orden de envasado toma granel de un lote, elige la presentación y la cantidad de envases, y descuenta granel + envase + tapa + etiqueta (según lo configurado).", size: 21 }], "bullets-prod"),
        bulletRich([{ text: "Ingresa al stock el producto terminado listo para vender y facturar.", size: 21 }], "bullets-prod"),
        bulletRich([{ text: "El sistema muestra el saldo a granel restante después de envasar.", size: 21 }], "bullets-prod"),

        spacer(80),
        makeTable(
          [CONTENT_W],
          [
            new TableRow({
              children: [
                cell(
                  [
                    p("Ejemplo ilustrativo de envasado (no es una fórmula química)", {
                      bold: true,
                      size: 19,
                      color: NAVY,
                      spacingAfter: 80,
                    }),
                    p("Si una receta rinde 100 litros a granel, el operador puede envasar, por ejemplo, 60 unidades de 1 litro y 10 unidades de 4 litros. El sistema descuenta 100 L de granel, descuenta 70 envases (más tapas y etiquetas si están en la presentación) e ingresa 70 unidades vendibles. El cliente define la capacidad real de cada envase; un «galón» comercial no se convierte automáticamente a 4 litros.", {
                      size: 19,
                      spacingAfter: 40,
                    }),
                    p("No se convierten kilos a litros sin densidad y una regla validada con el cliente al inicio del proyecto.", {
                      size: 19,
                      italics: true,
                      color: MUTED,
                      spacingAfter: 20,
                    }),
                  ],
                  CONTENT_W,
                  { fill: AMBER, margins: { top: 120, bottom: 120, left: 160, right: 160 } }
                ),
              ],
            }),
          ]
        ),

        h3("3.5 Regla de inventario (crítica para no duplicar salidas)"),
        p("Toda salida física de mercadería descuenta stock una sola vez. Si una venta genera factura y guía, el inventario no se reduce dos veces. Cada movimiento queda ligado al documento que lo originó: compra, orden de producción, envasado, venta, guía o ajuste."),

        h2("4. Inversión"),
        p("El precio es cerrado para el alcance de esta versión. El desglose es comercial; no es una tasación por horas ni un menú para contratar módulos por separado."),
        makeTable(
          [6946, 2800],
          [
            new TableRow({
              children: [
                headerCell("Concepto", 6946),
                headerCell("Importe (S/)", 2800, { align: AlignmentType.RIGHT }),
              ],
            }),
            new TableRow({
              children: [
                textCell("Adaptación de la plataforma de gestión (usuarios, clientes, productos, unidades, compras, ventas, stock y kardex)", 6946, { fill: LIGHT, size: 18 }),
                textCell("S/ 1,500.00", 2800, { fill: LIGHT, align: AlignmentType.RIGHT, size: 18 }),
              ],
            }),
            new TableRow({
              children: [
                textCell("Facturación electrónica: factura, boleta y nota de crédito por anulación (integración con un OSE/PSE)", 6946, { fill: ALT, size: 18 }),
                textCell("S/ 1,200.00", 2800, { fill: ALT, align: AlignmentType.RIGHT, size: 18 }),
              ],
            }),
            new TableRow({
              children: [
                textCell("Guías de remisión electrónicas de remitente, ligadas a la venta y al inventario", 6946, { fill: LIGHT, size: 18 }),
                textCell("S/ 800.00", 2800, { fill: LIGHT, align: AlignmentType.RIGHT, size: 18 }),
              ],
            }),
            new TableRow({
              children: [
                textCell("Módulo de producción: recetario, órdenes, merma, envasado por presentación e inventario asociado", 6946, { fill: ALT, size: 18 }),
                textCell("S/ 1,500.00", 2800, { fill: ALT, align: AlignmentType.RIGHT, size: 18 }),
              ],
            }),
            new TableRow({
              children: [
                textCell("TOTAL DEL PROYECTO", 6946, { bold: true, fill: GREEN, color: WHITE, size: 20 }),
                textCell("S/ 5,000.00", 2800, { bold: true, fill: GREEN, color: WHITE, align: AlignmentType.RIGHT, size: 20 }),
              ],
            }),
          ]
        ),
        spacer(120),
        p("Incluido en el total: configuración inicial, carga asistida del catálogo y recetas que el cliente entregue en la plantilla, una sesión de capacitación de 2 horas y un instructivo breve de uso."),

        h2("5. Forma de pago"),
        makeTable(
          [1800, 5146, 2800],
          [
            new TableRow({
              children: [
                headerCell("Hito", 1800),
                headerCell("Condición", 5146),
                headerCell("Importe (S/)", 2800, { align: AlignmentType.RIGHT }),
              ],
            }),
            new TableRow({
              children: [
                textCell("50%  ·  Inicio", 1800, { bold: true, fill: LIGHT, size: 18 }),
                textCell("Al aceptar esta cotización por escrito. El plazo de entrega se cuenta desde el abono y la recepción de la información mínima de la sección 9.", 5146, { fill: LIGHT, size: 18 }),
                textCell("S/ 2,500.00", 2800, { fill: LIGHT, align: AlignmentType.RIGHT, size: 18 }),
              ],
            }),
            new TableRow({
              children: [
                textCell("30%  ·  Avance", 1800, { bold: true, fill: ALT, size: 18 }),
                textCell("Al demostrar en ambiente de prueba: receta + producción + envasado con movimiento de stock, y emisión de prueba de un comprobante (factura o boleta) y una GRE.", 5146, { fill: ALT, size: 18 }),
                textCell("S/ 1,500.00", 2800, { fill: ALT, align: AlignmentType.RIGHT, size: 18 }),
              ],
            }),
            new TableRow({
              children: [
                textCell("20%  ·  Cierre", 1800, { bold: true, fill: LIGHT, size: 18 }),
                textCell("Al entregar el sistema en producción con el alcance de esta versión y la capacitación acordada.", 5146, { fill: LIGHT, size: 18 }),
                textCell("S/ 1,000.00", 2800, { fill: LIGHT, align: AlignmentType.RIGHT, size: 18 }),
              ],
            }),
          ]
        ),
        spacer(80),
        p("El pago se realiza por transferencia o depósito a la cuenta que indique el proveedor. Cada hito se factura o se documenta según el régimen tributario del proveedor."),

        h2("6. Plazo"),
        p("Treinta y cinco (35) días hábiles, contados desde el abono del 50% y la entrega por el cliente de: datos de la empresa, catálogo inicial, recetas, presentaciones con capacidad real, y acceso de pruebas al operador OSE/PSE."),
        p("Si el operador electrónico, el certificado o la información de recetas se retrasan, el calendario se desplaza el mismo número de días hábiles, sin que ello se considere incumplimiento del proveedor."),

        h2("7. Fuera de alcance"),
        p("Lo siguiente no forma parte de los S/ 5,000. Si se requiere, se cotiza en un presupuesto adicional:"),
        makeTable(
          [CONTENT_W],
          [
            new TableRow({
              children: [
                cell(
                  [
                    bulletRich([{ text: "Caja, créditos a clientes, comisiones, viáticos, cuentas por pagar, cotizaciones comerciales y reportes contables o de rentabilidad avanzada." }], "bullets-out"),
                    bulletRich([{ text: "Múltiples empresas, múltiples sedes o múltiples almacenes; transferencias entre almacenes." }], "bullets-out"),
                    bulletRich([{ text: "Costeo industrial, MRP, planificación de planta, control de calidad de laboratorio, trazabilidad sanitaria completa o fórmulas con densidad y conversiones automáticas kilo/litro." }], "bullets-out"),
                    bulletRich([{ text: "Integración directa con SUNAT (OSE propio), facturación de exportación, detracción, percepción, retención, notas de débito y notas de crédito parciales." }], "bullets-out"),
                    bulletRich([{ text: "GRE de transportista, GRE por evento y manifiestos de traslado distintos a la GRE de remitente de venta." }], "bullets-out"),
                    bulletRich([{ text: "Aplicación móvil nativa, tienda en línea, pasarela de pagos o integración con otro ERP o software contable." }], "bullets-out"),
                    bulletRich([{ text: "Hosting, dominio, correo corporativo, certificado digital y tarifas mensuales o por documento del OSE/PSE." }], "bullets-out"),
                    bulletRich([{ text: "Migración masiva desde Excel u otro sistema más allá de la plantilla inicial acordada; personalizaciones de PDF distintas a la plantilla estándar." }], "bullets-out"),
                    bulletRich([{ text: "Capacitación adicional, soporte continuo o nuevas funciones después de la entrega." }], "bullets-out"),
                  ],
                  CONTENT_W,
                  { fill: RED_SOFT, margins: { top: 100, bottom: 80, left: 80, right: 140 } }
                ),
              ],
            }),
          ]
        ),

        h2("8. Condiciones comerciales"),
        numbered("El precio cubre el alcance de las secciones 2 y 3. Todo pedido fuera de ese alcance se estima y se cobra aparte, por escrito, antes de desarrollarlo.", "conds"),
        numbered("El cliente obtiene una licencia de uso perpetua, no exclusiva, para una empresa, una sede y un almacén, con hasta cinco usuarios. El código fuente permanece en propiedad del proveedor. La cesión de código, la exclusividad o una instalación adicional se cotizan aparte.", "conds"),
        numbered("El cliente es el contribuyente emisor ante SUNAT. El proveedor desarrolla e integra el sistema; no asume la representación tributaria ni las sanciones por datos, series o certificados incorrectos que suministre el cliente.", "conds"),
        numbered("El operador OSE/PSE, sus tarifas y su certificado, si aplica, son contrato y costo del cliente. El proveedor no puede garantizar la aceptación de un CPE si el operador, el ambiente o el certificado fallan.", "conds"),
        numbered("Garantía de treinta (30) días calendario desde la entrega, limitada a defectos del alcance pactado. No cubre mal uso, cambios de SUNAT o del operador, pérdida de claves, ni funciones nuevas.", "conds"),
        numbered("Tras la garantía, el soporte y las mejoras se cotizan por hora o por un mantenimiento mensual opcional.", "conds"),
        numbered("El cliente designa un responsable del proyecto con autoridad para validar recetas, presentaciones, series y pruebas. Las observaciones de cada entrega se concentran en un plazo de cinco (5) días hábiles.", "conds"),
        numbered("Esta cotización no es una factura. La aceptación se formaliza con la firma de la sección 10 y el abono del 50%.", "conds"),
        numbered("Si el cliente no entrega la información mínima o no contrata un operador que cubra factura, boleta, nota de crédito y GRE, el proveedor puede reestimar plazo y precio de la parte tributaria antes de comprometer ese bloque.", "conds"),
        numbered("La vigencia de esta oferta es de quince (15) días calendario a partir de la fecha de emisión.", "conds"),

        h2("9. Información que debe entregar el cliente"),
        p("El trabajo arranca cuando exista, como mínimo:"),
        bulletRich([{ text: "Razón social, RUC, domicilio fiscal, serie de factura, boleta, nota de crédito y GRE." }], "bullets-client"),
        bulletRich([{ text: "Contrato o acceso de pruebas al OSE/PSE, y confirmación de que cubre los cuatro documentos." }], "bullets-client"),
        bulletRich([{ text: "Lista de insumos, empaques y productos terminados, con unidad y capacidad real de cada envase." }], "bullets-client"),
        bulletRich([{ text: "Recetas: producto, rendimiento, insumos y cantidades. Si una receta rinde en kilos y se envasa en litros, indicar la regla (densidad) o se trabajará sin conversión automática." }], "bullets-client"),
        bulletRich([{ text: "Presentaciones de venta y materiales de empaque de cada una (botella, galonera, tapa, etiqueta, etc.)." }], "bullets-client"),
        bulletRich([{ text: "Usuarios iniciales y el responsable que aprobará las pruebas." }], "bullets-client"),

        h2("10. Aceptación"),
        p("La firma de esta sección y el abono del 50% implican la conformidad con el objeto, el alcance, el precio, el plazo y las condiciones de este documento."),
        spacer(200),
        makeTable(
          [4873, 4873],
          [
            new TableRow({
              children: [
                headerCell("POR EL CLIENTE", 4873, { align: AlignmentType.CENTER }),
                headerCell("POR EL PROVEEDOR", 4873, { align: AlignmentType.CENTER }),
              ],
            }),
            new TableRow({
              children: [
                cell(
                  [
                    p(" "),
                    p(" "),
                    p("________________________________", { align: AlignmentType.CENTER, spacingAfter: 40, size: 19 }),
                    p("Nombre y firma", { align: AlignmentType.CENTER, size: 18, color: MUTED, spacingAfter: 40 }),
                    p("Cargo: ________________________", { align: AlignmentType.CENTER, size: 18, spacingAfter: 40 }),
                    p("DNI: ___________________________", { align: AlignmentType.CENTER, size: 18, spacingAfter: 40 }),
                    p("Fecha: _________________________", { align: AlignmentType.CENTER, size: 18, spacingAfter: 20 }),
                  ],
                  4873,
                  { alignV: VerticalAlign.TOP, margins: { top: 200, bottom: 160, left: 120, right: 120 } }
                ),
                cell(
                  [
                    p(" "),
                    p(" "),
                    p("________________________________", { align: AlignmentType.CENTER, spacingAfter: 40, size: 19 }),
                    p("Nombre y firma", { align: AlignmentType.CENTER, size: 18, color: MUTED, spacingAfter: 40 }),
                    p("Cargo: ________________________", { align: AlignmentType.CENTER, size: 18, spacingAfter: 40 }),
                    p("DNI / RUC: ____________________", { align: AlignmentType.CENTER, size: 18, spacingAfter: 40 }),
                    p("Fecha: _________________________", { align: AlignmentType.CENTER, size: 18, spacingAfter: 20 }),
                  ],
                  4873,
                  { alignV: VerticalAlign.TOP, margins: { top: 200, bottom: 160, left: 120, right: 120 } }
                ),
              ],
            }),
          ]
        ),
        spacer(280),
        p("Lima, 15 de septiembre de 2026.", { italics: true, color: MUTED, size: 19, spacingAfter: 40 }),
        p("Este documento describe una primera versión operativa. Cualquier ampliación se tratará como un nuevo alcance, con su propio presupuesto.", {
          size: 18,
          color: MUTED,
          italics: true,
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buffer);
console.log("Wrote", OUT.pathname);
