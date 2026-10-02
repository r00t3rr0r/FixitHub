// E2E-Shim: node-cron ist lokal nicht installiert. Zeitgesteuerte Jobs laufen im Test bewusst NICHT.
module.exports = { schedule: (expr) => { console.log('[e2e-shim] node-cron.schedule ignoriert:', expr); return { start() {}, stop() {}, destroy() {} }; }, validate: () => true };
