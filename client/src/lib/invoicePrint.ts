import api from '@/api/api'
import { extractPdfErrorMessage, invoicePdfRequestConfig, toValidPdfBlob } from '@/api/invoices'

export interface PrintableInvoiceItem {
  serviceName?: string
  description?: string
  type?: string
  quantity?: number
  unitPrice?: number
  total?: number
}

export interface PrintableInvoice {
  _id?: string
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
  isReverseCharge?: boolean
  reverseChargeNotice?: string
  customerVatId?: string
  sellerVatId?: string
  zmRelevant?: boolean
  taxRate?: number
}

/**
 * Laedt das kanonische Rechnungs-PDF und oeffnet den Druckdialog des Browsers.
 *
 * Wirft bei Misserfolg einen Fehler mit DEUTSCHER Meldung - der Aufrufer muss ihn
 * anzeigen ('void printInvoice(...)' wuerde den Fehler verschlucken und es saehe so
 * aus, als passiere gar nichts).
 *
 * Request-Konfiguration und PDF-Pruefung kommen aus @/api/invoices, damit Druck und
 * Download denselben (korrekten) Abruf benutzen - siehe die Erklaerung zu
 * transformResponse/validateStatus dort.
 */
export const printInvoice = async (invoice: PrintableInvoice | null | undefined): Promise<void> => {
  if (!invoice?._id) return

  let response
  try {
    response = await api.get(`/api/invoices/${invoice._id}/pdf`, invoicePdfRequestConfig())
  } catch (error: unknown) {
    throw new Error(extractPdfErrorMessage(error, 'print'))
  }

  const pdfBlob = await toValidPdfBlob(response.data)
  const pdfUrl = URL.createObjectURL(pdfBlob)

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
    URL.revokeObjectURL(pdfUrl)
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

  iframe.src = pdfUrl
}
