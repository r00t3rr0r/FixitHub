export interface InvoiceItemServiceNameSource {
  serviceName?: string
  description?: string
  type?: string
}

export const getInvoiceItemServiceName = (item: InvoiceItemServiceNameSource): string => {
  const serviceName = item.serviceName?.trim()
  if (serviceName) return serviceName

  const description = item.description?.trim() || ''
  if (item.type === 'service') {
    const separatorIndex = description.lastIndexOf(' – ')
    if (separatorIndex >= 0) return description.slice(separatorIndex + 3).trim() || description
  }

  return description || '-'
}