# Requerimientos backend — Cajas históricas y migración de deudas antiguas

> Documento técnico para el equipo backend. El frontend ya envía la información necesaria; estos cambios deben implementarse en el servidor.

## Contexto

El cliente registra ventas con **fechas antiguas** desde el POS (modal de cobro). Lo que necesita:

- Que la venta vaya **silenciosamente** a la caja del día correspondiente a `Sale.date`.
- Que esa caja antigua **no se reabra**: si está cerrada, la venta entra igual sin cambiar su estado a `OPEN`.
- Que la caja del día **actual no se vea afectada** por ventas con fecha antigua.

Además: ya existen ventas mal asignadas (apuntan a la caja de hoy cuando su `Sale.date` es de meses atrás). Hay que poder **migrarlas retroactivamente**.

---

## 1. Routing de ventas a la caja correcta (silencioso)

### Frontend ya envía

`POST /sales` payload incluye:

```json
{
  "date": "2025-11-24T15:42:00.000Z",   // ← fecha que escogió el usuario
  "isCredit": true,
  "creditDueDate": "2025-12-24",         // ← ahora correcto (anclado a Sale.date)
  "items": [...],
  "payments": [...],
  "clientId": "..."
}
```

Ver `src/modules/pos/pages/POSPage.tsx:625` (campo `date`).

### Comportamiento esperado del backend

Al recibir `POST /sales`:

1. Extraer la fecha local (`YYYY-MM-DD`) de `payload.date`.
2. Buscar la caja de ese día (`CashRegister.date === YYYY-MM-DD`).
3. **Si existe**: anexar las entradas de venta a esa caja, **sin importar si su `status` es `OPEN` o `CLOSED`**. La caja conserva su estado.
4. **Si no existe**: crear una caja para ese día con `status: 'CLOSED'`, `openingBalance: 0`, y anexar las entradas.
5. **Nunca** afectar la caja del día actual cuando la venta es retro-fechada.

### Reglas adicionales

- Los `CashRegisterEntry.createdAt` deben usar `Sale.date` (no `now()`), para que el orden cronológico tenga sentido.
- El movimiento de stock (kardex) también debe usar `Sale.date`, no `now()`.
- Para auditoría, dejar `Sale.createdAt = now()` (timestamp real de registro) y `Sale.date = payload.date` (fecha efectiva). Ya están separados en el modelo.
- Si la venta es a crédito, el `CreditAccount.createdAt` también debería ser `Sale.date` (no `now()`) para coherencia.

### Caja del día actual

Cuando `payload.date` coincide con hoy, el flujo actual no cambia: entra a la caja del día (que debe estar `OPEN`). El cambio solo aplica para fechas antiguas.

---

## 2. Migración de ventas mal asignadas

Hay `Sale` cuya `date` es antigua pero quedaron registradas en `CashRegisterEntry` de la caja del día en que se ingresaron (no de la fecha efectiva).

### Endpoint propuesto

```
POST /admin/cash-registers/migrate-misplaced-sales
Body: { dryRun: boolean, from?: string, to?: string }
Response: {
  scanned: number,
  misplaced: { saleId, saleDate, currentCashRegisterDate, targetCashRegisterDate }[],
  migrated: number    // 0 si dryRun=true
}
```

### Algoritmo

Para cada `Sale`:

1. Calcular `saleDateLocal = YYYY-MM-DD` de `Sale.date`.
2. Buscar la `CashRegisterEntry` con `referenceType='Sale' AND referenceId=sale.id`.
3. Obtener `currentRegister = CashRegister` que contiene esa entry.
4. Si `currentRegister.date !== saleDateLocal`:
   - Marcar como mal-asignada.
   - Si `dryRun=false`: mover la entry (y sus split-payments) a la caja de `saleDateLocal`, creándola con `status: 'CLOSED'` si no existe.

### Recomendación de rollout

1. Ejecutar primero con `dryRun: true` y enviar el reporte al cliente para confirmar.
2. Ejecutar la migración real solo después de aprobación.
3. Idempotente: ejecutar 2 veces no debe duplicar nada.

---

## 3. Reporte previo (ya disponible para el front)

Para que el front muestre el conflicto antes de migrar, el endpoint con `dryRun: true` es suficiente. Alternativamente, exponer:

```
GET /admin/sales/misplaced-in-cash-register
Response: { saleId, saleDate, currentCashRegisterDate, amount, clientName }[]
```

El front puede listarlas y pedir confirmación.

---

## 4. Pre-existente: "deuda histórica" en créditos

Ya existe `POST /credits/historical` (ver `src/modules/credits/services/creditService.ts:7`) que crea un `CreditAccount` sin venta asociada. Para deudas **previas al sistema** el cliente debería usar ese modal (`RegisterHistoricalCreditModal`) en vez de meter ventas falsas en el POS.

**Sugerencia opcional**: bloquear en el POS la creación de ventas con fecha > N meses atrás y redirigir al modal de deuda histórica. Hay que decidir el umbral con el cliente.

---

## Checklist de aceptación

- [ ] `POST /sales` con `date` antigua crea/usa caja de ese día sin alterar la caja de hoy.
- [ ] Caja cerrada de un día antiguo recibe ventas sin reabrirse.
- [ ] `CashRegisterEntry.createdAt` refleja `Sale.date`, no `now()`.
- [ ] Movimientos de stock/kardex usan `Sale.date`.
- [ ] Endpoint `migrate-misplaced-sales` corre en modo `dryRun` y reporta correctamente.
- [ ] Migración real es idempotente (no duplica entries).
- [ ] El frontend ya envía el `date` correcto y `creditDueDate` correcto — verificar contra `src/modules/pos/pages/POSPage.tsx:610-626`.
