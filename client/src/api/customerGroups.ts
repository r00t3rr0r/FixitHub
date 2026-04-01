import api from './api';

export type CustomerGroupStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type AttributionModel = 'first_click' | 'last_click' | 'fixed_source';

export interface CustomerGroup {
  _id: string;
  key: string;
  name: string;
  description: string;
  status: CustomerGroupStatus;
  priority: number;
  mode: 'standard' | 'vip' | 'b2b' | 'affiliate' | 'custom';
  isExclusive: boolean;
  isDefault: boolean;
  validFrom?: string;
  validUntil?: string;
  customerCount?: number;
  financeProfile: {
    discountPercent: number;
    paymentDueDays: number;
    cashDiscountPercent: number;
    cashDiscountDays: number;
    creditLimit: number;
    currency: string;
    taxMode: 'default' | 'tax_free' | 'reverse_charge' | 'custom';
    paymentTermsLabel: string;
    invoicePrefix: string;
    invoiceProfile?: {
      invoiceSeries?: string;
      consolidateInvoices?: boolean;
      splitByOrderType?: boolean;
      requireManualApprovalAbove?: number;
    };
    allowedPaymentMethods: string[];
  };
  affiliateProfile: {
    attributionModel: AttributionModel;
    fixedAffiliateId?: string;
    defaultCommissionType: 'fixed' | 'percentage';
    defaultCommissionValue: number;
    releaseTrigger: 'order_created' | 'order_completed' | 'invoice_created' | 'invoice_paid';
    holdDays: number;
    allowProductOverrides?: boolean;
  };
  assignmentMode?: {
    allowManual: boolean;
    allowRuleBased: boolean;
    allowApi: boolean;
  };
  metadata?: {
    tags?: string[];
    notes?: string;
  };
  conflictPolicy?: {
    resolutionStrategy: 'priority' | 'manual_first' | 'exclusive_first';
    fallbackGroupId?: string;
    excludedGroupIds?: string[];
  };
}

export type RuleConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';

export interface RuleCondition {
  field: string;
  operator: RuleConditionOperator;
  value: string | number | boolean | string[];
}

export interface CustomerGroupRule {
  _id: string;
  name: string;
  status: CustomerGroupStatus;
  priority: number;
  groupId: {
    _id: string;
    name: string;
    key: string;
    status?: CustomerGroupStatus;
  };
  stopProcessing: boolean;
  exclusivityMode: 'normal' | 'exclusive' | 'fallback_only';
  conditions: RuleCondition[];
  excludedIf: RuleCondition[];
  validFrom?: string;
  validUntil?: string;
}

export interface CustomerGroupRulePayload {
  name: string;
  status?: CustomerGroupStatus;
  priority?: number;
  groupId: string;
  stopProcessing?: boolean;
  exclusivityMode?: CustomerGroupRule['exclusivityMode'];
  conditions?: RuleCondition[];
  excludedIf?: RuleCondition[];
  validFrom?: string;
  validUntil?: string;
}

export interface CustomerGroupRuleListResponse {
  rules: CustomerGroupRule[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export interface GroupCustomerAssignment {
  _id: string;
  customerId: {
    _id: string;
    name: string;
    email: string;
    company?: string;
    country?: string;
    customerNumber?: string;
    totalOrders?: number;
    totalSpent?: number;
  };
  groupId: string;
  isPrimary: boolean;
  assignmentType: 'manual' | 'rule' | 'api' | 'import' | 'migration';
  status: 'active' | 'expired' | 'revoked';
  createdAt: string;
  source?: {
    note?: string;
  };
}

export interface GroupCustomersResponse {
  customers: GroupCustomerAssignment[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export interface RulePreviewResult {
  matched: boolean;
  matchesConditions: boolean;
  excluded: boolean;
  checkedConditions: number;
  checkedExclusions: number;
}

export interface CustomerGroupFinancialSummary {
  groupId: string;
  groupName: string;
  activeAssignments: number;
  paymentDueDays: number;
  discountPercent: number;
  cashDiscountPercent: number;
  cashDiscountDays: number;
  creditLimit: number;
  currency: string;
  taxMode: CustomerGroup['financeProfile']['taxMode'];
  paymentTermsLabel: string;
  invoicePrefix: string;
  allowedPaymentMethods: string[];
}

export interface CustomerGroupAffiliateSummary {
  groupId: string;
  groupName: string;
  attributionModel: AttributionModel;
  defaultCommissionType: 'fixed' | 'percentage';
  defaultCommissionValue: number;
  releaseTrigger: CustomerGroup['affiliateProfile']['releaseTrigger'];
  holdDays: number;
  attributionsCount: number;
  commissions: {
    pending: { count: number; amount: number };
    approved: { count: number; amount: number };
    released: { count: number; amount: number };
    reversed: { count: number; amount: number };
  };
}

export interface CustomerGroupOverview {
  totalGroups: number;
  activeGroups: number;
  inactiveGroups: number;
  archivedGroups: number;
  totalRules: number;
  totalAssignments: number;
  customerCount: number;
}

export interface CustomerGroupListResponse {
  groups: CustomerGroup[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export interface CustomerGroupPayload {
  key?: string;
  name?: string;
  description?: string;
  status?: CustomerGroupStatus;
  priority?: number;
  mode?: CustomerGroup['mode'];
  isExclusive?: boolean;
  isDefault?: boolean;
  validFrom?: string;
  validUntil?: string;
  assignmentMode?: {
    allowManual?: boolean;
    allowRuleBased?: boolean;
    allowApi?: boolean;
  };
  financeProfile?: Partial<CustomerGroup['financeProfile']>;
  affiliateProfile?: Partial<CustomerGroup['affiliateProfile']>;
  metadata?: {
    tags?: string[];
    notes?: string;
  };
  conflictPolicy?: Partial<CustomerGroup['conflictPolicy']>;
}

export const getCustomerGroupOverview = async (): Promise<CustomerGroupOverview> => {
  const response = await api.get('/api/admin/customer-groups/overview');
  return response.data.overview;
};

export const getCustomerGroups = async (params: Record<string, unknown> = {}): Promise<CustomerGroupListResponse> => {
  const response = await api.get('/api/admin/customer-groups', { params });
  return {
    groups: response.data.groups || [],
    total: response.data.total || 0,
    totalPages: response.data.totalPages || 1,
    currentPage: response.data.currentPage || 1,
  };
};

export const createCustomerGroup = async (payload: CustomerGroupPayload): Promise<CustomerGroup> => {
  const response = await api.post('/api/admin/customer-groups', payload);
  return response.data.group;
};

export const updateCustomerGroup = async (groupId: string, payload: CustomerGroupPayload): Promise<CustomerGroup> => {
  const response = await api.put(`/api/admin/customer-groups/${groupId}`, payload);
  return response.data.group;
};

export const updateCustomerGroupStatus = async (groupId: string, status: CustomerGroupStatus): Promise<CustomerGroup> => {
  const response = await api.patch(`/api/admin/customer-groups/${groupId}/status`, { status });
  return response.data.group;
};

export const deleteCustomerGroup = async (groupId: string): Promise<void> => {
  await api.delete(`/api/admin/customer-groups/${groupId}`);
};

export const getCustomerGroupRules = async (params: Record<string, unknown> = {}): Promise<CustomerGroupRuleListResponse> => {
  const response = await api.get('/api/admin/customer-groups/rules', { params });
  return {
    rules: response.data.rules || [],
    total: response.data.total || 0,
    totalPages: response.data.totalPages || 1,
    currentPage: response.data.currentPage || 1,
  };
};

export const createCustomerGroupRule = async (payload: CustomerGroupRulePayload): Promise<CustomerGroupRule> => {
  const response = await api.post('/api/admin/customer-groups/rules', payload);
  return response.data.rule;
};

export const updateCustomerGroupRule = async (ruleId: string, payload: Partial<CustomerGroupRulePayload>): Promise<CustomerGroupRule> => {
  const response = await api.put(`/api/admin/customer-groups/rules/${ruleId}`, payload);
  return response.data.rule;
};

export const updateCustomerGroupRuleStatus = async (ruleId: string, status: CustomerGroupStatus): Promise<CustomerGroupRule> => {
  const response = await api.patch(`/api/admin/customer-groups/rules/${ruleId}/status`, { status });
  return response.data.rule;
};

export const previewCustomerGroupRule = async (payload: {
  conditions?: RuleCondition[];
  excludedIf?: RuleCondition[];
  context?: Record<string, unknown>;
}): Promise<RulePreviewResult> => {
  const response = await api.post('/api/admin/customer-groups/rules/preview', payload);
  return response.data.preview;
};

export const getGroupCustomers = async (groupId: string, params: Record<string, unknown> = {}): Promise<GroupCustomersResponse> => {
  const response = await api.get(`/api/admin/customer-groups/${groupId}/customers`, { params });
  return {
    customers: response.data.customers || [],
    total: response.data.total || 0,
    totalPages: response.data.totalPages || 1,
    currentPage: response.data.currentPage || 1,
  };
};

export const createGroupAssignment = async (
  groupId: string,
  payload: { customerId: string; isPrimary?: boolean; note?: string }
): Promise<GroupCustomerAssignment> => {
  const response = await api.post(`/api/admin/customer-groups/${groupId}/assignments`, payload);
  return response.data.assignment;
};

export const revokeGroupAssignment = async (groupId: string, assignmentId: string): Promise<void> => {
  await api.delete(`/api/admin/customer-groups/${groupId}/assignments/${assignmentId}`);
};

export const recalculateCustomerGroups = async (customerId: string): Promise<{
  primaryGroupId: string | null;
  assignedGroupIds: string[];
  assignmentCount: number;
}> => {
  const response = await api.post(`/api/admin/customer-groups/customers/${customerId}/groups/recalculate`);
  return response.data.result;
};

export const setCustomerPrimaryGroup = async (customerId: string, primaryGroupId: string): Promise<void> => {
  await api.put(`/api/admin/customer-groups/customers/${customerId}/groups/primary`, { primaryGroupId });
};

export const getCustomerGroupFinancialSummary = async (groupId: string): Promise<CustomerGroupFinancialSummary> => {
  const response = await api.get(`/api/admin/customer-groups/${groupId}/financial-summary`);
  return response.data.summary;
};

export const getCustomerGroupAffiliateSummary = async (groupId: string): Promise<CustomerGroupAffiliateSummary> => {
  const response = await api.get(`/api/admin/customer-groups/${groupId}/affiliate-summary`);
  return response.data.summary;
};