/**
 * Scrollposition einer Admin-Liste merken, bevor ein Detail geöffnet wird, und beim
 * Zurückkehren wiederherstellen (ADMUX-4/ADMUX-6). Gescrollt wird der Backoffice-Container
 * <main> (Layout.tsx), nicht das Fenster. Gilt nur, wenn die Liste mit DERSELBEN URL-Suche
 * (Filter, Seite) zurückkehrt; der Eintrag wird beim Lesen entfernt.
 * sessionStorage kann fehlen oder werfen (privates Fenster) - dann passiert einfach nichts.
 */
export function rememberListScroll(key: string, search: string): void {
  try {
    const main = document.querySelector('main')
    sessionStorage.setItem(key, JSON.stringify({ search, top: main ? main.scrollTop : 0 }))
  } catch {
    /* ignorieren */
  }
}

export function restoreListScroll(key: string, search: string, delayMs = 80): void {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return
    sessionStorage.removeItem(key)
    const saved = JSON.parse(raw) as { search?: string; top?: number }
    if (saved && saved.search === search && typeof saved.top === 'number') {
      window.setTimeout(() => {
        const main = document.querySelector('main')
        if (main) main.scrollTop = saved.top as number
      }, delayMs)
    }
  } catch {
    /* sessionStorage nicht verfuegbar */
  }
}
