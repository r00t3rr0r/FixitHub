/**
 * Dialog-Inhalte duerfen vertikal nie abgeschnitten werden (ADMUX-1/2, K12/K17):
 * Ein vom Aufrufer gesetztes "overflow-hidden" / "overflow-y-hidden" wird zu
 * "overflow-x-hidden overflow-y-auto". Passt der Inhalt, aendert sich nichts (abgerundete
 * Ecken clippen weiterhin); ist er hoeher als der Viewport, wird gescrollt statt
 * abgeschnitten. Wer wirklich clippen will, nutzt "overflow-clip".
 * Nur unpraefixierte Klassen werden umgeschrieben (z. B. nicht "sm:overflow-hidden").
 */
export function normalizeDialogOverflow(className?: string) {
  if (!className) return className
  return className
    .replace(/(^|\s)overflow-hidden(?=\s|$)/g, "$1overflow-x-hidden overflow-y-auto")
    .replace(/(^|\s)overflow-y-hidden(?=\s|$)/g, "$1overflow-y-auto")
}
