/**
 * CalculationHelper - Domänenberechnungen für das FixitHub Rechnungssystem
 * 
 * Behandelt die 3 unabhängigen Kernkonzepte:
 * 1. Auftragswert (Immer Brutto, Händlerrabatt vor MwSt-Berechnung, Netto = Brutto / 1.19, MwSt = Brutto - Netto)
 * 2. Zahlungen (Unabhängige Geldflüsse mit Datum, Betrag, Zahlart, Hinweis, Transaktions-ID)
 * 3. Rechnungssumme (Finaler Rechnungsbetrag als Basis für die MwSt-Berechnung auf der Rechnung)
 */

class CalculationHelper {
  static DEFAULT_TAX_RATE = 19.0; // 19% MwSt Standard

  /**
   * Rundet kaufmännisch auf 2 Dezimalstellen
   * @param {number} value
   * @returns {number}
   */
  static round(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Number((Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2));
  }

  /**
   * Berechnet den Auftragswert für Endkunden und Händler
   * Regel:
   * - Auftragswert ist immer Brutto
   * - Bei Händleraufträgen wird der Rabatt direkt vom Bruttobetrag abgezogen
   * - Netto = Auftragswert (nach Rabatt) / (1 + Steuersatz/100)
   * - MwSt = Auftragswert (nach Rabatt) - Netto
   * 
   * @param {number} grossAmount - Ursprünglicher Bruttobetrag vor Rabatt
   * @param {number} dealerDiscountPercent - Händlerrabatt in Prozent (z.B. 10 für 10%)
   * @param {number} taxRatePercent - Steuersatz in Prozent (Standard: 19)
   */
  static calculateOrderValue(grossAmount, dealerDiscountPercent = 0, taxRatePercent = CalculationHelper.DEFAULT_TAX_RATE) {
    const gross = CalculationHelper.round(grossAmount);
    const discountPercent = Math.max(0, Number(dealerDiscountPercent) || 0);
    const taxRate = Number.isFinite(Number(taxRatePercent)) ? Number(taxRatePercent) : CalculationHelper.DEFAULT_TAX_RATE;
    const taxDivisor = 1 + (taxRate / 100);

    // 1. Rabattierung vom Bruttobetrag abziehen
    const discountAmount = CalculationHelper.round((gross * discountPercent) / 100);
    const orderValueGross = CalculationHelper.round(Math.max(0, gross - discountAmount));

    // 2. Netto und MwSt aus dem finalen Brutto-Auftragswert ermitteln
    const netAmount = CalculationHelper.round(orderValueGross / taxDivisor);
    const taxAmount = CalculationHelper.round(orderValueGross - netAmount);

    return {
      originalGrossAmount: gross,
      dealerDiscountPercent: discountPercent,
      dealerDiscountAmount: discountAmount,
      currentGrossAmount: orderValueGross,
      netAmount,
      taxAmount,
      taxRate
    };
  }

  /**
   * Berechnet die finale Rechnungssumme und die Steuerbestandteile für eine Rechnung
   * Regel:
   * - Die Rechnungssumme (Brutto) bildet die Basis für die MwSt-Berechnung auf der Rechnung
   * - Netto = Rechnungssumme / (1 + Steuersatz/100)
   * - MwSt = Rechnungssumme - Netto
   * 
   * @param {Array<{total: number, unitPrice?: number, quantity?: number, type?: string, description?: string}>} items
   * @param {object} options
   * @param {number} options.taxRatePercent - Steuersatz (Standard 19)
   * @param {number} options.additionalDiscount - Zusätzlicher Rabattbetrag (Brutto, immer positiver Betrag)
   * @param {boolean} options.isReverseCharge - Innergemeinschaftliche Lieferung (Reverse Charge / 0% MwSt)
   * @param {boolean} options.allowNegative - Gutschriften: negative Summen zulassen statt auf 0 zu kappen
   */
  static calculateInvoiceTotals(items = [], options = {}) {
    const isReverseCharge = Boolean(options.isReverseCharge);
    const taxRate = isReverseCharge
      ? 0
      : (Number.isFinite(Number(options.taxRatePercent)) ? Number(options.taxRatePercent) : CalculationHelper.DEFAULT_TAX_RATE);
    const taxDivisor = 1 + (taxRate / 100);
    const additionalDiscount = CalculationHelper.round(options.additionalDiscount || 0);

    const calculatedItems = (items || []).map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const grossTotal = CalculationHelper.round(
        item.total != null ? item.total : (Number(item.unitPrice || 0) * quantity)
      );
      const netTotal = CalculationHelper.round(grossTotal / taxDivisor);
      const itemTax = CalculationHelper.round(grossTotal - netTotal);
      const unitGrossPrice = CalculationHelper.round(grossTotal / quantity);
      const unitNetPrice = CalculationHelper.round(netTotal / quantity);

      return {
        ...item,
        quantity,
        unitGrossPrice,
        unitNetPrice,
        lineGrossTotal: grossTotal,
        lineNetTotal: netTotal,
        taxRate,
        total: grossTotal
      };
    });

    const itemsGrossTotal = CalculationHelper.round(
      calculatedItems.reduce((sum, it) => sum + (it.lineGrossTotal || 0), 0)
    );

    // Der Rabatt wird GENAU EINMAL vom Bruttobetrag abgezogen; Netto/MwSt werden danach
    // aus dem rabattierten Brutto herausgerechnet (niemals oben draufgerechnet).
    // Gutschriften (allowNegative) rechnen auf dem Betrag und setzen das Vorzeichen einmal am Ende.
    const allowNegative = Boolean(options.allowNegative);
    const invoiceGrossTotal = allowNegative
      ? CalculationHelper.round(
        Math.sign(itemsGrossTotal || 0) * Math.max(0, Math.abs(itemsGrossTotal) - Math.abs(additionalDiscount))
      )
      : CalculationHelper.round(Math.max(0, itemsGrossTotal - additionalDiscount));
    const invoiceNetTotal = CalculationHelper.round(invoiceGrossTotal / taxDivisor);
    const invoiceTaxTotal = CalculationHelper.round(invoiceGrossTotal - invoiceNetTotal);

    return {
      items: calculatedItems,
      itemsGrossTotal,
      discount: additionalDiscount,
      invoiceGrossTotal,
      invoiceNetTotal,
      invoiceTaxTotal,
      isReverseCharge,
      // Kompatibilitätsfelder für bestehenden Code
      total: invoiceGrossTotal,
      subtotal: invoiceNetTotal,
      tax: invoiceTaxTotal,
      taxRate
    };
  }

  /**
   * Berechnet den Saldo und Zahlungsstatus einer Rechnung
   * @param {number} invoiceGrossTotal - Finale Rechnungssumme (Brutto)
   * @param {number} paidAmount - Summe aller erfassten Zahlungen
   */
  static calculateBalance(invoiceGrossTotal, paidAmount = 0) {
    const total = CalculationHelper.round(invoiceGrossTotal);
    const paid = CalculationHelper.round(paidAmount);
    const openBalance = CalculationHelper.round(Math.max(0, total - paid));

    let status = 'draft';
    if (paid >= total - 0.01 && total > 0) {
      status = 'paid';
    } else if (paid > 0) {
      status = 'partially_paid';
    } else {
      status = 'sent';
    }

    return {
      total,
      paidAmount: paid,
      openBalance,
      isFullyPaid: paid >= total - 0.01 && total > 0,
      status
    };
  }
}

module.exports = CalculationHelper;
