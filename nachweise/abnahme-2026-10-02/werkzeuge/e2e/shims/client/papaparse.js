// E2E-Shim: papaparse lokal nicht installiert (CSV-Import wird im Test nicht genutzt).
const parse = (input, cfg = {}) => { const res = { data: [], errors: [], meta: {} }; if (cfg.complete) cfg.complete(res); return res; };
export default { parse, unparse: () => '' };
export { parse };
