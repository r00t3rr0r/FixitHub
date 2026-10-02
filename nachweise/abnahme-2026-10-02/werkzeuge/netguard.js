// Blockiert und protokolliert JEDE ausgehende Verbindung ausser localhost (und gesperrte Ports, z. B. 27017).
const net = require('net'), tls = require('tls'), fs = require('fs');
const LOG = process.env.NETGUARD_LOG;
const BLOCK = String(process.env.NETGUARD_BLOCK_PORTS || '').split(',').map((x) => x.trim()).filter(Boolean);
const blockedPort = (p) => BLOCK.includes(String(p));
const local = (h) => !h || /^(127\.|localhost$|::1$|0\.0\.0\.0$)/.test(String(h));
const note = (h, p) => { if (LOG) fs.appendFileSync(LOG, `BLOCKED ${h}:${p}\n`); };
const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let o = Array.isArray(args[0]) ? args[0][0] : args[0]; let host, port;
  if (typeof o === 'object' && o) { host = o.host; port = o.port; } else { port = args[0]; host = args[1]; }
  if (!(typeof o === 'object' && o && o.path) && (!local(host) || blockedPort(port))) { note(host, port); throw new Error(`NETGUARD: ausgehende Verbindung zu ${host}:${port} blockiert`); }
  return origConnect.apply(this, args);
};
const origTls = tls.connect;
tls.connect = function (...args) {
  const o = typeof args[0] === 'object' ? args[0] : { port: args[0], host: args[1] };
  if (!local(o.host || o.servername)) { note(o.host || o.servername, o.port); throw new Error(`NETGUARD: TLS zu ${o.host || o.servername} blockiert`); }
  return origTls.apply(this, args);
};
