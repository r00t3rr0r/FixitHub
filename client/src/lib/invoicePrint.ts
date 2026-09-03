import { getInvoiceItemServiceName } from './invoiceItems'

export interface PrintableInvoiceItem {
  serviceName?: string
  description?: string
  type?: string
  quantity?: number
  unitPrice?: number
  total?: number
}

export interface PrintableInvoice {
  invoiceNumber?: string
  customerName?: string
  customerEmail?: string
  items?: PrintableInvoiceItem[]
  subtotal?: number
  tax?: number
  discount?: number
  total?: number
  dueDate?: string
  createdAt?: string
  notes?: string
  paymentTerms?: string
  isCreditNote?: boolean
}

const COMPANY = {
  name: 'Online Point GmbH',
  brand: 'McRepair.de',
  street: 'Kurfürstenstr. 106',
  city: '10787 Berlin',
  country: 'Deutschland',
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatCurrency = (value?: number): string =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(value || 0))

const formatDate = (value?: string): string => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('de-DE')
}

const buildInvoiceHtml = (invoice: PrintableInvoice): string => {
  const title = invoice.isCreditNote ? 'Gutschrift' : 'Rechnung'
  const items = Array.isArray(invoice.items) ? invoice.items : []

  const rows = items
    .map((item) => {
      const quantity = Number(item.quantity || 0)
      const unitPrice = Number(item.unitPrice || 0)
      const total = Number(item.total ?? quantity * unitPrice)
      return `
        <tr>
          <td>${escapeHtml(getInvoiceItemServiceName(item))}</td>
          <td class="num">${quantity}</td>
          <td class="num">${escapeHtml(formatCurrency(unitPrice))}</td>
          <td class="num">${escapeHtml(formatCurrency(total))}</td>
        </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} ${escapeHtml(invoice.invoiceNumber)}</title>
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
    <div class="brand">${escapeHtml(COMPANY.brand)}</div>
    <div class="company">
      ${escapeHtml(COMPANY.name)}<br />
      ${escapeHtml(COMPANY.street)}<br />
      ${escapeHtml(COMPANY.city)}<br />
      ${escapeHtml(COMPANY.country)}
    </div>
  </header>

  <h1>${escapeHtml(title)} ${escapeHtml(invoice.invoiceNumber)}</h1>

  <div class="meta">
    <div>
      <span class="label">Rechnungsempfänger</span><br />
      <strong>${escapeHtml(invoice.customerName)}</strong><br />
      ${escapeHtml(invoice.customerEmail)}
    </div>
    <div>
      <span class="label">Rechnungsdatum:</span> ${escapeHtml(formatDate(invoice.createdAt || new Date().toISOString()))}<br />
      <span class="label">Fällig am:</span> ${escapeHtml(formatDate(invoice.dueDate))}<br />
      <span class="label">Zahlungsziel:</span> ${escapeHtml(invoice.paymentTerms || '-')}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Service Name</th>
        <th class="num">Menge</th>
        <th class="num">Einzelpreis</th>
        <th class="num">Gesamt</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="4">Keine Positionen</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div><span>Netto</span><span>${escapeHtml(formatCurrency(invoice.subtotal))}</span></div>
    ${Number(invoice.discount || 0) > 0 ? `<div><span>Rabatt</span><span>-${escapeHtml(formatCurrency(invoice.discount))}</span></div>` : ''}
    <div><span>MwSt.</span><span>${escapeHtml(formatCurrency(invoice.tax))}</span></div>
    <div class="grand"><span>Gesamtbetrag</span><span>${escapeHtml(formatCurrency(invoice.total))}</span></div>
  </div>

  ${invoice.notes ? `<div class="notes"><strong>Hinweis</strong><br />${escapeHtml(invoice.notes)}</div>` : ''}

  <footer>${escapeHtml(COMPANY.name)} · ${escapeHtml(COMPANY.brand)} · ${escapeHtml(COMPANY.street)}, ${escapeHtml(COMPANY.city)}</footer>
</body>
</html>`
}

/**
 * Renders the invoice into a hidden iframe and opens the browser print dialog.
 */
export const printInvoice = (invoice: PrintableInvoice | null | undefined): void => {
  if (!invoice) return

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe)
    }
  }

  iframe.onload = () => {
    const printWindow = iframe.contentWindow
    if (!printWindow) {
      cleanup()
      return
    }

    printWindow.addEventListener('afterprint', cleanup)
    printWindow.focus()
    printWindow.print()
    // Safari/Firefox do not always fire afterprint
    window.setTimeout(cleanup, 60000)
  }

  iframe.srcdoc = buildInvoiceHtml(invoice)
}
