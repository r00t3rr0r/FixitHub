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
  /**
   * EINZIGE Regel fuer "Prozentsatz eines Bruttobetrags" (Haendler-/Gruppenrabatt,
   * prozentuale Aktionsrabatte, Standardrabatt manueller Rechnungen).
   *
   * Sie entspricht bewusst exakt der Berechnung im Warenkorb/Checkout
   * (betrag * (prozent / 100), auf zwei Stellen), damit Warenkorb, Auftrag und
   * Rechnung fuer denselben Fall IMMER denselben Betrag zeigen. Frueher gab es drei
   * verschiedene Formeln: 15 % von 49,90 ergab im Warenkorb 7,48 (42,42 EUR),
   * bei der Auftragsbepreisung und beim Standardrabatt manueller Rechnungen 7,49
   * (42,41 EUR) - je nach Weg ein Cent Unterschied.
   *
   * Hinweis: Das ist die bestehende Warenkorb-Rundung, keine streng kaufmaennische
   * Rundung (die ergaebe bei exakten halben Cent aufgerundet 7,49). Eine Umstellung
   * waere eine Geschaeftsentscheidung und muss dann HIER - und nur hier - erfolgen.
   *
   * @param {number} amount - Bruttobetrag
   * @param {number} percent - Prozentsatz (15 = 15 %)
   * @returns {number}
   */
  static percentOf(amount, percent) {
    const base = Number(amount);
    const pct = Number(percent);
    if (!Number.isFinite(base) || !Number.isFinite(pct) || base <= 0 || pct <= 0) return 0;
    return Number((base * (pct / 100)).toFixed(2));
  }

  static round(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Number((Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2));
  }

  /**
   * FIN-13: Ist ein Steuersatz tatsaechlich gespeichert? Ein ausdruecklich gespeicherter
   * Satz 0 ist ein echter Satz (darf nie per `|| 19` zu 19 werden). Fehlend, null, leer
   * oder nicht numerisch heisst dagegen "nicht gespeichert" (nie stillschweigend 0 %;
   * Number(null) waere 0).
   */
  static hasStoredTaxRate(value) {
    if (value === null || value === undefined || typeof value === 'boolean') return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    const num = Number(value);
    return Number.isFinite(num) && num >= 0;
  }

  /**
   * FIN-13: Steuersatz eines Belegs/Auftrags mit Herkunft.
   *   gespeichert (auch 0) -> { taxRate: <gespeichert>, taxRateSource: 'stored' }
   *   nicht gespeichert    -> { taxRate: <Standardsatz>, taxRateSource: 'default' }
   * defaultRate ist der konfigurierte Standardsatz (Finanzeinstellungen); fehlt er,
   * gilt DEFAULT_TAX_RATE.
   */
  static resolveTaxRate(value, defaultRate = CalculationHelper.DEFAULT_TAX_RATE) {
    if (CalculationHelper.hasStoredTaxRate(value)) {
      return { taxRate: Number(value), taxRateSource: 'stored' };
    }
    const fallback = CalculationHelper.hasStoredTaxRate(defaultRate)
      ? Number(defaultRate)
      : CalculationHelper.DEFAULT_TAX_RATE;
    return { taxRate: fallback, taxRateSource: 'default' };
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
    const discountAmount = CalculationHelper.percentOf(gross, discountPercent);
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
   * DIE Preisregel für den Auftragswert (eine Regel für alle Schreiber: Anlage über
   * POST /api/orders, Service hinzufügen/ändern/löschen, manuelle Position,
   * Zusatzleistungen, Produkte, Gerätewechsel).
   *
   * Regel (brutto-first, Rabatt genau EINMAL auf Auftragsebene):
   *   positionsGross = Summe der Listen-Bruttopreise aller Positionen
   *   promo          = fester Aktionsrabatt (Brutto-Betrag), höchstens positionsGross
   *   groupDiscount  = percentOf(positionsGross - promo, groupDiscountPercent)  (Warenkorb-Regel)
   *   discount       = promo + groupDiscount
   *   totalCost      = positionsGross - discount
   *   netAmount      = totalCost / (1 + taxRate/100);  taxAmount = totalCost - netAmount
   *
   * Der Aktionsrabatt bleibt bei einer späteren Positionsänderung ein FESTER Betrag;
   * nur der prozentuale Kunden-/Händlerrabatt wird neu gerechnet. Das entspricht der
   * Warenkorbrechnung (CartService.buildPricing: Gruppenrabatt auf Zwischensumme minus
   * Aktionsrabatt). Die Positionen selbst werden NIE rabattiert.
   *
   * @param {object} params
   * @param {number} params.positionsGross - Summe der Listen-Bruttopreise
   * @param {number} params.groupDiscountPercent - Kunden-/Händlerrabatt in PROZENT (10 = 10 %)
   * @param {number} params.promoDiscountAmount - fester Aktionsrabatt (Brutto)
   * @param {number} params.taxRatePercent - Steuersatz in Prozent (Standard 19)
   */
  static calculateOrderPricing({
    positionsGross = 0,
    groupDiscountPercent = 0,
    promoDiscountAmount = 0,
    taxRatePercent = CalculationHelper.DEFAULT_TAX_RATE
  } = {}) {
    const gross = CalculationHelper.round(Math.max(0, Number(positionsGross) || 0));
    const percent = Math.min(100, Math.max(0, Number(groupDiscountPercent) || 0));
    const promo = CalculationHelper.round(Math.min(gross, Math.max(0, Number(promoDiscountAmount) || 0)));
    const groupBase = CalculationHelper.round(gross - promo);
    const groupDiscountAmount = CalculationHelper.percentOf(groupBase, percent);
    const discount = CalculationHelper.round(Math.min(gross, promo + groupDiscountAmount));
    const totalCost = CalculationHelper.round(Math.max(0, gross - discount));
    const taxRate = Number.isFinite(Number(taxRatePercent)) ? Number(taxRatePercent) : CalculationHelper.DEFAULT_TAX_RATE;
    const netAmount = CalculationHelper.round(totalCost / (1 + taxRate / 100));
    const taxAmount = CalculationHelper.round(totalCost - netAmount);

    return {
      positionsGross: gross,
      promoDiscountAmount: promo,
      groupDiscountPercent: percent,
      groupDiscountAmount,
      discount,
      totalCost,
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
