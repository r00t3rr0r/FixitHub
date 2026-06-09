import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import {
  createCustomerGroup,
  createCustomerGroupRule,
  createGroupAssignment,
  deleteCustomerGroup,
  getCustomerGroupAffiliateSummary,
  getCustomerGroupFinancialSummary,
  getCustomerGroupOverview,
  getCustomerGroupRules,
  getCustomerGroups,
  getGroupCustomers,
  previewCustomerGroupRule,
  recalculateCustomerGroups,
  revokeGroupAssignment,
  setCustomerPrimaryGroup,
  updateCustomerGroup,
  updateCustomerGroupRule,
  updateCustomerGroupRuleStatus,
  updateCustomerGroupStatus,
  type CustomerGroup,
  type CustomerGroupOverview,
  type CustomerGroupPayload,
  type CustomerGroupRule,
  type CustomerGroupStatus,
  type GroupCustomerAssignment,
  type RuleCondition,
} from '@/api/customerGroups';
import { getUsers, type User } from '@/api/users';
import { Plus, RefreshCw, Search, Settings2, ShieldCheck } from 'lucide-react';

type MainTab = 'overview' | 'groups' | 'rules' | 'assignments' | 'finance' | 'affiliate' | 'reporting';

type GroupFormState = {
  key: string;
  name: string;
  description: string;
  status: CustomerGroupStatus;
  priority: string;
  mode: CustomerGroup['mode'];
  isExclusive: boolean;
  isDefault: boolean;
  validFrom: string;
  validUntil: string;
  allowManual: boolean;
  allowRuleBased: boolean;
  allowApi: boolean;
  paymentDueDays: string;
  discountPercent: string;
  cashDiscountPercent: string;
  cashDiscountDays: string;
  creditLimit: string;
  currency: string;
  taxMode: CustomerGroup['financeProfile']['taxMode'];
  paymentTermsLabel: string;
  invoicePrefix: string;
  invoiceSeries: string;
  consolidateInvoices: boolean;
  splitByOrderType: boolean;
  requireManualApprovalAbove: string;
  allowedPaymentMethods: string[];
  attributionModel: CustomerGroup['affiliateProfile']['attributionModel'];
  fixedAffiliateId: string;
  defaultCommissionType: CustomerGroup['affiliateProfile']['defaultCommissionType'];
  commissionValue: string;
  releaseTrigger: CustomerGroup['affiliateProfile']['releaseTrigger'];
  holdDays: string;
  allowProductOverrides: boolean;
  conflictResolutionStrategy: 'priority' | 'manual_first' | 'exclusive_first';
  fallbackGroupId: string;
  excludedGroupIds: string[];
  tags: string;
  notes: string;
};

type RuleFormState = {
  id?: string;
  name: string;
  status: CustomerGroupStatus;
  priority: string;
  groupId: string;
  stopProcessing: boolean;
  exclusivityMode: CustomerGroupRule['exclusivityMode'];
  conditions: RuleCondition[];
  excludedIf: RuleCondition[];
};

const emptyGroupForm: GroupFormState = {
  key: '',
  name: '',
  description: '',
  status: 'active',
  priority: '0',
  mode: 'standard',
  isExclusive: false,
  isDefault: false,
  validFrom: '',
  validUntil: '',
  allowManual: true,
  allowRuleBased: true,
  allowApi: true,
  paymentDueDays: '14',
  discountPercent: '0',
  cashDiscountPercent: '0',
  cashDiscountDays: '0',
  creditLimit: '0',
  currency: 'EUR',
  taxMode: 'default',
  paymentTermsLabel: 'Net 14',
  invoicePrefix: '',
  invoiceSeries: '',
  consolidateInvoices: false,
  splitByOrderType: false,
  requireManualApprovalAbove: '0',
  allowedPaymentMethods: ['bank_transfer'],
  attributionModel: 'last_click',
  fixedAffiliateId: '',
  defaultCommissionType: 'percentage',
  commissionValue: '0',
  releaseTrigger: 'invoice_paid',
  holdDays: '0',
  allowProductOverrides: true,
  conflictResolutionStrategy: 'priority',
  fallbackGroupId: '',
  excludedGroupIds: [],
  tags: '',
  notes: '',
};

const emptyRuleCondition: RuleCondition = {
  field: 'country',
  operator: 'eq',
  value: '',
};

const emptyRuleForm: RuleFormState = {
  name: '',
  status: 'draft',
  priority: '0',
  groupId: '',
  stopProcessing: false,
  exclusivityMode: 'normal',
  conditions: [{ ...emptyRuleCondition }],
  excludedIf: [],
};

const paymentMethods = ['bank_transfer', 'invoice', 'paypal', 'credit_card', 'debit_card', 'stripe'];

const badgeClassByStatus: Record<CustomerGroupStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  inactive: 'bg-amber-100 text-amber-700 border-amber-200',
  archived: 'bg-gray-100 text-gray-700 border-gray-200',
};

function toDateInput(value?: string) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export function CustomerGroupsManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [overview, setOverview] = useState<CustomerGroupOverview | null>(null);
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [rules, setRules] = useState<CustomerGroupRule[]>([]);
  const [customers, setCustomers] = useState<GroupCustomerAssignment[]>([]);
  const [customerCandidates, setCustomerCandidates] = useState<User[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerGroupStatus>('all');
  const [ruleSearch, setRuleSearch] = useState('');

  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupFormState>(emptyGroupForm);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(emptyRuleForm);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [previewContext, setPreviewContext] = useState('{"country":"DE","customerType":"business","lifetimeRevenue":5500}');
  const [previewResult, setPreviewResult] = useState<null | {
    matched: boolean;
    matchesConditions: boolean;
    excluded: boolean;
    checkedConditions: number;
    checkedExclusions: number;
  }>(null);

  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [affiliateSummary, setAffiliateSummary] = useState<any>(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group._id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const loadCore = async () => {
    setLoading(true);
    try {
      const [overviewData, groupData, ruleData, usersData] = await Promise.all([
        getCustomerGroupOverview(),
        getCustomerGroups({ search: searchTerm, status: statusFilter, page: 1, limit: 200 }),
        getCustomerGroupRules({ search: ruleSearch, page: 1, limit: 100 }),
        getUsers({ role: 'customer', page: 1, limit: 200 }),
      ]);

      setOverview(overviewData);
      setGroups(groupData.groups);
      setRules(ruleData.rules);
      setCustomerCandidates(usersData.users);

      const nextGroupId = selectedGroupId || groupData.groups[0]?._id || '';
      setSelectedGroupId(nextGroupId);
      if (nextGroupId) {
        const [groupCustomers, financeData, affiliateData] = await Promise.all([
          getGroupCustomers(nextGroupId, { status: 'active', page: 1, limit: 200 }),
          getCustomerGroupFinancialSummary(nextGroupId),
          getCustomerGroupAffiliateSummary(nextGroupId),
        ]);
        setCustomers(groupCustomers.customers);
        setFinancialSummary(financeData);
        setAffiliateSummary(affiliateData);
      } else {
        setCustomers([]);
        setFinancialSummary(null);
        setAffiliateSummary(null);
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('customerGroupsManagement.loadError'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCore();
  }, [searchTerm, statusFilter, ruleSearch]);

  useEffect(() => {
    const loadGroupScopedData = async () => {
      if (!selectedGroupId) return;
      try {
        const [groupCustomers, financeData, affiliateData] = await Promise.all([
          getGroupCustomers(selectedGroupId, { status: 'active', page: 1, limit: 200 }),
          getCustomerGroupFinancialSummary(selectedGroupId),
          getCustomerGroupAffiliateSummary(selectedGroupId),
        ]);
        setCustomers(groupCustomers.customers);
        setFinancialSummary(financeData);
        setAffiliateSummary(affiliateData);
      } catch (error: any) {
        toast({
          title: t('common.error'),
          description: error.message || 'Gruppendaten konnten nicht geladen werden.',
          variant: 'destructive',
        });
      }
    };

    loadGroupScopedData();
  }, [selectedGroupId]);

  const buildGroupPayload = (): CustomerGroupPayload => ({
    key: groupForm.key,
    name: groupForm.name,
    description: groupForm.description,
    status: groupForm.status,
    priority: Number(groupForm.priority || 0),
    mode: groupForm.mode,
    isExclusive: groupForm.isExclusive,
    isDefault: groupForm.isDefault,
    validFrom: groupForm.validFrom || undefined,
    validUntil: groupForm.validUntil || undefined,
    assignmentMode: {
      allowManual: groupForm.allowManual,
      allowRuleBased: groupForm.allowRuleBased,
      allowApi: groupForm.allowApi,
    },
    financeProfile: {
      paymentDueDays: Number(groupForm.paymentDueDays || 14),
      discountPercent: Number(groupForm.discountPercent || 0),
      cashDiscountPercent: Number(groupForm.cashDiscountPercent || 0),
      cashDiscountDays: Number(groupForm.cashDiscountDays || 0),
      creditLimit: Number(groupForm.creditLimit || 0),
      currency: groupForm.currency,
      taxMode: groupForm.taxMode,
      paymentTermsLabel: groupForm.paymentTermsLabel,
      invoicePrefix: groupForm.invoicePrefix,
      invoiceProfile: {
        invoiceSeries: groupForm.invoiceSeries,
        consolidateInvoices: groupForm.consolidateInvoices,
        splitByOrderType: groupForm.splitByOrderType,
        requireManualApprovalAbove: Number(groupForm.requireManualApprovalAbove || 0),
      },
      allowedPaymentMethods: groupForm.allowedPaymentMethods,
    },
    affiliateProfile: {
      attributionModel: groupForm.attributionModel,
      fixedAffiliateId: groupForm.fixedAffiliateId,
      defaultCommissionType: groupForm.defaultCommissionType,
      defaultCommissionValue: Number(groupForm.commissionValue || 0),
      releaseTrigger: groupForm.releaseTrigger,
      holdDays: Number(groupForm.holdDays || 0),
      allowProductOverrides: groupForm.allowProductOverrides,
    },
    conflictPolicy: {
      resolutionStrategy: groupForm.conflictResolutionStrategy,
      fallbackGroupId: groupForm.fallbackGroupId || undefined,
      excludedGroupIds: groupForm.excludedGroupIds,
    },
    metadata: {
      tags: groupForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: groupForm.notes,
    },
  });

  const openCreateGroup = () => {
    setEditingGroupId(null);
    setGroupForm(emptyGroupForm);
    setShowGroupDialog(true);
  };

  const openEditGroup = (group: CustomerGroup) => {
    setEditingGroupId(group._id);
    setGroupForm({
      key: group.key,
      name: group.name,
      description: group.description || '',
      status: group.status,
      priority: String(group.priority || 0),
      mode: group.mode,
      isExclusive: group.isExclusive,
      isDefault: group.isDefault,
      validFrom: toDateInput(group.validFrom),
      validUntil: toDateInput(group.validUntil),
      allowManual: group.assignmentMode?.allowManual ?? true,
      allowRuleBased: group.assignmentMode?.allowRuleBased ?? true,
      allowApi: group.assignmentMode?.allowApi ?? true,
      paymentDueDays: String(group.financeProfile?.paymentDueDays ?? 14),
      discountPercent: String(group.financeProfile?.discountPercent ?? 0),
      cashDiscountPercent: String(group.financeProfile?.cashDiscountPercent ?? 0),
      cashDiscountDays: String(group.financeProfile?.cashDiscountDays ?? 0),
      creditLimit: String(group.financeProfile?.creditLimit ?? 0),
      currency: group.financeProfile?.currency ?? 'EUR',
      taxMode: group.financeProfile?.taxMode ?? 'default',
      paymentTermsLabel: group.financeProfile?.paymentTermsLabel ?? 'Net 14',
      invoicePrefix: group.financeProfile?.invoicePrefix ?? '',
      invoiceSeries: group.financeProfile?.invoiceProfile?.invoiceSeries ?? '',
      consolidateInvoices: Boolean(group.financeProfile?.invoiceProfile?.consolidateInvoices),
      splitByOrderType: Boolean(group.financeProfile?.invoiceProfile?.splitByOrderType),
      requireManualApprovalAbove: String(group.financeProfile?.invoiceProfile?.requireManualApprovalAbove ?? 0),
      allowedPaymentMethods: group.financeProfile?.allowedPaymentMethods || ['bank_transfer'],
      attributionModel: group.affiliateProfile?.attributionModel ?? 'last_click',
      fixedAffiliateId: group.affiliateProfile?.fixedAffiliateId ?? '',
      defaultCommissionType: group.affiliateProfile?.defaultCommissionType ?? 'percentage',
      commissionValue: String(group.affiliateProfile?.defaultCommissionValue ?? 0),
      releaseTrigger: group.affiliateProfile?.releaseTrigger ?? 'invoice_paid',
      holdDays: String(group.affiliateProfile?.holdDays ?? 0),
      allowProductOverrides: group.affiliateProfile?.allowProductOverrides ?? true,
      conflictResolutionStrategy: group.conflictPolicy?.resolutionStrategy ?? 'priority',
      fallbackGroupId: group.conflictPolicy?.fallbackGroupId ?? '',
      excludedGroupIds: group.conflictPolicy?.excludedGroupIds || [],
      tags: (group.metadata?.tags || []).join(', '),
      notes: group.metadata?.notes || '',
    });
    setShowGroupDialog(true);
  };

  const saveGroup = async () => {
    if (!groupForm.name.trim()) {
      toast({ title: t('common.error'), description: t('customerGroupsManagement.nameRequired'), variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingGroupId) {
        await updateCustomerGroup(editingGroupId, buildGroupPayload());
      } else {
        await createCustomerGroup(buildGroupPayload());
      }
      setShowGroupDialog(false);
      await loadCore();
      toast({
        title: t('common.success'),
        description: editingGroupId ? t('customerGroupsManagement.updatedSuccess') : t('customerGroupsManagement.createdSuccess'),
      });
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || t('customerGroupsManagement.saveError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveRule = async () => {
    if (!ruleForm.name.trim() || !ruleForm.groupId) {
      toast({ title: t('common.error'), description: 'Regelname und Zielgruppe sind erforderlich.', variant: 'destructive' });
      return;
    }

    const payload = {
      name: ruleForm.name,
      status: ruleForm.status,
      priority: Number(ruleForm.priority || 0),
      groupId: ruleForm.groupId,
      stopProcessing: ruleForm.stopProcessing,
      exclusivityMode: ruleForm.exclusivityMode,
      conditions: ruleForm.conditions,
      excludedIf: ruleForm.excludedIf,
    };

    setSaving(true);
    try {
      if (ruleForm.id) {
        await updateCustomerGroupRule(ruleForm.id, payload);
      } else {
        await createCustomerGroupRule(payload);
      }
      setShowRuleDialog(false);
      setRuleForm(emptyRuleForm);
      await loadCore();
      toast({ title: t('common.success'), description: 'Regel wurde gespeichert.' });
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || 'Regel konnte nicht gespeichert werden.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const runRulePreview = async () => {
    try {
      const parsedContext = JSON.parse(previewContext || '{}');
      const result = await previewCustomerGroupRule({
        conditions: ruleForm.conditions,
        excludedIf: ruleForm.excludedIf,
        context: parsedContext,
      });
      setPreviewResult(result);
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || 'Preview konnte nicht ausgeführt werden.', variant: 'destructive' });
    }
  };

  const assignCustomer = async () => {
    if (!selectedGroupId || !selectedCustomerId) return;
    try {
      await createGroupAssignment(selectedGroupId, {
        customerId: selectedCustomerId,
        note: assignmentNote,
        isPrimary: false,
      });
      setSelectedCustomerId('');
      setAssignmentNote('');
      await loadCore();
      toast({ title: t('common.success'), description: 'Kunde wurde zugewiesen.' });
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || 'Zuweisung fehlgeschlagen.', variant: 'destructive' });
    }
  };

  const updateFinanceForGroup = async (groupId: string) => {
    const group = groups.find((entry) => entry._id === groupId);
    if (!group) return;

    try {
      await updateCustomerGroup(groupId, {
        financeProfile: group.financeProfile,
      });
      await loadCore();
      toast({ title: t('common.success'), description: `Finanzprofil von ${group.name} wurde gespeichert.` });
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || 'Finanzprofil konnte nicht gespeichert werden.', variant: 'destructive' });
    }
  };

  const updateAffiliate = async () => {
    if (!selectedGroupId || !selectedGroup) return;
    try {
      await updateCustomerGroup(selectedGroupId, {
        affiliateProfile: selectedGroup.affiliateProfile,
      });
      await loadCore();
      toast({ title: t('common.success'), description: 'Affiliate-Profil wurde gespeichert.' });
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message || 'Affiliate-Profil konnte nicht gespeichert werden.', variant: 'destructive' });
    }
  };

  const totalActiveCommissions = affiliateSummary
    ? (affiliateSummary.commissions.pending.count || 0) + (affiliateSummary.commissions.approved.count || 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-slate-900 px-6 py-5 text-white shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('customerGroupsManagement.title')}</h1>
          <p className="mt-1 text-sm text-slate-200">Komplettes Management für Gruppen, Regeln, Zuweisungen, Finanz- und Affiliate-Logik.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={loadCore} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('common.refresh')}
          </Button>
          <Button onClick={openCreateGroup}>
            <Plus className="mr-2 h-4 w-4" />
            {t('customerGroupsManagement.createGroup')}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MainTab)} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="groups">Gruppen</TabsTrigger>
          <TabsTrigger value="rules">Regeln</TabsTrigger>
          <TabsTrigger value="assignments">Zuweisungen</TabsTrigger>
          <TabsTrigger value="finance">Finanzen</TabsTrigger>
          <TabsTrigger value="affiliate">Affiliate</TabsTrigger>
          <TabsTrigger value="reporting">Reporting</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Gruppen gesamt</CardDescription>
                <CardTitle className="text-3xl">{overview?.totalGroups ?? 0}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{overview?.activeGroups ?? 0} aktiv</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Aktive Zuweisungen</CardDescription>
                <CardTitle className="text-3xl">{overview?.totalAssignments ?? 0}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{overview?.customerCount ?? 0} Kunden gesamt</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Regeln gesamt</CardDescription>
                <CardTitle className="text-3xl">{overview?.totalRules ?? 0}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Inklusive Drafts und aktive Regeln</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Offene Provisionen</CardDescription>
                <CardTitle className="text-3xl">{totalActiveCommissions}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Pending + Approved</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Systemstatus</CardTitle>
              <CardDescription>Direkter Überblick über die im Konzept vorgesehenen Ebenen.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold">Segmentierung</p>
                <p className="text-xs text-muted-foreground">Gruppen, Regelwerk, Konfliktpriorisierung und manuelle Overrides.</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold">Finanzlogik</p>
                <p className="text-xs text-muted-foreground">Rabatt, Zahlungsziel, Skonto, Kreditlimit und Zahlungsarten je Gruppe.</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold">Affiliate-Logik</p>
                <p className="text-xs text-muted-foreground">Attribution, Kommissionstypen, Trigger und Hold-Tage pro Gruppe.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gruppenverwaltung</CardTitle>
              <CardDescription>Stammdaten, Assignment-Mode, Finanz- und Affiliate-Defaults einer Gruppe verwalten.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={t('customerGroupsManagement.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value: 'all' | CustomerGroupStatus) => setStatusFilter(value)}>
                  <SelectTrigger className="w-full lg:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gruppe</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priorität</TableHead>
                      <TableHead>Kunden</TableHead>
                      <TableHead>Finanzen</TableHead>
                      <TableHead>Affiliate</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{t('common.loading')}</TableCell>
                      </TableRow>
                    ) : groups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{t('customerGroupsManagement.noGroups')}</TableCell>
                      </TableRow>
                    ) : (
                      groups.map((group) => (
                        <TableRow key={group._id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{group.name}</div>
                              <div className="text-xs text-muted-foreground">{group.key}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={badgeClassByStatus[group.status]}>{group.status}</Badge>
                          </TableCell>
                          <TableCell>{group.priority}</TableCell>
                          <TableCell>{group.customerCount ?? 0}</TableCell>
                          <TableCell className="text-sm">{group.financeProfile?.discountPercent ?? 0}% / Net {group.financeProfile?.paymentDueDays ?? 14}</TableCell>
                          <TableCell className="text-sm">{group.affiliateProfile?.defaultCommissionValue ?? 0} ({group.affiliateProfile?.defaultCommissionType || 'percentage'})</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditGroup(group)}>Bearbeiten</Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  await updateCustomerGroupStatus(group._id, group.status === 'active' ? 'inactive' : 'active');
                                  await loadCore();
                                }}
                              >
                                {group.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (window.confirm(t('customerGroupsManagement.deleteConfirm'))) {
                                    await deleteCustomerGroup(group._id);
                                    await loadCore();
                                  }
                                }}
                              >
                                Löschen
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Regel-Engine</CardTitle>
              <CardDescription>Regeln erstellen, priorisieren und mit Preview gegen Beispielkontext testen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input placeholder="Regeln suchen" value={ruleSearch} onChange={(event) => setRuleSearch(event.target.value)} />
                <Button
                  onClick={() => {
                    setRuleForm({ ...emptyRuleForm, groupId: selectedGroupId || groups[0]?._id || '' });
                    setPreviewResult(null);
                    setShowRuleDialog(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Neue Regel
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Gruppe</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priorität</TableHead>
                      <TableHead>Bedingungen</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Noch keine Regeln vorhanden.</TableCell>
                      </TableRow>
                    ) : (
                      rules.map((rule) => (
                        <TableRow key={rule._id}>
                          <TableCell className="font-medium">{rule.name}</TableCell>
                          <TableCell>{rule.groupId?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={badgeClassByStatus[rule.status]}>{rule.status}</Badge>
                          </TableCell>
                          <TableCell>{rule.priority}</TableCell>
                          <TableCell>{rule.conditions.length}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRuleForm({
                                    id: rule._id,
                                    name: rule.name,
                                    status: rule.status,
                                    priority: String(rule.priority),
                                    groupId: rule.groupId?._id || '',
                                    stopProcessing: rule.stopProcessing,
                                    exclusivityMode: rule.exclusivityMode,
                                    conditions: rule.conditions.length ? rule.conditions : [{ ...emptyRuleCondition }],
                                    excludedIf: rule.excludedIf,
                                  });
                                  setPreviewResult(null);
                                  setShowRuleDialog(true);
                                }}
                              >
                                Bearbeiten
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  await updateCustomerGroupRuleStatus(rule._id, rule.status === 'active' ? 'inactive' : 'active');
                                  await loadCore();
                                }}
                              >
                                {rule.status === 'active' ? 'Stoppen' : 'Aktivieren'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Zuweisungen und Primärgruppe</CardTitle>
              <CardDescription>Manuelle Zuordnung, Recalculate und Primärgruppen-Setzung pro Kunde.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label>Gruppe</Label>
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger><SelectValue placeholder="Gruppe auswählen" /></SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group._id} value={group._id}>{group.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Kunde zuweisen</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
                    <SelectContent>
                      {customerCandidates.map((customer) => (
                        <SelectItem key={customer._id} value={customer._id}>{customer.name} ({customer.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notiz</Label>
                  <Input value={assignmentNote} onChange={(event) => setAssignmentNote(event.target.value)} placeholder="z. B. manuell durch Admin" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={assignCustomer}>Zuweisen</Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!selectedCustomerId) {
                      toast({ title: t('common.error'), description: 'Bitte zuerst einen Kunden auswählen.', variant: 'destructive' });
                      return;
                    }
                    await recalculateCustomerGroups(selectedCustomerId);
                    await loadCore();
                    toast({ title: t('common.success'), description: 'Gruppenzuordnung wurde neu berechnet.' });
                  }}
                >
                  Recalculate (ausgewählter Kunde)
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kunde</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Primär</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Keine aktiven Zuweisungen für diese Gruppe.</TableCell>
                      </TableRow>
                    ) : (
                      customers.map((assignment) => (
                        <TableRow key={assignment._id}>
                          <TableCell className="font-medium">{assignment.customerId?.name || '-'}</TableCell>
                          <TableCell>{assignment.customerId?.email || '-'}</TableCell>
                          <TableCell>{assignment.assignmentType}</TableCell>
                          <TableCell>{assignment.isPrimary ? 'Ja' : 'Nein'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {!assignment.isPrimary && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    await setCustomerPrimaryGroup(assignment.customerId._id, selectedGroupId);
                                    await loadCore();
                                  }}
                                >
                                  Als primär setzen
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  await revokeGroupAssignment(selectedGroupId, assignment._id);
                                  await loadCore();
                                }}
                              >
                                Entfernen
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Finanzeinstellungen aller Gruppen</CardTitle>
              <CardDescription>Alle Gruppen zentral einsehen und je Gruppe direkt speichern.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gruppe</TableHead>
                      <TableHead>Rabatt %</TableHead>
                      <TableHead>Ziel (Tage)</TableHead>
                      <TableHead>Skonto %</TableHead>
                      <TableHead>Skonto Tage</TableHead>
                      <TableHead>Kreditlimit</TableHead>
                      <TableHead>Währung</TableHead>
                      <TableHead>Steuer</TableHead>
                      <TableHead>Zahlungsarten</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Keine Gruppen verfügbar.</TableCell>
                      </TableRow>
                    ) : (
                      groups.map((group) => (
                        <TableRow key={group._id}>
                          <TableCell>
                            <div className="font-medium">{group.name}</div>
                            <div className="text-xs text-muted-foreground">{group.key}</div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24"
                              value={group.financeProfile.discountPercent}
                              onChange={(event) => setGroups((current) => current.map((entry) => entry._id === group._id ? {
                                ...entry,
                                financeProfile: {
                                  ...entry.financeProfile,
                                  discountPercent: Number(event.target.value || 0),
                                },
                              } : entry))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24"
                              value={group.financeProfile.paymentDueDays}
                              onChange={(event) => setGroups((current) => current.map((entry) => entry._id === group._id ? {
                                ...entry,
                                financeProfile: {
                                  ...entry.financeProfile,
                                  paymentDueDays: Number(event.target.value || 0),
                                },
                              } : entry))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24"
                              value={group.financeProfile.cashDiscountPercent}
                              onChange={(event) => setGroups((current) => current.map((entry) => entry._id === group._id ? {
                                ...entry,
                                financeProfile: {
                                  ...entry.financeProfile,
                                  cashDiscountPercent: Number(event.target.value || 0),
                                },
                              } : entry))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-24"
                              value={group.financeProfile.cashDiscountDays}
                              onChange={(event) => setGroups((current) => current.map((entry) => entry._id === group._id ? {
                                ...entry,
                                financeProfile: {
                                  ...entry.financeProfile,
                                  cashDiscountDays: Number(event.target.value || 0),
                                },
                              } : entry))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="w-28"
                              value={group.financeProfile.creditLimit}
                              onChange={(event) => setGroups((current) => current.map((entry) => entry._id === group._id ? {
                                ...entry,
                                financeProfile: {
                                  ...entry.financeProfile,
                                  creditLimit: Number(event.target.value || 0),
                                },
                              } : entry))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="w-20"
                              value={group.financeProfile.currency}
                              onChange={(event) => setGroups((current) => current.map((entry) => entry._id === group._id ? {
                                ...entry,
                                financeProfile: {
                                  ...entry.financeProfile,
                                  currency: event.target.value,
                                },
                              } : entry))}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={group.financeProfile.taxMode}
                              onValueChange={(value: CustomerGroup['financeProfile']['taxMode']) => setGroups((current) => current.map((entry) => entry._id === group._id ? {
                                ...entry,
                                financeProfile: {
                                  ...entry.financeProfile,
                                  taxMode: value,
                                },
                              } : entry))}
                            >
                              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">default</SelectItem>
                                <SelectItem value="tax_free">tax_free</SelectItem>
                                <SelectItem value="reverse_charge">reverse_charge</SelectItem>
                                <SelectItem value="custom">custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex max-w-xs flex-wrap gap-1">
                              {paymentMethods.map((method) => {
                                const checked = group.financeProfile.allowedPaymentMethods?.includes(method);
                                return (
                                  <Button
                                    key={`${group._id}-${method}`}
                                    variant={checked ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                      setGroups((current) => current.map((entry) => {
                                        if (entry._id !== group._id) return entry;
                                        const currentMethods = entry.financeProfile.allowedPaymentMethods || [];
                                        const nextMethods = checked
                                          ? currentMethods.filter((item) => item !== method)
                                          : [...currentMethods, method];
                                        return {
                                          ...entry,
                                          financeProfile: {
                                            ...entry.financeProfile,
                                            allowedPaymentMethods: nextMethods,
                                          },
                                        };
                                      }));
                                    }}
                                  >
                                    {method}
                                  </Button>
                                );
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button onClick={() => updateFinanceForGroup(group._id)}>
                              <Settings2 className="mr-2 h-4 w-4" />
                              Speichern
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {financialSummary && (
            <div className="grid gap-3 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardDescription>Ausgewählte Gruppe</CardDescription><CardTitle>{selectedGroup?.name || '-'}</CardTitle></CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Aktive Zuordnungen</CardDescription><CardTitle>{financialSummary.activeAssignments}</CardTitle></CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Kreditlimit (ausgewählt)</CardDescription><CardTitle>{financialSummary.creditLimit}</CardTitle></CardHeader>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="affiliate" className="space-y-4">
          {selectedGroup ? (
            <Card>
              <CardHeader>
                <CardTitle>Affiliate-Profil: {selectedGroup.name}</CardTitle>
                <CardDescription>Attribution, Kommission und Release-Lifecycle je Gruppe konfigurieren.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Attribution</Label>
                    <Select
                      value={selectedGroup.affiliateProfile.attributionModel}
                      onValueChange={(value: CustomerGroup['affiliateProfile']['attributionModel']) => setGroups((current) => current.map((group) => group._id === selectedGroup._id ? {
                        ...group,
                        affiliateProfile: {
                          ...group.affiliateProfile,
                          attributionModel: value,
                        },
                      } : group))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first_click">first_click</SelectItem>
                        <SelectItem value="last_click">last_click</SelectItem>
                        <SelectItem value="fixed_source">fixed_source</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kommissionstyp</Label>
                    <Select
                      value={selectedGroup.affiliateProfile.defaultCommissionType}
                      onValueChange={(value: CustomerGroup['affiliateProfile']['defaultCommissionType']) => setGroups((current) => current.map((group) => group._id === selectedGroup._id ? {
                        ...group,
                        affiliateProfile: {
                          ...group.affiliateProfile,
                          defaultCommissionType: value,
                        },
                      } : group))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">percentage</SelectItem>
                        <SelectItem value="fixed">fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kommissionswert</Label>
                    <Input
                      type="number"
                      value={selectedGroup.affiliateProfile.defaultCommissionValue}
                      onChange={(event) => setGroups((current) => current.map((group) => group._id === selectedGroup._id ? {
                        ...group,
                        affiliateProfile: {
                          ...group.affiliateProfile,
                          defaultCommissionValue: Number(event.target.value || 0),
                        },
                      } : group))}
                    />
                  </div>
                  <div>
                    <Label>Release Trigger</Label>
                    <Select
                      value={selectedGroup.affiliateProfile.releaseTrigger}
                      onValueChange={(value: CustomerGroup['affiliateProfile']['releaseTrigger']) => setGroups((current) => current.map((group) => group._id === selectedGroup._id ? {
                        ...group,
                        affiliateProfile: {
                          ...group.affiliateProfile,
                          releaseTrigger: value,
                        },
                      } : group))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="order_created">order_created</SelectItem>
                        <SelectItem value="order_completed">order_completed</SelectItem>
                        <SelectItem value="invoice_created">invoice_created</SelectItem>
                        <SelectItem value="invoice_paid">invoice_paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Hold-Tage</Label>
                    <Input
                      type="number"
                      value={selectedGroup.affiliateProfile.holdDays}
                      onChange={(event) => setGroups((current) => current.map((group) => group._id === selectedGroup._id ? {
                        ...group,
                        affiliateProfile: {
                          ...group.affiliateProfile,
                          holdDays: Number(event.target.value || 0),
                        },
                      } : group))}
                    />
                  </div>
                </div>

                <Button onClick={updateAffiliate}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Affiliate-Profil speichern
                </Button>

                {affiliateSummary && (
                  <div className="grid gap-3 md:grid-cols-4">
                    <Card><CardHeader className="pb-2"><CardDescription>Pending</CardDescription><CardTitle>{affiliateSummary.commissions.pending.count}</CardTitle></CardHeader></Card>
                    <Card><CardHeader className="pb-2"><CardDescription>Approved</CardDescription><CardTitle>{affiliateSummary.commissions.approved.count}</CardTitle></CardHeader></Card>
                    <Card><CardHeader className="pb-2"><CardDescription>Released</CardDescription><CardTitle>{affiliateSummary.commissions.released.count}</CardTitle></CardHeader></Card>
                    <Card><CardHeader className="pb-2"><CardDescription>Reversed</CardDescription><CardTitle>{affiliateSummary.commissions.reversed.count}</CardTitle></CardHeader></Card>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Bitte zuerst eine Gruppe auswählen.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="reporting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reporting und Audit</CardTitle>
              <CardDescription>Konzept-KPIs für Gruppen, Provisionen und Konflikt-/Zuweisungsprozesse.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Kunden je Gruppe</p>
                <p className="text-2xl font-semibold">{selectedGroup?.customerCount ?? 0}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Aktive Regeln</p>
                <p className="text-2xl font-semibold">{rules.filter((rule) => rule.status === 'active').length}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Offene Provisionen</p>
                <p className="text-2xl font-semibold">{totalActiveCommissions}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Fallback-Gruppen</p>
                <p className="text-2xl font-semibold">{groups.filter((group) => group.isDefault).length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Management-Hinweise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Jede manuelle Zuweisung sollte mit Notiz dokumentiert werden.</p>
              <p>Aktivieren Sie neue Regeln erst nach Preview gegen realistische Beispielkontexte.</p>
              <p>Für exklusive Gruppen sollten Prioritäten klar abgestuft sein, um Konflikte zu vermeiden.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingGroupId ? t('customerGroupsManagement.editGroup') : t('customerGroupsManagement.createGroup')}</DialogTitle>
            <DialogDescription>{t('customerGroupsManagement.formDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Key</Label>
              <Input value={groupForm.key} onChange={(event) => setGroupForm((current) => ({ ...current, key: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Beschreibung</Label>
              <Textarea rows={3} value={groupForm.description} onChange={(event) => setGroupForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={groupForm.status} onValueChange={(value: CustomerGroupStatus) => setGroupForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modus</Label>
              <Select value={groupForm.mode} onValueChange={(value: CustomerGroup['mode']) => setGroupForm((current) => ({ ...current, mode: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">standard</SelectItem>
                  <SelectItem value="vip">vip</SelectItem>
                  <SelectItem value="b2b">b2b</SelectItem>
                  <SelectItem value="affiliate">affiliate</SelectItem>
                  <SelectItem value="custom">custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Input type="number" value={groupForm.priority} onChange={(event) => setGroupForm((current) => ({ ...current, priority: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Zahlungsziel (Tage)</Label>
              <Input type="number" value={groupForm.paymentDueDays} onChange={(event) => setGroupForm((current) => ({ ...current, paymentDueDays: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Rabatt %</Label>
              <Input type="number" value={groupForm.discountPercent} onChange={(event) => setGroupForm((current) => ({ ...current, discountPercent: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kreditlimit</Label>
              <Input type="number" value={groupForm.creditLimit} onChange={(event) => setGroupForm((current) => ({ ...current, creditLimit: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Währung</Label>
              <Input value={groupForm.currency} onChange={(event) => setGroupForm((current) => ({ ...current, currency: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Attribution</Label>
              <Select value={groupForm.attributionModel} onValueChange={(value: CustomerGroup['affiliateProfile']['attributionModel']) => setGroupForm((current) => ({ ...current, attributionModel: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_click">first_click</SelectItem>
                  <SelectItem value="last_click">last_click</SelectItem>
                  <SelectItem value="fixed_source">fixed_source</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fixed Affiliate ID</Label>
              <Input value={groupForm.fixedAffiliateId} onChange={(event) => setGroupForm((current) => ({ ...current, fixedAffiliateId: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Kommissionstyp</Label>
              <Select value={groupForm.defaultCommissionType} onValueChange={(value: CustomerGroup['affiliateProfile']['defaultCommissionType']) => setGroupForm((current) => ({ ...current, defaultCommissionType: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">percentage</SelectItem>
                  <SelectItem value="fixed">fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kommissionswert</Label>
              <Input type="number" value={groupForm.commissionValue} onChange={(event) => setGroupForm((current) => ({ ...current, commissionValue: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Invoice Series</Label>
              <Input value={groupForm.invoiceSeries} onChange={(event) => setGroupForm((current) => ({ ...current, invoiceSeries: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Freigabe ab Betrag</Label>
              <Input type="number" value={groupForm.requireManualApprovalAbove} onChange={(event) => setGroupForm((current) => ({ ...current, requireManualApprovalAbove: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Konfliktstrategie</Label>
              <Select value={groupForm.conflictResolutionStrategy} onValueChange={(value: 'priority' | 'manual_first' | 'exclusive_first') => setGroupForm((current) => ({ ...current, conflictResolutionStrategy: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">priority</SelectItem>
                  <SelectItem value="manual_first">manual_first</SelectItem>
                  <SelectItem value="exclusive_first">exclusive_first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fallback Group ID</Label>
              <Input value={groupForm.fallbackGroupId} onChange={(event) => setGroupForm((current) => ({ ...current, fallbackGroupId: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notizen</Label>
              <Textarea rows={2} value={groupForm.notes} onChange={(event) => setGroupForm((current) => ({ ...current, notes: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input value={groupForm.tags} onChange={(event) => setGroupForm((current) => ({ ...current, tags: event.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Exklusive Gruppe</span>
              <Switch checked={groupForm.isExclusive} onCheckedChange={(checked) => setGroupForm((current) => ({ ...current, isExclusive: checked }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Fallback-Gruppe</span>
              <Switch checked={groupForm.isDefault} onCheckedChange={(checked) => setGroupForm((current) => ({ ...current, isDefault: checked }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Rechnungen konsolidieren</span>
              <Switch checked={groupForm.consolidateInvoices} onCheckedChange={(checked) => setGroupForm((current) => ({ ...current, consolidateInvoices: checked }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Nach Auftragstyp splitten</span>
              <Switch checked={groupForm.splitByOrderType} onCheckedChange={(checked) => setGroupForm((current) => ({ ...current, splitByOrderType: checked }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Produkt-Overrides erlauben</span>
              <Switch checked={groupForm.allowProductOverrides} onCheckedChange={(checked) => setGroupForm((current) => ({ ...current, allowProductOverrides: checked }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={saveGroup} disabled={saving}>{editingGroupId ? t('common.save') : t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{ruleForm.id ? 'Regel bearbeiten' : 'Neue Regel'}</DialogTitle>
            <DialogDescription>Bedingungsblöcke, Priorität, Exklusivität und Preview konfigurieren.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={ruleForm.name} onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div>
                <Label>Gruppe</Label>
                <Select value={ruleForm.groupId} onValueChange={(value) => setRuleForm((current) => ({ ...current, groupId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Gruppe wählen" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group._id} value={group._id}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorität</Label>
                <Input type="number" value={ruleForm.priority} onChange={(event) => setRuleForm((current) => ({ ...current, priority: event.target.value }))} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={ruleForm.status} onValueChange={(value: CustomerGroupStatus) => setRuleForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Bedingungen</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRuleForm((current) => ({
                    ...current,
                    conditions: [...current.conditions, { ...emptyRuleCondition }],
                  }))}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Bedingung
                </Button>
              </div>
              {ruleForm.conditions.map((condition, index) => (
                <div key={`condition-${index}`} className="grid gap-2 md:grid-cols-4">
                  <Input
                    placeholder="field"
                    value={condition.field}
                    onChange={(event) => setRuleForm((current) => ({
                      ...current,
                      conditions: current.conditions.map((entry, entryIndex) => entryIndex === index ? { ...entry, field: event.target.value } : entry),
                    }))}
                  />
                  <Select
                    value={condition.operator}
                    onValueChange={(value: RuleCondition['operator']) => setRuleForm((current) => ({
                      ...current,
                      conditions: current.conditions.map((entry, entryIndex) => entryIndex === index ? { ...entry, operator: value } : entry),
                    }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eq">eq</SelectItem>
                      <SelectItem value="neq">neq</SelectItem>
                      <SelectItem value="gt">gt</SelectItem>
                      <SelectItem value="gte">gte</SelectItem>
                      <SelectItem value="lt">lt</SelectItem>
                      <SelectItem value="lte">lte</SelectItem>
                      <SelectItem value="contains">contains</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="value"
                    value={String(condition.value ?? '')}
                    onChange={(event) => setRuleForm((current) => ({
                      ...current,
                      conditions: current.conditions.map((entry, entryIndex) => entryIndex === index ? { ...entry, value: event.target.value } : entry),
                    }))}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setRuleForm((current) => ({
                      ...current,
                      conditions: current.conditions.filter((_, entryIndex) => entryIndex !== index),
                    }))}
                  >
                    Entfernen
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Preview-Context (JSON)</Label>
              <Textarea rows={4} value={previewContext} onChange={(event) => setPreviewContext(event.target.value)} />
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={runRulePreview}>Preview ausführen</Button>
                {previewResult && (
                  <Badge variant="outline" className={previewResult.matched ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                    {previewResult.matched ? 'Match' : 'No Match'}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={saveRule} disabled={saving}>{ruleForm.id ? t('common.save') : t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CustomerGroupsManagement;
