import api from './api'

export type ProfitabilityOrderRow = {
  id: string
  orderId: string
  orderNumber: string
  serviceType: string
  status: string
  progress: number
  paymentLabel: string
  warrantyLabel: string
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
  customerName: string
  customerGroup: string
  serviceType: string
  paymentLabel: string
  warrantyLabel: string
  status: string
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
    flatShippingCostPerBooking: number
    warrantyReserveRate: number
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
  settings: ProfitabilitySettings
  settingsMeta: ProfitabilitySettingsMeta
}

export const getProfitabilityReport = async (limit = 200): Promise<ProfitabilityReportResponse> => {
  try {
    const response = await api.get(`/api/admin/analytics/profitability?limit=${limit}`)
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
