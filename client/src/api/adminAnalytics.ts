import api from './api'

export type ProfitabilityOrderRow = {
  id: string
  orderId: string
  orderNumber: string
  invoiceDate?: string
  invoiceNumber?: string
  orderDate?: string
  externalOrderNumber?: string
  internalOrderNumber?: string
  serviceType: string
  status: string
  progress: number
  paymentLabel: string
  paymentType?: string
  warrantyLabel: string
  companyName?: string
  contactPerson?: string
  customerGroup?: string
  technician?: string
  grossAmount?: number
  netAmount?: number
  netRevenue: number
  directCosts: number
  materialCost: number
  subcontractCost: number
  laborCost: number
  overheadCost: number
  depreciationCost: number
  paymentGatewayFees: number
  shippingFlatCost: number
  otherOperatingCost: number
  profit: number
  marginPercent: number
  technicianCost?: number
  shippingCost?: number
  additionalCost?: number
  packagingCost?: number
  paymentFee?: number
  gatewayProvider?: string
  gatewayFeeRate?: number
  gatewayFeePercentLabel?: string
  gatewayFeeSource?: string
  totalCosts?: number
  contributionMargin?: number
  profitability?: number
  target30Percent?: number
  contributionVsTarget?: number
  ppCredit?: number
  plannedHours: number
  actualHours: number
  trackedHours: number
  hourlyRate: number
  varianceHours: number
  description: string
  device?: string
}

export type ProfitabilityBookingRow = {
  id: string
  bookingNumber: string
  bookingDate: string
  invoiceDate?: string
  invoiceNumber?: string
  orderDate?: string
  externalOrderNumber?: string
  internalOrderNumber?: string
  customerName: string
  companyName?: string
  contactPerson?: string
  customerGroup: string
  customerGroupName: string
  customerGroupKey: string
  customerGroupFinancialCurrency: string
  customerGroupFinancialTaxMode: string
  customerGroupFinancialInvoicePrefix: string
  customerGroupFinancialPaymentTerms: string
  customerGroupFinancialPaymentDueDays: number
  customerGroupFinancialDiscountPercent: number
  customerGroupFinancialCreditLimit: number
  serviceType: string
  paymentLabel: string
  paymentType?: string
  warrantyLabel: string
  status: string
  description?: string
  technician?: string
  grossAmount?: number
  netAmount?: number
  netRevenue: number
  directCosts: number
  materialCost: number
  subcontractCost: number
  laborCost: number
  overheadCost: number
  depreciationCost: number
  paymentGatewayFees: number
  shippingFlatCost: number
  otherOperatingCost: number
  profit: number
  marginPercent: number
  technicianCost?: number
  shippingCost?: number
  additionalCost?: number
  packagingCost?: number
  paymentFee?: number
  gatewayProvider?: string
  gatewayFeeRate?: number
  gatewayFeePercentLabel?: string
  gatewayFeeSource?: string
  totalCosts?: number
  contributionMargin?: number
  profitability?: number
  target30Percent?: number
  contributionVsTarget?: number
  ppCredit?: number
  plannedHours: number
  actualHours: number
  hourlyRate: number
  varianceHours: number
  orderCount: number
  itemSummary: string
  orders: ProfitabilityOrderRow[]
}

export type ProfitabilitySettings = {
  labor: {
    defaultHourlyRate: number
    includeTrackedTimeOnly: boolean
    fallbackProgressWeight: number
    minimumProgressFactor: number
    productHandlingMinutes: number
  }
  materials: {
    repairMaterialBaseRate: number
    repairMaterialPerServiceRate: number
    minimumRepairMaterialRate: number
    maximumRepairMaterialRate: number
    productMaterialRate: number
    fallbackShopProductCostRate: number
  }
  subcontracting: {
    enabled: boolean
    defaultRate: number
    keywords: string[]
  }
  overhead: {
    monthlyRent: number
    monthlyUtilities: number
    monthlyAdminPayroll: number
    monthlySoftware: number
    monthlyInsurance: number
    monthlyMarketing: number
    monthlyOtherFixedCosts: number
    targetMonthlyBillableHours: number
  }
  depreciation: {
    monthlyEquipmentDepreciation: number
  }
  otherCosts: {
    packagingRate: number
    paymentFeeRate: number
    paymentFeeFixedAmount?: number
    flatShippingCostPerBooking: number
    warrantyReserveRate: number
  }
  accounting?: {
    vatRate: number
    targetGrossMarginRate: number
    defaultProjectionWorkdays: number
  }
  warranty: {
    keywords: string[]
    defaultLabel: string
    flaggedLabel: string
  }
  formula: {
    profitWeights: {
      netRevenue: number
      directCosts: number
      overheadCost: number
      depreciationCost: number
      otherOperatingCost: number
    }
    operatingCostWeights: {
      packaging: number
      paymentFallback: number
      paymentGateway: number
      warrantyReserve: number
      orderShipping: number
      bookingFlatShipping: number
    }
  }
}

export type ProfitabilitySettingsMeta = {
  monthlyOverhead: number
  monthlyDepreciation: number
  overheadHourlyRate: number
  depreciationHourlyRate: number
}

export type ProfitabilitySummary = {
  bookings: number
  orders: number
  netRevenue: number
  directCosts: number
  materialCost: number
  subcontractCost: number
  laborCost: number
  overheadCost: number
  depreciationCost: number
  paymentGatewayFees: number
  shippingFlatCost: number
  otherOperatingCost: number
  profit: number
  plannedHours: number
  actualHours: number
  varianceHours: number
  marginPercent: number
  profitableBookings: number
}

export type ProfitabilityReportResponse = {
  success: boolean
  rows: ProfitabilityBookingRow[]
  summary: ProfitabilitySummary
  periodSummary?: {
    totals: Record<string, number>
    workdays: number
    range: { startDate: string | null; endDate: string | null }
    perWorkday: Record<string, number>
    projection: Record<string, number>
  }
  dailySummary?: Array<{
    periodKey: string
    totals: Record<string, number>
    workdays: number
    range: { startDate: string | null; endDate: string | null }
    perWorkday: Record<string, number>
    projection: Record<string, number>
  }>
  monthlySummary?: Array<{
    periodKey: string
    totals: Record<string, number>
    workdays: number
    range: { startDate: string | null; endDate: string | null }
    perWorkday: Record<string, number>
    projection: Record<string, number>
  }>
  calculationMeta?: {
    vatRate: number
    targetGrossMarginRate: number
    projectionWorkdays: number
    configurableFormulas: {
      paymentFeeModel: string
      dynamicAdditionalCosts: string
    }
  }
  settings: ProfitabilitySettings
  settingsMeta: ProfitabilitySettingsMeta
}

export type ProfitabilityReportParams = {
  limit?: number
  startDate?: string | null
  endDate?: string | null
}

export const getProfitabilityReport = async (params: ProfitabilityReportParams = {}): Promise<ProfitabilityReportResponse> => {
  const { limit = 200, startDate, endDate } = params
  const query = new URLSearchParams({ limit: String(limit) })
  if (startDate) query.set('startDate', startDate)
  if (endDate) query.set('endDate', endDate)
  try {
    const response = await api.get(`/api/admin/analytics/profitability?${query.toString()}`)
    return response.data
  } catch (error: any) {
    console.error('Error fetching profitability report:', error)
    throw new Error(error?.response?.data?.error || error.message)
  }
}

export const updateProfitabilitySettings = async (settings: ProfitabilitySettings) => {
  try {
    const response = await api.put('/api/admin/analytics/profitability/settings', settings)
    return response.data
  } catch (error: any) {
    console.error('Error updating profitability settings:', error)
    throw new Error(error?.response?.data?.error || error.message)
  }
}
