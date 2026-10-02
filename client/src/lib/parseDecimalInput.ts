/**
 * Liest eine Dezimalzahl aus einem Texteingabefeld (deutsch oder englisch notiert).
 *
 * Hintergrund (SP-9): type="number"-Felder, die direkt mit einer geparsten Zahl
 * gesteuert werden, verlieren in deutschem Chrome Trennzeichen ("12.50" -> 50,
 * "0,02" -> 2). Formulare halten deshalb den eingegebenen TEXT im State und wandeln
 * ihn erst beim Pruefen/Speichern mit dieser Funktion um.
 *
 * Regeln:
 *  - Leerzeichen werden entfernt, "," und "." gelten als Dezimaltrenner.
 *  - Sonst genau EIN Trenner ("1.234" = 1,234; "1.2.3" -> null, statt falsch geraten).
 *  - Ausnahme: eindeutige Tausendergruppierung mit beiden Trennern ("1.234,50" / "1,234.50" -> 1234,5).
 *  - Leere Eingabe -> null (Aufrufer entscheidet, ob leer = 0 oder Pflichtfeld).
 *  - Ergebnis ist eine endliche Zahl oder null.
 */
export function parseDecimalInput(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined) return null
  if (typeof text === 'number') return Number.isFinite(text) ? text : null
  const compact = String(text).replace(/\s+/g, '')
  if (!compact) return null
  // Eindeutige Tausendergruppierung mit BEIDEN Trennern: "1.234,50" (de) bzw. "1,234.50" (en).
  if (/^[+-]?\d{1,3}(\.\d{3})+,\d*$/.test(compact)) {
    const grouped = Number(compact.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(grouped) ? grouped : null
  }
  if (/^[+-]?\d{1,3}(,\d{3})+\.\d*$/.test(compact)) {
    const grouped = Number(compact.replace(/,/g, ''))
    return Number.isFinite(grouped) ? grouped : null
  }
  if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(compact)) return null
  const value = Number(compact.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

/** Formatiert eine Zahl fuer ein Texteingabefeld im deutschen Format ("12,5"). */
export function formatDecimalInput(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return ''
  return new Intl.NumberFormat('de-DE', { useGrouping: false, maximumFractionDigits }).format(Number(value))
}
