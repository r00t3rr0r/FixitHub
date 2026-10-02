// Gemeinsame Geldtexte fuer E-Mails, Benachrichtigungen und Meldungen.
//
// Regeln (verbindlich, identisch mit dem Client-Formatter lib/utils.ts formatMoney):
//  - Betraege immer im deutschen Format: "47,40 €" (Tausenderpunkt, Dezimalkomma).
//  - Die Waehrung kommt aus den Daten (Standard EUR), nie aus der Sprache.
//  - Eine UNBEKANNTE Steuer wird nie als "0,00 € MwSt." ausgegeben: ohne gesicherte
//    Steuerangabe steht nur der Bruttobetrag da. Eine echte Steuerbefreiung
//    (Reverse Charge) wird ausdruecklich benannt.

const round2 = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

function formatMoneyDe(value, currency = 'EUR') {
  const code = /^[A-Z]{3}$/.test(String(currency || '')) ? String(currency) : 'EUR';
  try {
    // Normales Leerzeichen statt des geschuetzten (U+00A0), wie alle bisherigen
    // Servertexte ("47,40 €") - sonst unterscheiden sich gleiche Betraege im Mailtext.
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: code })
      .format(round2(value))
      .replace(/ /g, ' ');
  } catch (_error) {
    return `${round2(value).toFixed(2).replace('.', ',')} €`;
  }
}

function formatEuroDe(value) {
  return formatMoneyDe(value, 'EUR');
}

function formatPercentDe(value) {
  const num = round2(value);
  return `${Number.isInteger(num) ? String(num) : String(num).replace('.', ',')} %`;
}

/**
 * Bruttobetrag mit Steuerhinweis, z. B.
 *   describeGross({ gross: 47.4, tax: 7.57, taxRate: 19 })          -> "47,40 € (inkl. 7,57 € MwSt. 19 %)"
 *   describeGross({ gross: 47.4, isReverseCharge: true })            -> "47,40 € (Reverse Charge – ohne MwSt.)"
 *   describeGross({ gross: 47.4 })                                   -> "47,40 €"  (Steuer unbekannt)
 *   describeGross({ gross: 47.4, tax: 7.57, taxRate: 19, discount: 2.5 })
 *                                                                    -> "47,40 € (nach 2,50 € Rabatt, inkl. 7,57 € MwSt. 19 %)"
 */
function describeGross({ gross, tax = null, taxRate = null, isReverseCharge = false, discount = 0, currency = 'EUR' } = {}) {
  const grossText = formatMoneyDe(gross, currency);
  const parts = [];
  const discountValue = round2(discount);
  if (discountValue > 0) parts.push(`nach ${formatMoneyDe(discountValue, currency)} Rabatt`);

  if (isReverseCharge) {
    parts.push('Reverse Charge – ohne MwSt.');
  } else {
    const taxValue = tax === null || tax === undefined || tax === '' ? NaN : Number(tax);
    if (Number.isFinite(taxValue) && taxValue > 0) {
      const rate = Number(taxRate);
      parts.push(`inkl. ${formatMoneyDe(taxValue, currency)} MwSt.${Number.isFinite(rate) && rate > 0 ? ` ${formatPercentDe(rate)}` : ''}`);
    }
  }

  return parts.length > 0 ? `${grossText} (${parts.join(', ')})` : grossText;
}

module.exports = {
  round2,
  formatMoneyDe,
  formatEuroDe,
  formatPercentDe,
  describeGross,
};
