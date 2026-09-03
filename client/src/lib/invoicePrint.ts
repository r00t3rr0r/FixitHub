import api from '@/api/api'

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
}

/**
 * Loads the canonical invoice PDF and opens the browser print dialog.
 */
export const printInvoice = async (invoice: PrintableInvoice | null | undefined): Promise<void> => {
  if (!invoice?._id) return

  const response = await api.get(`/api/invoices/${invoice._id}/pdf`, {
    responseType: 'blob',
    transformResponse: undefined,
    validateStatus: (status) => status === 200,
  })
  const pdfUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))

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
