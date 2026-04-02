const CustomerGroup = require('../models/CustomerGroup');
const CustomerGroupAssignment = require('../models/CustomerGroupAssignment');
const CustomerGroupRule = require('../models/CustomerGroupRule');
const AffiliateAttribution = require('../models/AffiliateAttribution');
const AffiliateCommission = require('../models/AffiliateCommission');
const User = require('../models/User');
const mongoose = require('mongoose');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

function slugifyKey(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

class CustomerGroupService {
  static async getOverview() {
    const [totalGroups, activeGroups, inactiveGroups, archivedGroups, totalRules, totalAssignments, customerCount] = await Promise.all([
      CustomerGroup.countDocuments({}),
      CustomerGroup.countDocuments({ status: 'active' }),
      CustomerGroup.countDocuments({ status: 'inactive' }),
      CustomerGroup.countDocuments({ status: 'archived' }),
      CustomerGroupRule.countDocuments({}),
      CustomerGroupAssignment.countDocuments({ status: 'active' }),
      User.countDocuments({ role: 'customer' }),
    ]);

    return {
      totalGroups,
      activeGroups,
      inactiveGroups,
      archivedGroups,
      totalRules,
      totalAssignments,
      customerCount,
    };
  }

  static async listGroups(filters = {}) {
    const page = Math.max(DEFAULT_PAGE, toNumber(filters.page, DEFAULT_PAGE));
    const limit = Math.min(100, Math.max(1, toNumber(filters.limit, DEFAULT_LIMIT)));
    const query = {};

    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { key: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const [groups, total] = await Promise.all([
      CustomerGroup.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CustomerGroup.countDocuments(query),
    ]);

    const groupIds = groups.map((group) => group._id);
    const assignments = groupIds.length > 0
      ? await CustomerGroupAssignment.aggregate([
          { $match: { groupId: { $in: groupIds }, status: 'active' } },
          { $group: { _id: '$groupId', count: { $sum: 1 } } },
        ])
      : [];

    const countsByGroup = assignments.reduce((acc, entry) => {
      acc[String(entry._id)] = entry.count;
      return acc;
    }, {});

    return {
      groups: groups.map((group) => ({
        ...group,
        customerCount: countsByGroup[String(group._id)] || 0,
      })),
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      currentPage: page,
    };
  }

  static async getGroupById(groupId) {
    const group = await CustomerGroup.findById(groupId).lean();

    if (!group) {
      throw new Error('Customer group not found');
    }

    const [customerCount, ruleCount] = await Promise.all([
      CustomerGroupAssignment.countDocuments({ groupId, status: 'active' }),
      CustomerGroupRule.countDocuments({ groupId }),
    ]);

    return {
      ...group,
      customerCount,
      ruleCount,
    };
  }

  static async createGroup(payload, actorId) {
    if (!payload.name) {
      throw new Error('Group name is required');
    }

    const key = slugifyKey(payload.key || payload.name);
    if (!key) {
      throw new Error('A valid group key could not be generated');
    }

    const existing = await CustomerGroup.findOne({ key });
    if (existing) {
      throw new Error('A customer group with this key already exists');
    }

    if (payload.validFrom && payload.validUntil && new Date(payload.validUntil) < new Date(payload.validFrom)) {
      throw new Error('validUntil must be greater than or equal to validFrom');
    }

    if (payload.isDefault) {
      await CustomerGroup.updateMany({ isDefault: true }, { $set: { isDefault: false } });
    }

    const group = await CustomerGroup.create({
      key,
      name: payload.name,
      description: payload.description || '',
      status: payload.status || 'active',
      priority: toNumber(payload.priority, 0),
      mode: payload.mode || 'standard',
      isExclusive: Boolean(payload.isExclusive),
      isDefault: Boolean(payload.isDefault),
      validFrom: payload.validFrom || undefined,
      validUntil: payload.validUntil || undefined,
      assignmentMode: {
        allowManual: payload.assignmentMode?.allowManual !== false,
        allowRuleBased: payload.assignmentMode?.allowRuleBased !== false,
        allowApi: payload.assignmentMode?.allowApi !== false,
      },
      financeProfile: {
        discountPercent: toNumber(payload.financeProfile?.discountPercent, 0),
        paymentDueDays: toNumber(payload.financeProfile?.paymentDueDays, 14),
        cashDiscountPercent: toNumber(payload.financeProfile?.cashDiscountPercent, 0),
        cashDiscountDays: toNumber(payload.financeProfile?.cashDiscountDays, 0),
        creditLimit: toNumber(payload.financeProfile?.creditLimit, 0),
        currency: payload.financeProfile?.currency || 'EUR',
        taxMode: payload.financeProfile?.taxMode || 'default',
        paymentTermsLabel: payload.financeProfile?.paymentTermsLabel || 'Net 14',
        invoicePrefix: payload.financeProfile?.invoicePrefix || '',
        invoiceProfile: {
          invoiceSeries: payload.financeProfile?.invoiceProfile?.invoiceSeries || '',
          consolidateInvoices: Boolean(payload.financeProfile?.invoiceProfile?.consolidateInvoices),
          splitByOrderType: Boolean(payload.financeProfile?.invoiceProfile?.splitByOrderType),
          requireManualApprovalAbove: toNumber(payload.financeProfile?.invoiceProfile?.requireManualApprovalAbove, 0),
        },
        allowedPaymentMethods: Array.isArray(payload.financeProfile?.allowedPaymentMethods)
          ? payload.financeProfile.allowedPaymentMethods
          : ['bank_transfer'],
      },
      affiliateProfile: {
        attributionModel: payload.affiliateProfile?.attributionModel || 'last_click',
        defaultCommissionType: payload.affiliateProfile?.defaultCommissionType || 'percentage',
        defaultCommissionValue: toNumber(payload.affiliateProfile?.defaultCommissionValue, 0),
        fixedAffiliateId: payload.affiliateProfile?.fixedAffiliateId || '',
        releaseTrigger: payload.affiliateProfile?.releaseTrigger || 'invoice_paid',
        holdDays: toNumber(payload.affiliateProfile?.holdDays, 0),
        allowProductOverrides: payload.affiliateProfile?.allowProductOverrides !== false,
      },
      conflictPolicy: {
        resolutionStrategy: payload.conflictPolicy?.resolutionStrategy || 'priority',
        fallbackGroupId: payload.conflictPolicy?.fallbackGroupId || undefined,
        excludedGroupIds: Array.isArray(payload.conflictPolicy?.excludedGroupIds)
          ? payload.conflictPolicy.excludedGroupIds
          : [],
      },
      metadata: {
        tags: Array.isArray(payload.metadata?.tags) ? payload.metadata.tags : [],
        notes: payload.metadata?.notes || '',
      },
      createdBy: actorId,
      updatedBy: actorId,
    });

    return group.toObject();
  }

  static async updateGroup(groupId, payload, actorId) {
    const group = await CustomerGroup.findById(groupId);

    if (!group) {
      throw new Error('Customer group not found');
    }

    if (payload.key && payload.key !== group.key) {
      const nextKey = slugifyKey(payload.key);
      const existing = await CustomerGroup.findOne({ key: nextKey, _id: { $ne: groupId } });
      if (existing) {
        throw new Error('A customer group with this key already exists');
      }
      group.key = nextKey;
    }

    if (payload.validFrom && payload.validUntil && new Date(payload.validUntil) < new Date(payload.validFrom)) {
      throw new Error('validUntil must be greater than or equal to validFrom');
    }

    if (payload.isDefault) {
      await CustomerGroup.updateMany({ _id: { $ne: groupId }, isDefault: true }, { $set: { isDefault: false } });
    }

    if (payload.name !== undefined) group.name = payload.name;
    if (payload.description !== undefined) group.description = payload.description;
    if (payload.status !== undefined) group.status = payload.status;
    if (payload.priority !== undefined) group.priority = toNumber(payload.priority, group.priority);
    if (payload.mode !== undefined) group.mode = payload.mode;
    if (payload.isExclusive !== undefined) group.isExclusive = Boolean(payload.isExclusive);
    if (payload.isDefault !== undefined) group.isDefault = Boolean(payload.isDefault);
    if (payload.validFrom !== undefined) group.validFrom = payload.validFrom || undefined;
    if (payload.validUntil !== undefined) group.validUntil = payload.validUntil || undefined;

    if (payload.assignmentMode) {
      group.assignmentMode.allowManual = payload.assignmentMode.allowManual !== false;
      group.assignmentMode.allowRuleBased = payload.assignmentMode.allowRuleBased !== false;
      group.assignmentMode.allowApi = payload.assignmentMode.allowApi !== false;
    }

    if (payload.financeProfile) {
      group.financeProfile.discountPercent = toNumber(payload.financeProfile.discountPercent, group.financeProfile.discountPercent);
      group.financeProfile.paymentDueDays = toNumber(payload.financeProfile.paymentDueDays, group.financeProfile.paymentDueDays);
      group.financeProfile.cashDiscountPercent = toNumber(payload.financeProfile.cashDiscountPercent, group.financeProfile.cashDiscountPercent);
      group.financeProfile.cashDiscountDays = toNumber(payload.financeProfile.cashDiscountDays, group.financeProfile.cashDiscountDays);
      group.financeProfile.creditLimit = toNumber(payload.financeProfile.creditLimit, group.financeProfile.creditLimit);
      if (payload.financeProfile.currency !== undefined) group.financeProfile.currency = payload.financeProfile.currency || 'EUR';
      if (payload.financeProfile.taxMode !== undefined) group.financeProfile.taxMode = payload.financeProfile.taxMode;
      if (payload.financeProfile.paymentTermsLabel !== undefined) group.financeProfile.paymentTermsLabel = payload.financeProfile.paymentTermsLabel;
      if (payload.financeProfile.invoicePrefix !== undefined) group.financeProfile.invoicePrefix = payload.financeProfile.invoicePrefix;
      if (payload.financeProfile.invoiceProfile) {
        if (payload.financeProfile.invoiceProfile.invoiceSeries !== undefined) {
          group.financeProfile.invoiceProfile.invoiceSeries = payload.financeProfile.invoiceProfile.invoiceSeries;
        }
        if (payload.financeProfile.invoiceProfile.consolidateInvoices !== undefined) {
          group.financeProfile.invoiceProfile.consolidateInvoices = Boolean(payload.financeProfile.invoiceProfile.consolidateInvoices);
        }
        if (payload.financeProfile.invoiceProfile.splitByOrderType !== undefined) {
          group.financeProfile.invoiceProfile.splitByOrderType = Boolean(payload.financeProfile.invoiceProfile.splitByOrderType);
        }
        if (payload.financeProfile.invoiceProfile.requireManualApprovalAbove !== undefined) {
          group.financeProfile.invoiceProfile.requireManualApprovalAbove = toNumber(
            payload.financeProfile.invoiceProfile.requireManualApprovalAbove,
            group.financeProfile.invoiceProfile.requireManualApprovalAbove
          );
        }
      }
      if (Array.isArray(payload.financeProfile.allowedPaymentMethods)) {
        group.financeProfile.allowedPaymentMethods = payload.financeProfile.allowedPaymentMethods;
      }
    }

    if (payload.affiliateProfile) {
      if (payload.affiliateProfile.attributionModel !== undefined) group.affiliateProfile.attributionModel = payload.affiliateProfile.attributionModel;
      if (payload.affiliateProfile.defaultCommissionType !== undefined) group.affiliateProfile.defaultCommissionType = payload.affiliateProfile.defaultCommissionType;
      group.affiliateProfile.defaultCommissionValue = toNumber(payload.affiliateProfile.defaultCommissionValue, group.affiliateProfile.defaultCommissionValue);
      if (payload.affiliateProfile.fixedAffiliateId !== undefined) group.affiliateProfile.fixedAffiliateId = payload.affiliateProfile.fixedAffiliateId;
      if (payload.affiliateProfile.releaseTrigger !== undefined) group.affiliateProfile.releaseTrigger = payload.affiliateProfile.releaseTrigger;
      group.affiliateProfile.holdDays = toNumber(payload.affiliateProfile.holdDays, group.affiliateProfile.holdDays);
      if (payload.affiliateProfile.allowProductOverrides !== undefined) {
        group.affiliateProfile.allowProductOverrides = Boolean(payload.affiliateProfile.allowProductOverrides);
      }
    }

    if (payload.conflictPolicy) {
      if (payload.conflictPolicy.resolutionStrategy !== undefined) {
        group.conflictPolicy.resolutionStrategy = payload.conflictPolicy.resolutionStrategy;
      }
      if (payload.conflictPolicy.fallbackGroupId !== undefined) {
        group.conflictPolicy.fallbackGroupId = payload.conflictPolicy.fallbackGroupId || undefined;
      }
      if (Array.isArray(payload.conflictPolicy.excludedGroupIds)) {
        group.conflictPolicy.excludedGroupIds = payload.conflictPolicy.excludedGroupIds;
      }
    }

    if (payload.metadata) {
      if (Array.isArray(payload.metadata.tags)) group.metadata.tags = payload.metadata.tags;
      if (payload.metadata.notes !== undefined) group.metadata.notes = payload.metadata.notes;
    }

    group.updatedBy = actorId;
    await group.save();

    return group.toObject();
  }

  static async changeStatus(groupId, status, actorId) {
    const group = await CustomerGroup.findById(groupId);

    if (!group) {
      throw new Error('Customer group not found');
    }

    group.status = status;
    group.updatedBy = actorId;
    await group.save();

    return group.toObject();
  }

  static async deleteGroup(groupId) {
    const assignmentCount = await CustomerGroupAssignment.countDocuments({ groupId, status: 'active' });
    if (assignmentCount > 0) {
      throw new Error('Customer group cannot be deleted while active customer assignments exist');
    }

    const deletedGroup = await CustomerGroup.findByIdAndDelete(groupId);
    if (!deletedGroup) {
      throw new Error('Customer group not found');
    }

    await CustomerGroupRule.deleteMany({ groupId });
    return deletedGroup.toObject();
  }

  static async getGroupCustomers(groupId, options = {}) {
    const page = Math.max(DEFAULT_PAGE, toNumber(options.page, DEFAULT_PAGE));
    const limit = Math.min(100, Math.max(1, toNumber(options.limit, DEFAULT_LIMIT)));
    const query = {
      groupId,
      status: options.status || 'active',
    };

    const [assignments, total] = await Promise.all([
      CustomerGroupAssignment.find(query)
        .populate('customerId', 'name email company country customerNumber totalOrders totalSpent')
        .sort({ isPrimary: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CustomerGroupAssignment.countDocuments(query),
    ]);

    return {
      customers: assignments,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      currentPage: page,
    };
  }

  static async resolveGroupSelection({ groupIds = [], primaryGroupId = null } = {}) {
    const uniqueGroupIds = Array.from(
      new Set(
        [...groupIds, primaryGroupId]
          .filter(Boolean)
          .map((value) => String(value))
      )
    );

    if (uniqueGroupIds.length === 0) {
      return {
        groups: [],
        groupIds: [],
        primaryGroupId: null,
        primaryGroupName: '',
      };
    }

    const groups = await CustomerGroup.find({
      _id: { $in: uniqueGroupIds },
      status: { $ne: 'archived' },
    })
      .select('_id name key priority status')
      .lean();

    if (groups.length !== uniqueGroupIds.length) {
      throw new Error('One or more selected customer groups are invalid or archived');
    }

    const groupsById = groups.reduce((acc, group) => {
      acc[String(group._id)] = group;
      return acc;
    }, {});

    const orderedGroups = uniqueGroupIds.map((groupId) => groupsById[groupId]).filter(Boolean);
    const resolvedPrimaryGroupId = primaryGroupId
      ? String(primaryGroupId)
      : String(orderedGroups[0]._id);
    const primaryGroup = groupsById[resolvedPrimaryGroupId];

    if (!primaryGroup) {
      throw new Error('Primary customer group must be part of the assigned groups');
    }

    return {
      groups: orderedGroups,
      groupIds: orderedGroups.map((group) => String(group._id)),
      primaryGroupId: resolvedPrimaryGroupId,
      primaryGroupName: primaryGroup.name,
    };
  }

  static async syncCustomerAssignments(customerId, selection, actorId) {
    const groupIds = selection?.groupIds || [];
    const primaryGroupId = selection?.primaryGroupId || null;
    const now = new Date();

    const existingAssignments = await CustomerGroupAssignment.find({
      customerId,
      status: 'active',
    });

    const existingAssignmentsByGroupId = existingAssignments.reduce((acc, assignment) => {
      acc[String(assignment.groupId)] = assignment;
      return acc;
    }, {});

    const groupsById = (selection?.groups || []).reduce((acc, group) => {
      acc[String(group._id)] = group;
      return acc;
    }, {});

    const groupsToRevoke = existingAssignments
      .filter((assignment) => !groupIds.includes(String(assignment.groupId)))
      .map((assignment) => assignment._id);

    if (groupsToRevoke.length > 0) {
      await CustomerGroupAssignment.updateMany(
        { _id: { $in: groupsToRevoke } },
        {
          $set: {
            status: 'revoked',
            isPrimary: false,
            validUntil: now,
            updatedBy: actorId,
          },
        }
      );
    }

    for (const groupId of groupIds) {
      const group = groupsById[groupId];
      const isPrimary = groupId === primaryGroupId;
      const existingAssignment = existingAssignmentsByGroupId[groupId];

      if (existingAssignment) {
        existingAssignment.isPrimary = isPrimary;
        existingAssignment.assignmentType = 'manual';
        existingAssignment.resolvedPriority = group?.priority || 0;
        existingAssignment.resolutionReason = isPrimary
          ? 'manually-selected-primary-group'
          : 'manually-assigned-group';
        existingAssignment.validUntil = undefined;
        existingAssignment.updatedBy = actorId;
        await existingAssignment.save();
        continue;
      }

      await CustomerGroupAssignment.create({
        customerId,
        groupId,
        assignmentType: 'manual',
        source: {
          note: 'Updated via admin user management',
        },
        isPrimary,
        status: 'active',
        validFrom: now,
        resolvedPriority: group?.priority || 0,
        resolutionReason: isPrimary
          ? 'manually-selected-primary-group'
          : 'manually-assigned-group',
        createdBy: actorId,
        updatedBy: actorId,
      });
    }

    return {
      primaryGroupId,
      groupIds,
    };
  }

  static async listRules(filters = {}) {
    const page = Math.max(DEFAULT_PAGE, toNumber(filters.page, DEFAULT_PAGE));
    const limit = Math.min(100, Math.max(1, toNumber(filters.limit, DEFAULT_LIMIT)));
    const query = {};

    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }

    if (filters.groupId && filters.groupId !== 'all') {
      query.groupId = filters.groupId;
    }

    if (filters.search) {
      query.name = { $regex: filters.search, $options: 'i' };
    }

    const [rules, total] = await Promise.all([
      CustomerGroupRule.find(query)
        .populate('groupId', 'name key status priority isExclusive')
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CustomerGroupRule.countDocuments(query),
    ]);

    return {
      rules,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      currentPage: page,
    };
  }

  static async createRule(payload) {
    if (!payload?.name) {
      throw new Error('Rule name is required');
    }

    if (!payload?.groupId) {
      throw new Error('groupId is required');
    }

    const group = await CustomerGroup.findById(payload.groupId).lean();
    if (!group) {
      throw new Error('Referenced customer group not found');
    }

    const rule = await CustomerGroupRule.create({
      name: payload.name,
      status: payload.status || 'draft',
      priority: toNumber(payload.priority, 0),
      groupId: payload.groupId,
      stopProcessing: Boolean(payload.stopProcessing),
      exclusivityMode: payload.exclusivityMode || 'normal',
      conditions: Array.isArray(payload.conditions) ? payload.conditions : [],
      excludedIf: Array.isArray(payload.excludedIf) ? payload.excludedIf : [],
      validFrom: payload.validFrom || undefined,
      validUntil: payload.validUntil || undefined,
    });

    return CustomerGroupRule.findById(rule._id).populate('groupId', 'name key status').lean();
  }

  static async updateRule(ruleId, payload) {
    const rule = await CustomerGroupRule.findById(ruleId);

    if (!rule) {
      throw new Error('Customer group rule not found');
    }

    if (payload.name !== undefined) rule.name = payload.name;
    if (payload.status !== undefined) rule.status = payload.status;
    if (payload.priority !== undefined) rule.priority = toNumber(payload.priority, rule.priority);
    if (payload.stopProcessing !== undefined) rule.stopProcessing = Boolean(payload.stopProcessing);
    if (payload.exclusivityMode !== undefined) rule.exclusivityMode = payload.exclusivityMode;
    if (Array.isArray(payload.conditions)) rule.conditions = payload.conditions;
    if (Array.isArray(payload.excludedIf)) rule.excludedIf = payload.excludedIf;
    if (payload.validFrom !== undefined) rule.validFrom = payload.validFrom || undefined;
    if (payload.validUntil !== undefined) rule.validUntil = payload.validUntil || undefined;

    if (payload.groupId && String(payload.groupId) !== String(rule.groupId)) {
      const group = await CustomerGroup.findById(payload.groupId).lean();
      if (!group) {
        throw new Error('Referenced customer group not found');
      }
      rule.groupId = payload.groupId;
    }

    await rule.save();
    return CustomerGroupRule.findById(rule._id).populate('groupId', 'name key status').lean();
  }

  static async changeRuleStatus(ruleId, status) {
    const rule = await CustomerGroupRule.findById(ruleId);

    if (!rule) {
      throw new Error('Customer group rule not found');
    }

    rule.status = status;
    await rule.save();

    return CustomerGroupRule.findById(rule._id).populate('groupId', 'name key status').lean();
  }

  static evaluateCondition(condition, context = {}) {
    const left = context?.[condition.field];
    const right = condition.value;

    switch (condition.operator) {
      case 'eq': return left === right;
      case 'neq': return left !== right;
      case 'gt': return Number(left) > Number(right);
      case 'gte': return Number(left) >= Number(right);
      case 'lt': return Number(left) < Number(right);
      case 'lte': return Number(left) <= Number(right);
      case 'in': return Array.isArray(right) ? right.includes(left) : false;
      case 'contains': return Array.isArray(left) ? left.includes(right) : String(left || '').includes(String(right || ''));
      default: return false;
    }
  }

  static async previewRule(payload = {}) {
    const conditions = Array.isArray(payload.conditions) ? payload.conditions : [];
    const excludedIf = Array.isArray(payload.excludedIf) ? payload.excludedIf : [];
    const sampleContext = payload.context || {};

    const matchesConditions = conditions.length === 0 || conditions.every((condition) => this.evaluateCondition(condition, sampleContext));
    const excluded = excludedIf.some((condition) => this.evaluateCondition(condition, sampleContext));

    return {
      matched: matchesConditions && !excluded,
      matchesConditions,
      excluded,
      checkedConditions: conditions.length,
      checkedExclusions: excludedIf.length,
    };
  }

  static async addAssignment(groupId, payload = {}, actorId) {
    if (!payload.customerId) {
      throw new Error('customerId is required');
    }

    const [group, customer] = await Promise.all([
      CustomerGroup.findById(groupId).lean(),
      User.findById(payload.customerId).lean(),
    ]);

    if (!group) {
      throw new Error('Customer group not found');
    }

    if (!customer || customer.role !== 'customer') {
      throw new Error('Customer not found');
    }

    const existingActive = await CustomerGroupAssignment.findOne({
      customerId: payload.customerId,
      groupId,
      status: 'active',
    });

    if (existingActive) {
      return existingActive.toObject();
    }

    const assignment = await CustomerGroupAssignment.create({
      customerId: payload.customerId,
      groupId,
      assignmentType: 'manual',
      source: { note: payload.note || 'Assigned from customer group management' },
      isPrimary: Boolean(payload.isPrimary),
      status: 'active',
      validFrom: new Date(),
      resolvedPriority: group.priority || 0,
      resolutionReason: payload.isPrimary ? 'manual-primary-assignment' : 'manual-assignment',
      createdBy: actorId,
      updatedBy: actorId,
    });

    const activeAssignments = await CustomerGroupAssignment.find({
      customerId: payload.customerId,
      status: 'active',
    }).populate('groupId', '_id name key priority').lean();

    let nextPrimaryGroup = activeAssignments.find((entry) => entry.isPrimary)?.groupId;
    if (!nextPrimaryGroup && activeAssignments.length > 0) {
      nextPrimaryGroup = activeAssignments[0].groupId;
    }

    await User.findByIdAndUpdate(payload.customerId, {
      $set: {
        primaryCustomerGroupId: nextPrimaryGroup?._id || null,
        customerGroupIds: activeAssignments.map((entry) => entry.groupId._id),
        customerGroup: nextPrimaryGroup?.name || '',
      },
    });

    return assignment.toObject();
  }

  static async revokeAssignment(groupId, assignmentId, actorId) {
    const assignment = await CustomerGroupAssignment.findOne({ _id: assignmentId, groupId, status: 'active' });

    if (!assignment) {
      throw new Error('Active assignment not found');
    }

    assignment.status = 'revoked';
    assignment.isPrimary = false;
    assignment.validUntil = new Date();
    assignment.updatedBy = actorId;
    await assignment.save();

    const activeAssignments = await CustomerGroupAssignment.find({
      customerId: assignment.customerId,
      status: 'active',
    }).populate('groupId', '_id name key priority').lean();

    const primary = activeAssignments.find((entry) => entry.isPrimary) || activeAssignments[0] || null;

    await User.findByIdAndUpdate(assignment.customerId, {
      $set: {
        primaryCustomerGroupId: primary?.groupId?._id || null,
        customerGroupIds: activeAssignments.map((entry) => entry.groupId._id),
        customerGroup: primary?.groupId?.name || '',
      },
    });
  }

  static async recalculateCustomerGroups(customerId, actorId) {
    const activeAssignments = await CustomerGroupAssignment.find({
      customerId,
      status: 'active',
    }).populate('groupId', '_id name key priority').lean();

    const activeGroups = activeAssignments
      .filter((entry) => entry.groupId)
      .sort((a, b) => Number(b.groupId.priority || 0) - Number(a.groupId.priority || 0));

    const primary = activeGroups[0] || null;

    await CustomerGroupAssignment.updateMany(
      { customerId, status: 'active' },
      { $set: { isPrimary: false, updatedBy: actorId } }
    );

    if (primary) {
      await CustomerGroupAssignment.findByIdAndUpdate(primary._id, {
        $set: {
          isPrimary: true,
          resolutionReason: 'recalculated-highest-priority-group',
          updatedBy: actorId,
        },
      });
    }

    await User.findByIdAndUpdate(customerId, {
      $set: {
        primaryCustomerGroupId: primary?.groupId?._id || null,
        customerGroupIds: activeGroups.map((entry) => entry.groupId._id),
        customerGroup: primary?.groupId?.name || '',
      },
    });

    return {
      primaryGroupId: primary?.groupId?._id || null,
      assignedGroupIds: activeGroups.map((entry) => String(entry.groupId._id)),
      assignmentCount: activeGroups.length,
    };
  }

  static async updateCustomerPrimaryGroup(customerId, primaryGroupId, actorId) {
    const activeAssignments = await CustomerGroupAssignment.find({
      customerId,
      status: 'active',
    });

    const hasPrimaryGroup = activeAssignments.some((assignment) => String(assignment.groupId) === String(primaryGroupId));
    if (!hasPrimaryGroup) {
      throw new Error('Primary group must be an active assignment for this customer');
    }

    await CustomerGroupAssignment.updateMany(
      { customerId, status: 'active' },
      { $set: { isPrimary: false, updatedBy: actorId } }
    );

    await CustomerGroupAssignment.updateOne(
      { customerId, groupId: primaryGroupId, status: 'active' },
      {
        $set: {
          isPrimary: true,
          resolutionReason: 'manual-primary-selection',
          updatedBy: actorId,
        },
      }
    );

    const primaryGroup = await CustomerGroup.findById(primaryGroupId).select('name').lean();

    await User.findByIdAndUpdate(customerId, {
      $set: {
        primaryCustomerGroupId: primaryGroupId,
        customerGroup: primaryGroup?.name || '',
      },
    });

    return {
      customerId,
      primaryGroupId,
    };
  }

  static async getFinancialSummary(groupId) {
    const [group, activeAssignments] = await Promise.all([
      CustomerGroup.findById(groupId).lean(),
      CustomerGroupAssignment.countDocuments({ groupId, status: 'active' }),
    ]);

    if (!group) {
      throw new Error('Customer group not found');
    }

    return {
      groupId,
      groupName: group.name,
      activeAssignments,
      paymentDueDays: group.financeProfile?.paymentDueDays || 14,
      discountPercent: group.financeProfile?.discountPercent || 0,
      cashDiscountPercent: group.financeProfile?.cashDiscountPercent || 0,
      cashDiscountDays: group.financeProfile?.cashDiscountDays || 0,
      creditLimit: group.financeProfile?.creditLimit || 0,
      currency: group.financeProfile?.currency || 'EUR',
      taxMode: group.financeProfile?.taxMode || 'default',
      paymentTermsLabel: group.financeProfile?.paymentTermsLabel || '',
      invoicePrefix: group.financeProfile?.invoicePrefix || '',
      allowedPaymentMethods: group.financeProfile?.allowedPaymentMethods || [],
    };
  }

  static async getAffiliateSummary(groupId) {
    const normalizedGroupId = new mongoose.Types.ObjectId(groupId);
    const [group, attributionsCount, commissionStats] = await Promise.all([
      CustomerGroup.findById(groupId).lean(),
      AffiliateAttribution.countDocuments({}),
      AffiliateCommission.aggregate([
        { $match: { groupId: normalizedGroupId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$computedAmount' },
          },
        },
      ]),
    ]);

    if (!group) {
      throw new Error('Customer group not found');
    }

    const byStatus = commissionStats.reduce((acc, entry) => {
      acc[entry._id] = {
        count: entry.count,
        amount: entry.totalAmount,
      };
      return acc;
    }, {});

    return {
      groupId,
      groupName: group.name,
      attributionModel: group.affiliateProfile?.attributionModel || 'last_click',
      defaultCommissionType: group.affiliateProfile?.defaultCommissionType || 'percentage',
      defaultCommissionValue: group.affiliateProfile?.defaultCommissionValue || 0,
      releaseTrigger: group.affiliateProfile?.releaseTrigger || 'invoice_paid',
      holdDays: group.affiliateProfile?.holdDays || 0,
      attributionsCount,
      commissions: {
        pending: byStatus.pending || { count: 0, amount: 0 },
        approved: byStatus.approved || { count: 0, amount: 0 },
        released: byStatus.released || { count: 0, amount: 0 },
        reversed: byStatus.reversed || { count: 0, amount: 0 },
      },
    };
  }
}

module.exports = CustomerGroupService;