const UNITS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
const TENS = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const HUNDREDS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function threeDigits(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const h = Math.floor(n / 100);
  const r = n % 100;
  let out = HUNDREDS[h];
  if (r > 0) {
    if (r <= 20) out += (out ? ' ' : '') + UNITS[r];
    else {
      const t = Math.floor(r / 10);
      const u = r % 10;
      out += (out ? ' ' : '') + TENS[t] + (u === 0 ? '' : (t === 2 ? UNITS[u].toLowerCase() : ' Y ' + UNITS[u]));
    }
  }
  return out.toUpperCase();
}

export function numberToWords(amount: number, currency: 'PEN' | 'USD' = 'PEN'): string {
  const entero = Math.floor(amount);
  const cent = Math.round((amount - entero) * 100);
  let out = '';
  if (entero === 0) out = 'CERO';
  else if (entero < 1000) out = threeDigits(entero);
  else if (entero < 1000000) {
    const miles = Math.floor(entero / 1000);
    const resto = entero % 1000;
    out = (miles === 1 ? 'MIL' : threeDigits(miles) + ' MIL') + (resto > 0 ? ' ' + threeDigits(resto) : '');
  } else {
    const mill = Math.floor(entero / 1000000);
    const rest = entero % 1000000;
    const millPart = mill === 1 ? 'UN MILLON' : threeDigits(mill) + ' MILLONES';
    let restPart = '';
    if (rest >= 1000) {
      const miles = Math.floor(rest / 1000);
      const r2 = rest % 1000;
      restPart = ' ' + (miles === 1 ? 'MIL' : threeDigits(miles) + ' MIL') + (r2 > 0 ? ' ' + threeDigits(r2) : '');
    } else if (rest > 0) {
      restPart = ' ' + threeDigits(rest);
    }
    out = millPart + restPart;
  }
  const suffix = currency === 'USD' ? 'DOLARES AMERICANOS' : 'SOLES';
  return `${out} CON ${String(cent).padStart(2, '0')}/100 ${suffix}`;
}
