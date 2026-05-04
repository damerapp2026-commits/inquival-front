# Plan: Import de precios de referencia desde Excel

> Estado: **planeado** · pendiente de archivo real del cliente y confirmación de cambios backend
> Fecha: 2026-05-04

## 1. Problema que resuelve

El dueño mantiene un Excel paralelo al sistema porque **siempre compara el precio que le venden hoy contra el precio que le vendieron antes**. Esa comparación es su herramienta de negociación con proveedores. Hoy el sistema no le muestra esa información — ni en el catálogo (`/products?view=catalog`) ni en el formulario de nueva compra (`/purchases/new`).

**Objetivo:** importar su Excel histórico al sistema para que el dato esté disponible donde toma la decisión (al registrar una compra), sin que esa data contamine balances, caja ni cuentas por pagar.

## 2. Formato del Excel del cliente

Detectado a partir del screenshot del 21-abr. Fila ejemplo:

```
Kalip Boro x L | Foliar | Boro 100 gr/L | KALIPTRA | 3.70 | 12.95 | 4.37 | 15.28 | 17.11 | 23.00 | 14.12
```

Los colores del Excel coinciden 1:1 con los del catálogo del sistema (amarillo USD, gris PEN, cyan precios de venta, naranja margen).

| # | Columna | Color | Ejemplo | Destino |
|---|---|---|---|---|
| 1 | Producto | — | Kalip Boro x L | Match contra `/products` por nombre |
| 2 | Familia | — | Foliar | Ignorar (ya en `category`) |
| 3 | Composición | — | Boro 100 gr/L | Ignorar (ya en `activeIngredient`) |
| 4 | Laboratorio | — | KALIPTRA | Ignorar (ya en `laboratoryId`) |
| 5 | USD s/IGV | 🟡 amarillo | 3.70 | `referencePrice.sinIgvUsd` |
| 6 | PEN s/IGV | gris | 12.95 | `referencePrice.sinIgvPen` |
| 7 | USD c/IGV | 🟡 amarillo | 4.37 | `referencePrice.conIgvUsd` (solo si GRAVADO) |
| 8 | PEN c/IGV | gris | 15.28 | `referencePrice.conIgvPen` (solo si GRAVADO) |
| 9 | Mayorista | 🔵 cyan | 17.11 | **Ignorar** (ya está en `product.prices[]`) |
| 10 | Minorista | 🔵 cyan | 23.00 | **Ignorar** (ya está en `product.prices[]`) |
| 11 | Margen | 🟠 naranja | 14.12 | Ignorar (derivado en runtime) |

> **Nota:** los precios de venta (mayorista/minorista) ya viven en `product.prices[]` y se editan desde el modal de producto. El import solo trae las **variaciones de costo** que el sistema hoy no maneja: USD/PEN con/sin IGV.

**Tipo de cambio detectado:** ~3.5 (12.95 / 3.70). Se calcula automáticamente y se guarda en `referencePrice.exchangeRate` para poder recalcular conversiones después si fuese necesario.

## 3. Reglas de negocio

1. **Costos USD/PEN con/sin IGV (col 5-8):** lo único que se importa. Es lo que el sistema hoy NO maneja.
2. **Precios de venta (col 9-10):** se ignoran. Ya viven en `product.prices[]` y se administran desde el modal de producto.
3. **Margen (col 11):** no se almacena, se calcula on-the-fly cuando se muestra.
4. **Tax type:** se respeta el `taxType` del Producto en sistema, no el del Excel
   - Si el producto es `EXONERADO` o `INAFECTO` → se ignoran los campos "con IGV" (no aplican)
   - Si es `GRAVADO` → se importan los 4 valores

## 4. Flujo del wizard de import (3 pasos)

Se accede desde `/products?view=catalog` con un nuevo botón **"Importar precios"** junto al filtro de categoría.

### Paso 1 — Subir
- Drop-zone para `.xlsx` / `.xls`
- Detecta automáticamente si la primera fila tiene headers o son datos
- Muestra resumen: N hojas, N filas detectadas

### Paso 2 — Mapear columnas
- Tabla con las primeras 5 filas del Excel a la izquierda
- A la derecha, dropdown por columna para asignar destino:
  - Producto (requerido)
  - USD sin IGV
  - PEN sin IGV
  - USD con IGV
  - PEN con IGV
  - Tipo de cambio (opcional, se calcula auto si no viene)
  - Fecha (opcional)
  - Ignorar (default para columnas no usadas: mayorista, minorista, margen, familia, etc.)
- El sistema sugiere mapeos automáticos basándose en heurísticas (color, posición, header)

### Paso 3 — Preview & match
- Tabla con todas las filas:
  - Columna "Producto Excel"
  - Columna "Producto sistema" — match exacto en verde, sugerencias top-3 en dropdown editable, "sin match" en rojo
  - Columnas USD s/IGV, PEN s/IGV, USD c/IGV, PEN c/IGV con los valores parseados
  - Checkbox por fila para incluir/excluir
- Resumen al pie: `X de Y filas listas para importar · Z sin match`
- Botón final: "Importar N registros"

## 5. Estrategia de matching

Para cada fila del Excel:

1. **Match exacto** por nombre normalizado:
   - Lowercase
   - Sin tildes (NFD + replace diacríticos)
   - Trim de espacios extra
2. Si falla → **fuzzy match** con top-3 sugerencias:
   - Levenshtein distance o trigrams (probar ambos, usar el que dé mejor relevancia)
   - Threshold: solo sugerir si similaridad > 0.6
3. UI permite editar el match manualmente con un combo searchable

## 6. Cambios backend requeridos

### Nuevo campo en `Product`

```ts
referencePrice?: {
  sinIgvUsd?: number;
  sinIgvPen?: number;
  conIgvUsd?: number;
  conIgvPen?: number;
  exchangeRate?: number;
  importedAt: string; // ISO date
}
```

### Nuevo endpoint

```
POST /products/import-reference-prices
Body: [
  {
    productId: string;
    referencePrice: { sinIgvUsd?, sinIgvPen?, conIgvUsd?, conIgvPen?, exchangeRate? };
  }
]
Response: { updated: number; failed: { productId, reason }[] }
```

Endpoint atómico: o se aplican todos o falla con detalle. **Solo toca `product.referencePrice`**, nunca `product.prices[]` (los precios de venta se administran por su flujo aparte).

## 7. Donde se ve el dato después

### Catalog view (`/products?view=catalog`)
- Nueva columna **"Ref. Excel"** (PEN sin IGV)
- Columna **"Δ%"** = `(últimoPrecioCompra - referencePrice.sinIgvPen) / referencePrice.sinIgvPen × 100`
  - Verde si bajó (mejor precio)
  - Rojo si subió (peor precio)

### NewPurchasePage (`/purchases/new`) — el killer feature
- Cuando se selecciona un producto, debajo del input de precio:
  - Tooltip / hint: `📋 Excel: S/ 12.95 · 21 abr` (último precio de referencia)
  - Conforme el usuario escribe el nuevo precio, mostrar delta en vivo: 🔼 +6.1% o 🔽 −3.2%
- Esta es la herramienta de negociación real

## 8. Preguntas abiertas (resolver mañana con el archivo real)

- [ ] **¿La fila 1 del Excel real tiene headers o empieza directo con datos?**
- [ ] **¿Hay múltiples hojas?** (una por categoría, por proveedor, etc.)
- [ ] **¿Cuántas filas tiene aproximadamente?** (afecta paginación del preview)
- [ ] **¿Backend: confirmamos que añades el campo + endpoint, o lo dejamos en `localStorage`?**
- [ ] **¿Los nombres en Excel matchean exacto con los de `/products`, o hay variaciones de tipeo?**

## 9. Roadmap de implementación

Tasks en sistema (prefijo `T#`):

| # | Tarea | Bloqueada por | Estimado |
|---|---|---|---|
| T12 | Backend: campo `referencePrice` + endpoint import | Confirmación cliente | ~half day BE |
| T13 | Excel parser + column mapper component | — | 1 día |
| T14 | Product matcher con fuzzy fallback | — | half day |
| T15 | Import wizard 3-step modal | T13, T14 | 1 día |
| T16 | Display en catalog + NewPurchasePage | T12, T15 | half day |

**Total estimado: ~3-4 días si BE va en paralelo.**

## 10. Plan para mañana

1. Recibir el Excel real del cliente
2. Abrir y verificar:
   - ¿Los headers están?
   - ¿El orden de columnas es el mismo del screenshot?
   - ¿Cuántas filas?
   - ¿Algún caso raro (celdas vacías, fórmulas, totales al final)?
3. Ajustar este plan si hay sorpresas
4. Empezar por T13 (parser) si todo calza
5. T12 (backend) en paralelo si tienes acceso al repo backend o coordinas con quien lo maneja

## 11. Riesgos y consideraciones

- **Nombres con typos:** la fuzzy match cubre la mayoría, pero hay un 5-10% que el usuario tendrá que corregir manualmente. Por eso el preview es editable.
- **Productos en Excel que no existen en `/products`:** se muestran en rojo. Opción: botón "Crear producto" inline que abre el modal de creación con los datos pre-rellenados (Kalip Boro x L → nombre + Foliar → categoría + KALIPTRA → laboratorio). Esto es scope adicional, decidirlo si aparecen muchos.
- **Re-imports:** si el dueño sube el Excel actualizado, el `referencePrice` se sobrescribe. No hay historial de imports — si lo necesita, es un cambio futuro (tabla `referencePriceHistory`).
- **Performance:** si el Excel tiene >1000 filas, el matching fuzzy puede ser lento en el cliente. Si pasa de 500, mover el matching al backend o usar un Web Worker.
