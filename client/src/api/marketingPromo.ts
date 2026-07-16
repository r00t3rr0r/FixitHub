import api from './api'

export type MarketingStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'archived'
export type PromoStatus = 'draft' | 'active' | 'inactive' | 'expired' | 'archived'

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export interface MarketingSegment {
  _id: string
  internalName: string
  description: string
  status: 'active' | 'archived'
  rules: {
    roles: string[]
    statuses: string[]
    newsletterOptInOnly: boolean
    includeCustomerGroupIds: string[]
    includeCountries: string[]
    minTotalOrders: number
    minTotalSpent: number
    createdAfter?: string
    createdBefore?: string
  }
  lastPreviewCount: number
  createdAt: string
  updatedAt: string
}

export interface Newsletter {
  _id: string
  internalName: string
  subject: string
  preheader: string
  content: string
  templateName: string
  status: MarketingStatus
  scheduledAt?: string | null
  sentAt?: string | null
  segmentId?: { _id: string; internalName: string } | null
  campaignId?: { _id: string; internalName: string; status: string } | null
  promoCodeIds?: Array<{ _id: string; code: string; internalName: string; status: string }>
  stats: {
    sent: number
    opened: number
    clicked: number
    bounced: number
    unsubscribed: number
    failed: number
  }
  createdAt: string
  updatedAt: string
}

export interface PromoCode {
  _id: string
  internalName: string
  code: string
  description: string
  discountType: 'percentage' | 'fixed_amount'
  value: number
  startDate: string
  endDate: string
  status: PromoStatus
  usageCount: number
  discountVolume: number
  revenueAttributed: number
  rules: {
    minimumOrderValue: number
    usageLimitTotal: number
    usageLimitPerCustomer: number
    combinable: boolean
    productIds: string[]
    serviceCategoryIds: string[]
    customerGroupIds: string[]
  }
  campaignId?: { _id: string; internalName: string; status: string } | null
  newsletterIds?: string[]
  createdAt: string
  updatedAt: string
}

export interface NewsletterDelivery {
  _id: string
  recipientEmail: string
  status: string
  isTest: boolean
  sentAt?: string
  error?: string
  createdAt: string
}

export interface PromoRedemption {
  _id: string
  promoCodeId?: {
    _id: string
    code: string
    internalName?: string
  }
  code: string
  orderAmount: number
  discountAmount: number
  redeemedAt: string
  customerId?: {
    _id: string
    firstName?: string
    lastName?: string
    email: string
  }
  orderId?: {
    _id: string
    orderNumber: string
    totalCost: number
    status: string
  }
}

export interface MarketingAuditLog {
  _id: string
  action: string
  entityType: string
  entityLabel: string
  performedByEmail: string
  details: Record<string, unknown>
  createdAt: string
}

export interface MarketingSettings {
  _id: string
  defaultFromName: string
  defaultReplyTo: string
  trackOpens: boolean
  trackClicks: boolean
  allowTestSend: boolean
  maxSendBatchSize: number
}

export interface OverviewResponse {
  newsletterKpis: {
    sent: number
    opened: number
    clicked: number
    bounced: number
    unsubscribed: number
    failed: number
  }
  promoKpis: {
    activeCodes: number
    redemptions: number
    discountVolume: number
    revenueAttributed: number
  }
  recentNewsletters: Newsletter[]
  recentPromoCodes: PromoCode[]
  recentAudit: MarketingAuditLog[]
}

export const getMarketingOverview = async (params?: Record<string, string>) => {
  const response = await api.get('/api/admin/marketing-promo/overview', { params })
  return response.data as { success: boolean } & OverviewResponse
}

export const getMarketingReports = async (params?: Record<string, string>) => {
  const response = await api.get('/api/admin/marketing-promo/reports', { params })
  return response.data as {
    success: boolean
    period: { from: string; to: string }
    newsletterRows: Newsletter[]
    promoRows: PromoCode[]
    redemptionRows: PromoRedemption[]
    newsletterDeliveryStats: Array<{ _id: string; count: number }>
  }
}

export const listMarketingAuditLogs = async (params?: Record<string, string>) => {
  const response = await api.get('/api/admin/marketing-promo/audit-log', { params })
  return response.data as {
    success: boolean
    rows: MarketingAuditLog[]
    pagination: Pagination
  }
}

export const getMarketingSettings = async () => {
  const response = await api.get('/api/admin/marketing-promo/settings')
  return response.data as { success: boolean; settings: MarketingSettings }
}

export const updateMarketingSettings = async (payload: Partial<MarketingSettings>) => {
  const response = await api.put('/api/admin/marketing-promo/settings', payload)
  return response.data as { success: boolean; settings: MarketingSettings; message: string }
}

// ─── ADCELL Tracking Config ────────────────────────────────────────────────

export interface AdcellConfig {
  enabled: boolean
  pid: string
  eventId: string
  conversionEnabled: boolean
  firstPartyEnabled: boolean
  containerTagsEnabled: boolean
}

export const getAdcellConfig = async () => {
  const response = await api.get('/api/admin/marketing-promo/adcell-config')
  return response.data as { success: boolean; config: AdcellConfig }
}

export const updateAdcellConfig = async (payload: Partial<AdcellConfig>) => {
  const response = await api.put('/api/admin/marketing-promo/adcell-config', payload)
  return response.data as { success: boolean; config: AdcellConfig; message: string }
}

/** Public (no-auth) endpoint – used by tracking scripts across the app */
export const getPublicAdcellConfig = async (): Promise<AdcellConfig> => {
  try {
    const response = await fetch('/api/adcell-config')
    const data = await response.json()
    return data.config as AdcellConfig
  } catch {
    return { enabled: false, pid: '10419', eventId: '13229', conversionEnabled: false, firstPartyEnabled: false, containerTagsEnabled: false }
  }
}

// ─── ADCELL Excluded Customer Groups ────────────────────────────────────────

export const getAdcellExcludedCustomerGroups = async () => {
  const response = await api.get('/api/admin/marketing-promo/adcell-excluded-groups')
  return response.data as { success: boolean; excludedGroupIds: string[] }
}

export const updateAdcellExcludedCustomerGroups = async (excludedGroupIds: string[]) => {
  const response = await api.put('/api/admin/marketing-promo/adcell-excluded-groups', { excludedGroupIds })
  return response.data as { success: boolean; excludedGroupIds: string[]; message: string }
}

export const checkIsUserExcludedFromAdcell = async (): Promise<boolean> => {
  try {
    const response = await api.get('/api/adcell-is-excluded')
    return response.data?.isExcluded ?? false
  } catch {
    return false
  }
}

export const listNewsletters = async (params?: Record<string, string | number>) => {
  const response = await api.get('/api/admin/marketing-promo/newsletters', { params })
  return response.data as {
    success: boolean
    rows: Newsletter[]
    pagination: Pagination
  }
}

export const createNewsletter = async (payload: Partial<Newsletter> & Record<string, unknown>) => {
  const response = await api.post('/api/admin/marketing-promo/newsletters', payload)
  return response.data as { success: boolean; newsletter: Newsletter; message: string }
}

export const updateNewsletter = async (id: string, payload: Partial<Newsletter> & Record<string, unknown>) => {
  const response = await api.put(`/api/admin/marketing-promo/newsletters/${id}`, payload)
  return response.data as { success: boolean; newsletter: Newsletter; message: string }
}

export const duplicateNewsletter = async (id: string) => {
  const response = await api.post(`/api/admin/marketing-promo/newsletters/${id}/duplicate`)
  return response.data as { success: boolean; newsletter: Newsletter; message: string }
}

export const archiveNewsletter = async (id: string) => {
  const response = await api.post(`/api/admin/marketing-promo/newsletters/${id}/archive`)
  return response.data as { success: boolean; newsletter: Newsletter; message: string }
}

export const testSendNewsletter = async (id: string, testEmail: string) => {
  const response = await api.post(`/api/admin/marketing-promo/newsletters/${id}/test-send`, { testEmail })
  return response.data as { success: boolean; message: string; result: { success: boolean; error?: string } }
}

export const scheduleNewsletter = async (id: string, scheduledAt: string) => {
  const response = await api.post(`/api/admin/marketing-promo/newsletters/${id}/schedule`, { scheduledAt })
  return response.data as { success: boolean; newsletter: Newsletter; message: string }
}

export const sendNewsletterNow = async (id: string) => {
  const response = await api.post(`/api/admin/marketing-promo/newsletters/${id}/send`)
  return response.data as {
    success: boolean
    message: string
    newsletter: Newsletter
    delivery: { total: number; sent: number; failed: number }
  }
}

export const listNewsletterDeliveries = async (id: string, params?: Record<string, string | number>) => {
  const response = await api.get(`/api/admin/marketing-promo/newsletters/${id}/deliveries`, { params })
  return response.data as {
    success: boolean
    rows: NewsletterDelivery[]
    pagination: Pagination
  }
}

export const listPromoCodes = async (params?: Record<string, string | number>) => {
  const response = await api.get('/api/admin/marketing-promo/promo-codes', { params })
  return response.data as {
    success: boolean
    rows: PromoCode[]
    pagination: Pagination
  }
}

export const createPromoCode = async (payload: Partial<PromoCode> & Record<string, unknown>) => {
  const response = await api.post('/api/admin/marketing-promo/promo-codes', payload)
  return response.data as { success: boolean; promoCode: PromoCode; message: string }
}

export const updatePromoCode = async (id: string, payload: Partial<PromoCode> & Record<string, unknown>) => {
  const response = await api.put(`/api/admin/marketing-promo/promo-codes/${id}`, payload)
  return response.data as { success: boolean; promoCode: PromoCode; message: string }
}

export const togglePromoCode = async (id: string, enabled: boolean) => {
  const response = await api.post(`/api/admin/marketing-promo/promo-codes/${id}/toggle-active`, { enabled })
  return response.data as { success: boolean; promoCode: PromoCode; message: string }
}

export const archivePromoCode = async (id: string) => {
  const response = await api.post(`/api/admin/marketing-promo/promo-codes/${id}/archive`)
  return response.data as { success: boolean; promoCode: PromoCode; message: string }
}

export const listPromoRedemptions = async (id: string, params?: Record<string, string | number>) => {
  const response = await api.get(`/api/admin/marketing-promo/promo-codes/${id}/redemptions`, { params })
  return response.data as {
    success: boolean
    rows: PromoRedemption[]
    pagination: Pagination
  }
}

export const listSegments = async (params?: Record<string, string | number>) => {
  const response = await api.get('/api/admin/marketing-promo/segments', { params })
  return response.data as {
    success: boolean
    rows: MarketingSegment[]
    pagination: Pagination
  }
}

export const createSegment = async (payload: Partial<MarketingSegment> & Record<string, unknown>) => {
  const response = await api.post('/api/admin/marketing-promo/segments', payload)
  return response.data as { success: boolean; segment: MarketingSegment; message: string }
}

export const updateSegment = async (id: string, payload: Partial<MarketingSegment> & Record<string, unknown>) => {
  const response = await api.put(`/api/admin/marketing-promo/segments/${id}`, payload)
  return response.data as { success: boolean; segment: MarketingSegment; message: string }
}

export const previewSegment = async (id: string) => {
  const response = await api.get(`/api/admin/marketing-promo/segments/${id}/preview`)
  return response.data as {
    success: boolean
    preview: {
      count: number
      sample: Array<{ _id: string; email: string; firstName?: string; lastName?: string; name?: string }>
    }
  }
}
