// E2E-Shim: qrcode lokal nicht installiert. Liefert ein 1x1-PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const toDataURL = async () => 'data:image/png;base64,' + PNG.toString('base64');
const toBuffer = async () => PNG;
module.exports = { toDataURL, toBuffer, toString: async () => '' };
