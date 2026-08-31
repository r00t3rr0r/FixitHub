const n={name:"Online Point GmbH",brand:"McRepair.de",street:"Kurfürstenstr. 106",city:"10787 Berlin",country:"Deutschland"},e=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),r=t=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(t||0)),p=t=>{if(!t)return"-";const a=new Date(t);return Number.isNaN(a.getTime())?"-":a.toLocaleDateString("de-DE")},m=t=>{const a=t.isCreditNote?"Gutschrift":"Rechnung",s=(Array.isArray(t.items)?t.items:[]).map(i=>{const d=Number(i.quantity||0),l=Number(i.unitPrice||0),c=Number(i.total??d*l);return`
        <tr>
          <td>${e(i.description)}</td>
          <td class="num">${d}</td>
          <td class="num">${e(r(l))}</td>
          <td class="num">${e(r(c))}</td>
        </tr>`}).join("");return`<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${e(a)} ${e(t.invoiceNumber)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a2a5e; font-size: 12px; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #f5c800; padding-bottom: 12px; }
  .brand { font-size: 20px; font-weight: bold; }
  .company { text-align: right; font-size: 11px; color: #444; line-height: 1.5; }
  h1 { font-size: 18px; margin: 24px 0 4px; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin-top: 16px; }
  .meta div { line-height: 1.6; }
  .label { color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { background: #1a2a5e; color: #fff; text-align: left; padding: 8px; font-size: 11px; }
  td { padding: 8px; border-bottom: 1px solid #e2e5ee; }
  .num { text-align: right; white-space: nowrap; }
  .totals { margin-top: 16px; margin-left: auto; width: 260px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #1a2a5e; font-weight: bold; font-size: 14px; margin-top: 4px; padding-top: 8px; }
  .notes { margin-top: 28px; font-size: 11px; color: #444; white-space: pre-wrap; }
  footer { margin-top: 32px; border-top: 1px solid #e2e5ee; padding-top: 8px; font-size: 10px; color: #777; }
</style>
</head>
<body>
  <header>
    <div class="brand">${e(n.brand)}</div>
    <div class="company">
      ${e(n.name)}<br />
      ${e(n.street)}<br />
      ${e(n.city)}<br />
      ${e(n.country)}
    </div>
  </header>

  <h1>${e(a)} ${e(t.invoiceNumber)}</h1>

  <div class="meta">
    <div>
      <span class="label">Rechnungsempfänger</span><br />
      <strong>${e(t.customerName)}</strong><br />
      ${e(t.customerEmail)}
    </div>
    <div>
      <span class="label">Rechnungsdatum:</span> ${e(p(t.createdAt||new Date().toISOString()))}<br />
      <span class="label">Fällig am:</span> ${e(p(t.dueDate))}<br />
      <span class="label">Zahlungsziel:</span> ${e(t.paymentTerms||"-")}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Beschreibung</th>
        <th class="num">Menge</th>
        <th class="num">Einzelpreis</th>
        <th class="num">Gesamt</th>
      </tr>
    </thead>
    <tbody>
      ${s||'<tr><td colspan="4">Keine Positionen</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div><span>Netto</span><span>${e(r(t.subtotal))}</span></div>
    ${Number(t.discount||0)>0?`<div><span>Rabatt</span><span>-${e(r(t.discount))}</span></div>`:""}
    <div><span>MwSt.</span><span>${e(r(t.tax))}</span></div>
    <div class="grand"><span>Gesamtbetrag</span><span>${e(r(t.total))}</span></div>
  </div>

  ${t.notes?`<div class="notes"><strong>Hinweis</strong><br />${e(t.notes)}</div>`:""}

  <footer>${e(n.name)} · ${e(n.brand)} · ${e(n.street)}, ${e(n.city)}</footer>
</body>
</html>`},b=t=>{if(!t)return;const a=document.createElement("iframe");a.setAttribute("aria-hidden","true"),a.style.position="fixed",a.style.right="0",a.style.bottom="0",a.style.width="0",a.style.height="0",a.style.border="0",document.body.appendChild(a);const o=()=>{a.parentNode&&a.parentNode.removeChild(a)};a.onload=()=>{const s=a.contentWindow;if(!s){o();return}s.addEventListener("afterprint",o),s.focus(),s.print(),window.setTimeout(o,6e4)},a.srcdoc=m(t)};export{b as p};
