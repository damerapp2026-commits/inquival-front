# Análisis interno de alcance y precio

Documento de trabajo para el proveedor. No forma parte de la cotización dirigida al cliente.

Fecha: 15 de septiembre de 2026.

## Conclusión

S/ 5,000 puede funcionar como precio de una primera versión acotada si se reutilizan legalmente la base de gestión y un backend operativo, se integra un servicio de emisión existente y se mantiene el alcance propuesto. No hay evidencia suficiente en este repositorio para afirmar que toda esa base ya está lista. Solo se revisó el frontend; no se probó la API ni la emisión tributaria real.

La cotización adjunta es un borrador comercial de alcance propuesto. Los límites, plazo, garantía y licencia son recomendaciones para esta oferta, no condiciones previamente confirmadas con el usuario. Faltan nombres, RUC y definición de IGV.

## Evidencia del proyecto revisado

| Área | Hallazgo | Implicación |
|---|---|---|
| Gestión comercial | `src/app/routes/AppRoutes.tsx` declara ventas, POS, clientes, compras, productos, stock y kardex, entre otros módulos. | Hay interfaz y organización reutilizables; no demuestra el funcionamiento completo del servidor. |
| Inventario | Los servicios de stock y kardex consultan una API; los tipos contemplan lotes y ajustes. | Reutilizar la base después de verificar sus reglas y transacciones en el backend. |
| Unidades | `UnitsPage.tsx` maneja nombre y abreviatura. `Product` contiene `unit: string`. | Hace falta modelar capacidad, equivalencias, presentación y materiales de empaque. |
| Comprobantes | `InvoicesPage.tsx` agrupa comprobantes de compras y gastos. `voucherTitle` en `voucherPdf.ts` devuelve siempre «Nota de venta». | No presentar estos componentes como prueba de facturación electrónica ya implementada. |
| Guías | Las compras guardan `grSeries`, `grNumber` y `grDate`. | El registro de una referencia no equivale a emitir una GRE. |
| Producción | No se encontraron módulos, rutas ni modelos de recetas, órdenes de producción o envasado en `src`. | Es el principal desarrollo nuevo del alcance. |

## Modelo funcional recomendado

Separar materia prima, producto a granel, material de empaque y producto terminado. Una receta produce una cantidad base; una presentación transforma una parte del lote a granel en unidades vendibles y consume sus envases, tapas y etiquetas. La receta no debe repetirse íntegramente por cada tamaño de envase.

- Receta: producto, rendimiento base, insumos, cantidades y unidades. Guardar una copia en cada orden para conservar su historial.
- Producción: orden, responsable, lote, cantidades previstas y reales, merma y movimientos asociados.
- Envasado: lote de origen, presentación, capacidad, cantidad, materiales utilizados y saldo a granel.
- Presentación: código vendible, precio, contenido exacto y materiales de empaque.
- Inventario: registrar movimientos una sola vez, validar stock y conservar referencia al documento que los generó.
- Venta y guía: un solo descuento de stock para una misma salida física; emitir la guía no debe volver a descontarlo.

No asumir que un «galón» comercial siempre significa 4 litros. Guardar la capacidad indicada por el cliente y mostrarla al operar. No convertir kilos en litros sin información de densidad y una regla validada. El ejemplo de 100 litros y envases de 1 y 4 litros solo explica el envasado; no define una formulación química.

## Emisión electrónica

Proponer un único servicio de integración que cubra facturas, boletas, notas de crédito por anulación total y GRE de remitente. Confirmar cobertura, ambiente de prueba, manejo de errores, consulta de estados, XML, CDR, límites y tarifa antes de cerrar el compromiso técnico. Un proveedor con API para comprobantes no necesariamente ofrece GRE.

La SUNAT distingue las guías de remitente, transportista y por evento. Por ello el precio propuesto limita el desarrollo a la GRE de remitente para ventas. Fuente: [SUNAT: tipos de guía](https://cpe.sunat.gob.pe/node/114).

Para GRE desde sistemas del contribuyente, SUNAT describe envío, validación y respuesta mediante CDR. Un PDF no acredita por sí solo una emisión aceptada. Fuente: [SUNAT: sistemas de emisión](https://cpe.sunat.gob.pe/node/116).

El certificado depende de la modalidad contratada. SUNAT explica que un PSE utiliza su propio certificado para firmar comprobantes en nombre del emisor; evitar prometer al cliente que siempre deberá comprar uno adicional. Fuente: [SUNAT: proveedores de servicios electrónicos](https://cpe.sunat.gob.pe/aliados/pse).

## Protección del precio

El desglose de S/ 5,000 es una distribución comercial sugerida, no una tasación de mercado ni una medición de horas del repositorio. La adaptación de producción y la integración tributaria concentran la incertidumbre.

Como ejercicio interno, si el trabajo consumiera 120 a 170 horas, el ingreso bruto sería aproximadamente S/ 41.67 a S/ 29.41 por hora, antes de tributos, gastos y soporte. Este rango es un supuesto de planificación; no sustituye una estimación tras revisar el backend.

Recomendaciones para sostener ese precio:

- Verificar acceso, propiedad o permiso de reutilización del backend y del código antes de aceptar el plazo.
- Mantener una empresa, una sede, un almacén y una integración de emisión.
- Separar hosting, dominio y consumos del proveedor electrónico del pago de desarrollo.
- Mantener fuera de esta versión el costeo industrial, la planificación de planta, contabilidad, caja, créditos y las demás funciones que aparecen en el sistema de referencia pero no se cotizan.
- Validar reglas y ejemplos con el cliente al inicio; cobrar cambios de alcance con un presupuesto adicional.
- Usar los hitos de S/ 2,500, S/ 1,500 y S/ 1,000, sujetos a la confirmación tributaria.

Si el backend no es reutilizable o el cliente necesita integración directa con SUNAT desde cero, reestimar antes de confirmar el precio cerrado. La licencia de uso propuesta también debe confirmarse: si se ofrece código fuente o exclusividad, reflejarlo en el precio y en el documento.

## Datos pendientes para emitir la cotización

1. Nombre y RUC de cliente y proveedor; contacto y responsable del proyecto.
2. Si S/ 5,000 es el total final, la base antes del IGV o un importe al que no corresponde aplicarlo.
3. Confirmación de límites, plazo de 30 a 40 días hábiles, garantía y modalidad de licencia.
4. Tipo de productos, recetas, unidades, capacidad real de cada envase y necesidad de conservar granel.
5. Servicio de emisión y costos recurrentes; comprobar que cubre los documentos incluidos.

No se modificó el código de la aplicación ni se enviaron documentos a terceros.
