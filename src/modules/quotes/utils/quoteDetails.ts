import type { Quote } from '../../../shared/types';

export interface QuoteCommercialDetails {
  paymentTerm: string;
  deliveryTime: string;
  deliveryPlace: string;
  observations: string;
  internalNotes: string;
}

/**
 * Lee el formato histórico en el que condiciones y notas se guardaban juntas.
 * Se mantiene para que las cotizaciones creadas antes de los campos estructurados
 * continúen imprimiéndose correctamente.
 */
export function parseLegacyQuoteNotes(notes?: string): QuoteCommercialDetails {
  const result: QuoteCommercialDetails = {
    paymentTerm: '',
    deliveryTime: '',
    deliveryPlace: '',
    observations: '',
    internalNotes: '',
  };
  if (!notes) return result;

  const [publicNotes, internal = ''] = notes.split(/\n\n\[Interno\]\s*/);
  result.internalNotes = internal.trim();

  const bodyLines: string[] = [];
  for (const line of publicNotes.split('\n')) {
    if (line.startsWith('Forma de pago:')) result.paymentTerm = line.replace('Forma de pago:', '').trim();
    else if (line.startsWith('Tiempo de entrega:')) result.deliveryTime = line.replace('Tiempo de entrega:', '').trim();
    else if (line.startsWith('Lugar de entrega:')) result.deliveryPlace = line.replace('Lugar de entrega:', '').trim();
    else bodyLines.push(line);
  }
  result.observations = bodyLines.join('\n').trim();
  return result;
}

export function getQuoteCommercialDetails(quote: Quote): QuoteCommercialDetails {
  const legacy = parseLegacyQuoteNotes(quote.notes);
  return {
    paymentTerm: quote.paymentMethod || legacy.paymentTerm || 'CONTADO',
    deliveryTime: quote.deliveryTime || legacy.deliveryTime || '',
    deliveryPlace: quote.deliveryPlace || legacy.deliveryPlace || '',
    observations: legacy.observations,
    internalNotes: quote.internalNotes || legacy.internalNotes,
  };
}
