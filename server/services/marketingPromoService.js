const mongoose = require('mongoose');

const User = require('../models/User');
const Order = require('../models/Order');
const MarketingCampaign = require('../models/MarketingCampaign');
const MarketingSegment = require('../models/MarketingSegment');
const Newsletter = require('../models/Newsletter');
const NewsletterDelivery = require('../models/NewsletterDelivery');
const PromoCode = require('../models/PromoCode');
const PromoCodeRedemption = require('../models/PromoCodeRedemption');
const MarketingAuditLog = require('../models/MarketingAuditLog');
const MarketingSettings = require('../models/MarketingSettings');
const EmailService = require('./emailService');

const NEWSLETTER_TEMPLATE_NAME = 'Allgemeine Systemnachricht';

const toInt = (value, fallback) => {
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toFloat = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeStatus = (status, allowed, fallback) => {
  if (!status) return fallback;
  const normalized = String(status).trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
};

const normalizeSortDirection = (value) => (String(value).toLowerCase() === 'asc' ? 1 : -1);

const pick = (obj, keys) => keys.reduce((acc, key) => {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    acc[key] = obj[key];
  }
  return acc;
}, {});

const randomPromoFragment = (length = 8) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

class MarketingPromoService {
  static async generateUniquePromoCode(prefix = 'PROMO') {
    const safePrefix = String(prefix || 'PROMO').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'PROMO';

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = `${safePrefix}-${randomPromoFragment(6 + attempt)}`;
      // eslint-disable-next-line no-await-in-loop
      const exists = await PromoCode.exists({ code });
      if (!exists) return code;
    }

    return `${safePrefix}-${Date.now().toString(36).toUpperCase()}`;
  }

  static async logAudit({ action, entityType, entityId = null, entityLabel = '', details = {}, user, req }) {
    try {
      await MarketingAuditLog.create({
        action,
        entityType,
        entityId,
        entityLabel,
        details,
        performedBy: user?._id,
        performedByEmail: String(user?.email || '').toLowerCase(),
        requestContext: {
          ip: req?.headers?.['x-forwarded-for'] || req?.ip || '',
          userAgent: req?.headers?.['user-agent'] || '',
        },
      });
    } catch (error) {
      console.error('MarketingPromoService.logAudit error:', error.message);
    }
  }

  static async ensureSettings() {
    let settings = await MarketingSettings.findOne().lean();
    if (!settings) {
      settings = await MarketingSettings.create({});
    }
    return settings;
  }

  static buildSegmentUserQuery(rules = {}) {
    const query = { role: 'customer' };

    if (Array.isArray(rules.roles) && rules.roles.length > 0) {
      query.role = { $in: rules.roles };
    }

    if (Array.isArray(rules.statuses) && rules.statuses.length > 0) {
      query.status = { $in: rules.statuses };
    }

    if (rules.newsletterOptInOnly !== false) {
      query.newsletter = true;
    }

    if (Array.isArray(rules.includeCustomerGroupIds) && rules.includeCustomerGroupIds.length > 0) {
      query.$or = [
        { primaryCustomerGroupId: { $in: rules.includeCustomerGroupIds } },
        { customerGroupIds: { $in: rules.includeCustomerGroupIds } },
      ];
    }

    if (Array.isArray(rules.includeCountries) && rules.includeCountries.length > 0) {
      query.country = { $in: rules.includeCountries.filter(Boolean).map((country) => String(country).trim()) };
    }

    if (rules.createdAfter || rules.createdBefore) {
      query.createdAt = {};
      if (rules.createdAfter) {
        query.createdAt.$gte = new Date(rules.createdAfter);
      }
      if (rules.createdBefore) {
        query.createdAt.$lte = new Date(rules.createdBefore);
      }
    }

    return query;
  }

  static async evaluateSegmentUsers(rules = {}, { limit = 100000, select = '_id email firstName lastName name' } = {}) {
    const userQuery = this.buildSegmentUserQuery(rules);
    let users = await User.find(userQuery)
      .select(select)
      .limit(limit)
      .lean();

    const minTotalOrders = Math.max(0, toInt(rules.minTotalOrders, 0));
    const minTotalSpent = Math.max(0, toFloat(rules.minTotalSpent, 0));

    if (minTotalOrders > 0 || minTotalSpent > 0) {
      const userIds = users.map((user) => user._id);
      const orderStats = await Order.aggregate([
        { $match: { customerId: { $in: userIds } } },
        {
          $group: {
            _id: '$customerId',
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: '$totalCost' },
          },
        },
      ]);

      const statsByUserId = new Map(orderStats.map((entry) => [String(entry._id), entry]));

      users = users.filter((user) => {
        const stats = statsByUserId.get(String(user._id)) || { totalOrders: 0, totalSpent: 0 };
        if (minTotalOrders > 0 && stats.totalOrders < minTotalOrders) return false;
        if (minTotalSpent > 0 && stats.totalSpent < minTotalSpent) return false;
        return true;
      });
    }

    const withValidEmail = users.filter((user) => String(user.email || '').includes('@'));
    return withValidEmail;
  }

  static validateNewsletterPayload(payload) {
    if (!String(payload.internalName || '').trim()) {
      throw new Error('Interner Name ist erforderlich.');
    }
    if (!String(payload.subject || '').trim()) {
      throw new Error('Newsletter-Betreff ist erforderlich.');
    }
    if (!String(payload.content || '').trim()) {
      throw new Error('Newsletter-Inhalt ist erforderlich.');
    }
  }

  static validatePromoPayload(payload) {
    if (!String(payload.internalName || '').trim()) {
      throw new Error('Interner Name ist erforderlich.');
    }
    if (!String(payload.code || '').trim()) {
      throw new Error('Promo-Code ist erforderlich.');
    }

    const discountType = String(payload.discountType || '').toLowerCase();
    if (!['percentage', 'fixed_amount'].includes(discountType)) {
      throw new Error('Rabattart muss percentage oder fixed_amount sein.');
    }

    const value = toFloat(payload.value, -1);
    if (!(value > 0)) {
      throw new Error('Rabattwert muss groesser als 0 sein.');
    }

    const startDate = new Date(payload.startDate);
    const endDate = new Date(payload.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error('Startdatum und Enddatum muessen gueltig sein.');
    }

    if (endDate < startDate) {
      throw new Error('Enddatum darf nicht vor dem Startdatum liegen.');
    }

    if (discountType === 'percentage' && value > 100) {
      throw new Error('Prozentualer Rabatt darf maximal 100 betragen.');
    }

    const minimumOrderValue = toFloat(payload.rules?.minimumOrderValue, 0);
    const usageLimitTotal = toInt(payload.rules?.usageLimitTotal, 0);
    const usageLimitPerCustomer = toInt(payload.rules?.usageLimitPerCustomer, 0);

    if (minimumOrderValue < 0 || usageLimitTotal < 0 || usageLimitPerCustomer < 0) {
      throw new Error('Regelwerte muessen >= 0 sein.');
    }

    if (usageLimitTotal > 0 && usageLimitPerCustomer > usageLimitTotal) {
      throw new Error('Nutzungslimit pro Kunde darf das Gesamtlimit nicht ueberschreiten.');
    }
  }

  static validateSegmentPayload(payload) {
    if (!String(payload.internalName || '').trim()) {
      throw new Error('Segmentname ist erforderlich.');
    }
    const minTotalOrders = toInt(payload.rules?.minTotalOrders, 0);
    const minTotalSpent = toFloat(payload.rules?.minTotalSpent, 0);
    if (minTotalOrders < 0 || minTotalSpent < 0) {
      throw new Error('Segmentregeln muessen gueltige positive Zahlen enthalten.');
    }
  }

  static async listNewsletters(query = {}) {
    const page = Math.max(1, toInt(query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(query.limit, 20)));
    const skip = (page - 1) * limit;
    const allowedSortBy = ['createdAt', 'updatedAt', 'scheduledAt', 'sentAt', 'status', 'internalName'];
    const sortBy = allowedSortBy.includes(String(query.sortBy)) ? String(query.sortBy) : 'createdAt';
    const sortOrder = normalizeSortDirection(query.sortOrder);

    const filters = {};
    if (query.status && query.status !== 'all') {
      filters.status = query.status;
    }

    const search = String(query.search || '').trim();
    if (search) {
      filters.$text = { $search: search };
    }

    const [rows, total] = await Promise.all([
      Newsletter.find(filters)
        .populate('segmentId', 'internalName')
        .populate('promoCodeIds', 'code internalName status')
        .populate('campaignId', 'internalName status')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Newsletter.countDocuments(filters),
    ]);

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async createNewsletter(payload, context) {
    this.validateNewsletterPayload(payload);

    const document = await Newsletter.create({
      internalName: String(payload.internalName || '').trim(),
      subject: String(payload.subject || '').trim(),
      preheader: String(payload.preheader || '').trim(),
      content: String(payload.content || '').trim(),
      templateName: String(payload.templateName || NEWSLETTER_TEMPLATE_NAME).trim(),
      status: normalizeStatus(payload.status, ['draft', 'scheduled', 'sending', 'sent', 'failed', 'archived'], 'draft'),
      scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
      segmentId: payload.segmentId || null,
      campaignId: payload.campaignId || null,
      promoCodeIds: Array.isArray(payload.promoCodeIds) ? payload.promoCodeIds : [],
      createdBy: context.user._id,
      updatedBy: context.user._id,
    });

    await this.logAudit({
      action: 'newsletter_created',
      entityType: 'newsletter',
      entityId: document._id,
      entityLabel: document.internalName,
      details: { status: document.status },
      user: context.user,
      req: context.req,
    });

    return document;
  }

  static async updateNewsletter(id, payload, context) {
    const existing = await Newsletter.findById(id);
    if (!existing) throw new Error('Newsletter wurde nicht gefunden.');

    const merged = {
      ...existing.toObject(),
      ...pick(payload, [
        'internalName',
        'subject',
        'preheader',
        'content',
        'templateName',
        'status',
        'scheduledAt',
        'segmentId',
        'campaignId',
        'promoCodeIds',
      ]),
    };

    this.validateNewsletterPayload(merged);

    existing.internalName = String(merged.internalName || '').trim();
    existing.subject = String(merged.subject || '').trim();
    existing.preheader = String(merged.preheader || '').trim();
    existing.content = String(merged.content || '').trim();
    existing.templateName = String(merged.templateName || NEWSLETTER_TEMPLATE_NAME).trim();
    existing.status = normalizeStatus(merged.status, ['draft', 'scheduled', 'sending', 'sent', 'failed', 'archived'], existing.status);
    existing.scheduledAt = merged.scheduledAt ? new Date(merged.scheduledAt) : null;
    existing.segmentId = merged.segmentId || null;
    existing.campaignId = merged.campaignId || null;
    existing.promoCodeIds = Array.isArray(merged.promoCodeIds) ? merged.promoCodeIds : [];
    existing.updatedBy = context.user._id;

    await existing.save();

    await this.logAudit({
      action: 'newsletter_updated',
      entityType: 'newsletter',
      entityId: existing._id,
      entityLabel: existing.internalName,
      details: { status: existing.status },
      user: context.user,
      req: context.req,
    });

    return existing;
  }

  static async duplicateNewsletter(id, context) {
    const existing = await Newsletter.findById(id).lean();
    if (!existing) throw new Error('Newsletter wurde nicht gefunden.');

    const copy = await Newsletter.create({
      internalName: `${existing.internalName} (Copy)`,
      subject: existing.subject,
      preheader: existing.preheader,
      content: existing.content,
      templateName: existing.templateName || NEWSLETTER_TEMPLATE_NAME,
      status: 'draft',
      segmentId: existing.segmentId || null,
      campaignId: existing.campaignId || null,
      promoCodeIds: existing.promoCodeIds || [],
      createdBy: context.user._id,
      updatedBy: context.user._id,
    });

    await this.logAudit({
      action: 'newsletter_duplicated',
      entityType: 'newsletter',
      entityId: copy._id,
      entityLabel: copy.internalName,
      details: { sourceId: String(id) },
      user: context.user,
      req: context.req,
    });

    return copy;
  }

  static async archiveNewsletter(id, context) {
    const newsletter = await Newsletter.findByIdAndUpdate(
      id,
      { status: 'archived', updatedBy: context.user._id },
      { new: true }
    );

    if (!newsletter) throw new Error('Newsletter wurde nicht gefunden.');

    await this.logAudit({
      action: 'newsletter_archived',
      entityType: 'newsletter',
      entityId: newsletter._id,
      entityLabel: newsletter.internalName,
      details: {},
      user: context.user,
      req: context.req,
    });

    return newsletter;
  }

  static async resolveNewsletterRecipients(newsletter) {
    if (!newsletter.segmentId) {
      return [];
    }

    const segment = await MarketingSegment.findById(newsletter.segmentId).lean();
    if (!segment || segment.status !== 'active') {
      return [];
    }

    const recipients = await this.evaluateSegmentUsers(segment.rules, {
      select: '_id email firstName lastName name newsletter preferences.communication.newsletter role status',
    });

    return recipients
      .filter((user) => user.newsletter === true)
      .filter((user) => user.preferences?.communication?.newsletter !== false)
      .map((user) => ({
        userId: user._id,
        email: String(user.email || '').toLowerCase(),
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email,
      }));
  }

  static applyNewsletterPlaceholders(text, placeholders = {}) {
    if (!text) return '';

    return String(text).replace(/{{\s*(\w+)\s*}}/g, (match, variableName) => {
      if (!Object.prototype.hasOwnProperty.call(placeholders, variableName)) {
        return match;
      }

      const value = placeholders[variableName];
      if (value === undefined || value === null) {
        return '';
      }

      return String(value);
    });
  }

  static buildPromoCodeData(promoCodes = []) {
    const validCodes = (promoCodes || [])
      .map((promo) => String(promo?.code || '').trim())
      .filter(Boolean);

    const text = validCodes.join(', ');
    const html = validCodes.length > 0
      ? `<ul>${validCodes.map((code) => `<li><strong>${code}</strong></li>`).join('')}</ul>`
      : '';

    return {
      text,
      html,
      primary: validCodes[0] || '',
    };
  }

  static ensurePromoFallbackInContent(content, promoCodeText) {
    if (!promoCodeText) {
      return content;
    }

    if (/{{\s*(promoCodes|promoCodesHtml|primaryPromoCode)\s*}}/i.test(content)) {
      return content;
    }

    return `${content}<p><strong>Promo-Code(s):</strong> ${promoCodeText}</p>`;
  }

  static buildNewsletterPlaceholderMap({ newsletter, recipientName, promoCodeData, nowLabel, effectiveDate, ctaUrl }) {
    const normalizedRecipientName = String(recipientName || '').trim() || 'Kunde';
    const firstName = normalizedRecipientName.split(' ').filter(Boolean)[0] || normalizedRecipientName;

    return {
      customerName: normalizedRecipientName,
      firstName,
      companyName: process.env.COMPANY_NAME || 'McRepair.de',
      newsletterName: newsletter.internalName || '',
      newsletterSubject: newsletter.subject || '',
      currentDate: nowLabel,
      currentYear: String(new Date().getFullYear()),
      effectiveDate,
      ctaUrl,
      primaryPromoCode: promoCodeData.primary,
      promoCodes: promoCodeData.text,
      promoCodesHtml: promoCodeData.html,
    };
  }

  static async sendNewsletterTest(id, testEmail, context) {
    const newsletter = await Newsletter.findById(id)
      .populate('promoCodeIds', 'code')
      .lean();

    if (!newsletter) throw new Error('Newsletter wurde nicht gefunden.');
    if (!String(testEmail || '').includes('@')) throw new Error('Gueltige Test-E-Mail ist erforderlich.');

    const nowLabel = new Date().toLocaleString('de-DE');
    const effectiveDate = newsletter.scheduledAt ? new Date(newsletter.scheduledAt).toLocaleString('de-DE') : nowLabel;
    const ctaUrl = await EmailService.buildSystemUrl('/newsletter');
    const promoCodeData = this.buildPromoCodeData(newsletter.promoCodeIds || []);
    const placeholders = this.buildNewsletterPlaceholderMap({
      newsletter,
      recipientName: 'Test Empfaenger',
      promoCodeData,
      nowLabel,
      effectiveDate,
      ctaUrl,
    });

    const contentTemplate = this.ensurePromoFallbackInContent(newsletter.content, promoCodeData.text);
    const resolvedSubject = this.applyNewsletterPlaceholders(newsletter.subject, placeholders);
    const resolvedPreheader = this.applyNewsletterPlaceholders(
      newsletter.preheader || `Testversand: ${newsletter.internalName}`,
      placeholders
    );
    const resolvedBody = this.applyNewsletterPlaceholders(contentTemplate, placeholders);

    const result = await EmailService.sendTemplateEmail(NEWSLETTER_TEMPLATE_NAME, testEmail, {
      companyName: process.env.COMPANY_NAME || 'McRepair.de',
      customerName: 'Test Empfaenger',
      firstName: placeholders.firstName,
      notificationTitle: resolvedSubject,
      notificationPreview: resolvedPreheader,
      notificationTopic: 'Newsletter-Test',
      notificationBody: resolvedBody,
      newsletterSubject: resolvedSubject,
      currentDate: nowLabel,
      currentYear: String(new Date().getFullYear()),
      notificationDate: nowLabel,
      effectiveDate,
      ctaLabel: 'Im Browser oeffnen',
      ctaUrl,
      primaryPromoCode: promoCodeData.primary,
      promoCodes: promoCodeData.text,
      promoCodesHtml: promoCodeData.html,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
      supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789',
    });

    await NewsletterDelivery.create({
      newsletterId: newsletter._id,
      campaignId: newsletter.campaignId || null,
      segmentId: newsletter.segmentId || null,
      recipientEmail: String(testEmail).toLowerCase().trim(),
      isTest: true,
      status: result.success ? 'sent' : 'failed',
      providerMessageId: result.messageId || '',
      error: result.error || '',
      sentAt: result.success ? new Date() : null,
      metadata: { testBy: context.user.email },
    });

    await this.logAudit({
      action: 'newsletter_test_sent',
      entityType: 'newsletter',
      entityId: newsletter._id,
      entityLabel: newsletter.internalName,
      details: { testEmail, success: !!result.success },
      user: context.user,
      req: context.req,
    });

    return result;
  }

  static async scheduleNewsletter(id, scheduledAt, context) {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      throw new Error('Gueltiger Versandzeitpunkt ist erforderlich.');
    }

    const newsletter = await Newsletter.findById(id);
    if (!newsletter) throw new Error('Newsletter wurde nicht gefunden.');

    this.validateNewsletterPayload(newsletter);

    newsletter.status = 'scheduled';
    newsletter.scheduledAt = when;
    newsletter.updatedBy = context.user._id;

    const recipients = await this.resolveNewsletterRecipients(newsletter);
    if (recipients.length === 0) {
      throw new Error('Keine gueltige Empfaengerbasis vorhanden.');
    }

    newsletter.recipientSnapshot = {
      total: recipients.length,
      emails: recipients.slice(0, 1000).map((item) => item.email),
    };

    await newsletter.save();

    await this.logAudit({
      action: 'newsletter_scheduled',
      entityType: 'newsletter',
      entityId: newsletter._id,
      entityLabel: newsletter.internalName,
      details: { scheduledAt: when.toISOString(), recipients: recipients.length },
      user: context.user,
      req: context.req,
    });

    return newsletter;
  }

  static async sendNewsletterNow(id, context) {
    const newsletter = await Newsletter.findById(id)
      .populate('promoCodeIds', 'code')
      .lean();

    if (!newsletter) throw new Error('Newsletter wurde nicht gefunden.');
    this.validateNewsletterPayload(newsletter);

    const recipients = await this.resolveNewsletterRecipients(newsletter);
    if (recipients.length === 0) {
      throw new Error('Keine gueltige Empfaengerbasis vorhanden.');
    }

    await Newsletter.updateOne({ _id: id }, { status: 'sending', updatedBy: context.user._id });

    const settings = await this.ensureSettings();
    const batchSize = Math.min(Math.max(1, settings.maxSendBatchSize || 200), 500);

    let sent = 0;
    let failed = 0;
    const nowLabel = new Date().toLocaleString('de-DE');
    const effectiveDate = newsletter.scheduledAt ? new Date(newsletter.scheduledAt).toLocaleString('de-DE') : nowLabel;
    const ctaUrl = await EmailService.buildSystemUrl('/newsletter');
    const promoCodeData = this.buildPromoCodeData(newsletter.promoCodeIds || []);
    const contentTemplate = this.ensurePromoFallbackInContent(newsletter.content, promoCodeData.text);

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const batchResults = await Promise.all(batch.map(async (recipient) => {
        const placeholders = this.buildNewsletterPlaceholderMap({
          newsletter,
          recipientName: recipient.customerName,
          promoCodeData,
          nowLabel,
          effectiveDate,
          ctaUrl,
        });

        const resolvedSubject = this.applyNewsletterPlaceholders(newsletter.subject, placeholders);
        const resolvedPreview = this.applyNewsletterPlaceholders(newsletter.preheader || newsletter.subject, placeholders);
        const resolvedBody = this.applyNewsletterPlaceholders(contentTemplate, placeholders);

        const result = await EmailService.sendTemplateEmail(NEWSLETTER_TEMPLATE_NAME, recipient.email, {
          companyName: process.env.COMPANY_NAME || 'McRepair.de',
          customerName: recipient.customerName,
          firstName: placeholders.firstName,
          notificationTitle: resolvedSubject,
          notificationPreview: resolvedPreview,
          notificationTopic: 'Newsletter',
          notificationBody: resolvedBody,
          newsletterSubject: resolvedSubject,
          currentDate: nowLabel,
          currentYear: String(new Date().getFullYear()),
          notificationDate: nowLabel,
          effectiveDate,
          ctaLabel: 'Mehr erfahren',
          ctaUrl,
          primaryPromoCode: promoCodeData.primary,
          promoCodes: promoCodeData.text,
          promoCodesHtml: promoCodeData.html,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
          supportPhone: process.env.SUPPORT_PHONE || '+49 (0) 123/456789',
        });

        return {
          recipient,
          result,
        };
      }));

      const deliveryRows = batchResults.map(({ recipient, result }) => {
        const success = !!result.success;
        if (success) sent += 1;
        else failed += 1;

        return {
          newsletterId: newsletter._id,
          campaignId: newsletter.campaignId || null,
          segmentId: newsletter.segmentId || null,
          recipientUserId: recipient.userId,
          recipientEmail: recipient.email,
          status: success ? 'sent' : 'failed',
          providerMessageId: result.messageId || '',
          error: result.error || '',
          sentAt: success ? new Date() : null,
          metadata: {
            attempts: result.attempts || 1,
          },
        };
      });

      if (deliveryRows.length > 0) {
        await NewsletterDelivery.insertMany(deliveryRows, { ordered: false });
      }
    }

    const opened = await NewsletterDelivery.countDocuments({ newsletterId: newsletter._id, status: 'opened' });
    const clicked = await NewsletterDelivery.countDocuments({ newsletterId: newsletter._id, status: 'clicked' });
    const bounced = await NewsletterDelivery.countDocuments({ newsletterId: newsletter._id, status: 'bounced' });
    const unsubscribed = await NewsletterDelivery.countDocuments({ newsletterId: newsletter._id, status: 'unsubscribed' });

    const finalStatus = failed > 0 && sent === 0 ? 'failed' : 'sent';

    const updated = await Newsletter.findByIdAndUpdate(
      newsletter._id,
      {
        status: finalStatus,
        sentAt: new Date(),
        updatedBy: context.user._id,
        lastError: finalStatus === 'failed' ? 'Alle Versandversuche fehlgeschlagen.' : '',
        recipientSnapshot: {
          total: recipients.length,
          emails: recipients.slice(0, 1000).map((entry) => entry.email),
        },
        stats: {
          sent,
          failed,
          opened,
          clicked,
          bounced,
          unsubscribed,
        },
      },
      { new: true }
    );

    await this.logAudit({
      action: 'newsletter_sent',
      entityType: 'newsletter',
      entityId: newsletter._id,
      entityLabel: newsletter.internalName,
      details: { recipients: recipients.length, sent, failed, status: finalStatus },
      user: context.user,
      req: context.req,
    });

    return {
      newsletter: updated,
      delivery: {
        total: recipients.length,
        sent,
        failed,
      },
    };
  }

  static async listNewsletterDeliveries(newsletterId, query = {}) {
    const page = Math.max(1, toInt(query.page, 1));
    const limit = Math.min(200, Math.max(1, toInt(query.limit, 50)));
    const skip = (page - 1) * limit;

    const filters = { newsletterId };
    if (query.status && query.status !== 'all') {
      filters.status = query.status;
    }
    if (query.isTest === 'true') {
      filters.isTest = true;
    }

    const [rows, total] = await Promise.all([
      NewsletterDelivery.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NewsletterDelivery.countDocuments(filters),
    ]);

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async listPromoCodes(query = {}) {
    const page = Math.max(1, toInt(query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(query.limit, 20)));
    const skip = (page - 1) * limit;
    const allowedSortBy = ['createdAt', 'updatedAt', 'startDate', 'endDate', 'status', 'internalName', 'code', 'usageCount'];
    const sortBy = allowedSortBy.includes(String(query.sortBy)) ? String(query.sortBy) : 'createdAt';
    const sortOrder = normalizeSortDirection(query.sortOrder);

    const filters = {};
    if (query.status && query.status !== 'all') {
      filters.status = query.status;
    }

    const search = String(query.search || '').trim();
    if (search) {
      filters.$text = { $search: search };
    }

    const [rows, total] = await Promise.all([
      PromoCode.find(filters)
        .populate('campaignId', 'internalName status')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      PromoCode.countDocuments(filters),
    ]);

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async createPromoCode(payload, context) {
    if (!String(payload.code || '').trim()) {
      payload.code = await this.generateUniquePromoCode(payload.internalName || 'PROMO');
    }

    this.validatePromoPayload(payload);

    const code = String(payload.code || '').trim().toUpperCase();
    const existing = await PromoCode.findOne({ code }).lean();
    if (existing) {
      throw new Error('Promo-Code muss eindeutig sein.');
    }

    const document = await PromoCode.create({
      internalName: String(payload.internalName || '').trim(),
      code,
      description: String(payload.description || '').trim(),
      discountType: String(payload.discountType || '').toLowerCase(),
      value: toFloat(payload.value, 0),
      startDate: new Date(payload.startDate),
      endDate: new Date(payload.endDate),
      status: normalizeStatus(payload.status, ['draft', 'active', 'inactive', 'expired', 'archived'], 'draft'),
      rules: {
        minimumOrderValue: toFloat(payload.rules?.minimumOrderValue, 0),
        usageLimitTotal: toInt(payload.rules?.usageLimitTotal, 0),
        usageLimitPerCustomer: toInt(payload.rules?.usageLimitPerCustomer, 0),
        combinable: !!payload.rules?.combinable,
        productIds: Array.isArray(payload.rules?.productIds) ? payload.rules.productIds : [],
        serviceCategoryIds: Array.isArray(payload.rules?.serviceCategoryIds) ? payload.rules.serviceCategoryIds : [],
        customerGroupIds: Array.isArray(payload.rules?.customerGroupIds) ? payload.rules.customerGroupIds : [],
      },
      campaignId: payload.campaignId || null,
      newsletterIds: Array.isArray(payload.newsletterIds) ? payload.newsletterIds : [],
      createdBy: context.user._id,
      updatedBy: context.user._id,
    });

    await this.logAudit({
      action: 'promo_code_created',
      entityType: 'promo_code',
      entityId: document._id,
      entityLabel: document.code,
      details: { status: document.status },
      user: context.user,
      req: context.req,
    });

    return document;
  }

  static async updatePromoCode(id, payload, context) {
    const existing = await PromoCode.findById(id);
    if (!existing) throw new Error('Promo-Code wurde nicht gefunden.');

    const merged = {
      ...existing.toObject(),
      ...pick(payload, [
        'internalName',
        'code',
        'description',
        'discountType',
        'value',
        'startDate',
        'endDate',
        'status',
        'rules',
        'campaignId',
        'newsletterIds',
      ]),
      rules: {
        ...existing.rules,
        ...(payload.rules || {}),
      },
    };

    this.validatePromoPayload(merged);

    const normalizedCode = String(merged.code || '').trim().toUpperCase();
    const duplicate = await PromoCode.findOne({ code: normalizedCode, _id: { $ne: id } }).lean();
    if (duplicate) {
      throw new Error('Promo-Code muss eindeutig sein.');
    }

    existing.internalName = String(merged.internalName || '').trim();
    existing.code = normalizedCode;
    existing.description = String(merged.description || '').trim();
    existing.discountType = String(merged.discountType || '').toLowerCase();
    existing.value = toFloat(merged.value, 0);
    existing.startDate = new Date(merged.startDate);
    existing.endDate = new Date(merged.endDate);
    existing.status = normalizeStatus(merged.status, ['draft', 'active', 'inactive', 'expired', 'archived'], existing.status);
    existing.rules = {
      minimumOrderValue: toFloat(merged.rules?.minimumOrderValue, 0),
      usageLimitTotal: toInt(merged.rules?.usageLimitTotal, 0),
      usageLimitPerCustomer: toInt(merged.rules?.usageLimitPerCustomer, 0),
      combinable: !!merged.rules?.combinable,
      productIds: Array.isArray(merged.rules?.productIds) ? merged.rules.productIds : [],
      serviceCategoryIds: Array.isArray(merged.rules?.serviceCategoryIds) ? merged.rules.serviceCategoryIds : [],
      customerGroupIds: Array.isArray(merged.rules?.customerGroupIds) ? merged.rules.customerGroupIds : [],
    };
    existing.campaignId = merged.campaignId || null;
    existing.newsletterIds = Array.isArray(merged.newsletterIds) ? merged.newsletterIds : [];
    existing.updatedBy = context.user._id;

    await existing.save();

    await this.logAudit({
      action: 'promo_code_updated',
      entityType: 'promo_code',
      entityId: existing._id,
      entityLabel: existing.code,
      details: { status: existing.status },
      user: context.user,
      req: context.req,
    });

    return existing;
  }

  static async setPromoCodeActiveState(id, enabled, context) {
    const status = enabled ? 'active' : 'inactive';
    const promo = await PromoCode.findByIdAndUpdate(
      id,
      { status, updatedBy: context.user._id },
      { new: true }
    );

    if (!promo) throw new Error('Promo-Code wurde nicht gefunden.');

    await this.logAudit({
      action: enabled ? 'promo_code_activated' : 'promo_code_deactivated',
      entityType: 'promo_code',
      entityId: promo._id,
      entityLabel: promo.code,
      details: { status: promo.status },
      user: context.user,
      req: context.req,
    });

    return promo;
  }

  static async archivePromoCode(id, context) {
    const promo = await PromoCode.findByIdAndUpdate(
      id,
      { status: 'archived', updatedBy: context.user._id },
      { new: true }
    );

    if (!promo) throw new Error('Promo-Code wurde nicht gefunden.');

    await this.logAudit({
      action: 'promo_code_archived',
      entityType: 'promo_code',
      entityId: promo._id,
      entityLabel: promo.code,
      details: {},
      user: context.user,
      req: context.req,
    });

    return promo;
  }

  static async listPromoRedemptions(promoCodeId, query = {}) {
    const page = Math.max(1, toInt(query.page, 1));
    const limit = Math.min(200, Math.max(1, toInt(query.limit, 50)));
    const skip = (page - 1) * limit;

    const filters = { promoCodeId };

    const [rows, total] = await Promise.all([
      PromoCodeRedemption.find(filters)
        .populate('customerId', 'firstName lastName email')
        .populate('orderId', 'orderNumber totalCost status')
        .sort({ redeemedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PromoCodeRedemption.countDocuments(filters),
    ]);

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async listSegments(query = {}) {
    const page = Math.max(1, toInt(query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(query.limit, 20)));
    const skip = (page - 1) * limit;

    const filters = {};
    if (query.status && query.status !== 'all') {
      filters.status = query.status;
    }

    const search = String(query.search || '').trim();
    if (search) {
      filters.$text = { $search: search };
    }

    const [rows, total] = await Promise.all([
      MarketingSegment.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MarketingSegment.countDocuments(filters),
    ]);

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async createSegment(payload, context) {
    this.validateSegmentPayload(payload);

    const rules = {
      roles: Array.isArray(payload.rules?.roles) ? payload.rules.roles : ['customer'],
      statuses: Array.isArray(payload.rules?.statuses) ? payload.rules.statuses : ['active'],
      newsletterOptInOnly: payload.rules?.newsletterOptInOnly !== false,
      includeCustomerGroupIds: Array.isArray(payload.rules?.includeCustomerGroupIds) ? payload.rules.includeCustomerGroupIds : [],
      includeCountries: Array.isArray(payload.rules?.includeCountries) ? payload.rules.includeCountries : [],
      minTotalOrders: Math.max(0, toInt(payload.rules?.minTotalOrders, 0)),
      minTotalSpent: Math.max(0, toFloat(payload.rules?.minTotalSpent, 0)),
      createdAfter: payload.rules?.createdAfter ? new Date(payload.rules.createdAfter) : null,
      createdBefore: payload.rules?.createdBefore ? new Date(payload.rules.createdBefore) : null,
    };

    const previewUsers = await this.evaluateSegmentUsers(rules, { limit: 50000 });

    const document = await MarketingSegment.create({
      internalName: String(payload.internalName || '').trim(),
      description: String(payload.description || '').trim(),
      status: normalizeStatus(payload.status, ['active', 'archived'], 'active'),
      rules,
      lastPreviewCount: previewUsers.length,
      createdBy: context.user._id,
      updatedBy: context.user._id,
    });

    await this.logAudit({
      action: 'segment_created',
      entityType: 'segment',
      entityId: document._id,
      entityLabel: document.internalName,
      details: { previewCount: previewUsers.length },
      user: context.user,
      req: context.req,
    });

    return document;
  }

  static async updateSegment(id, payload, context) {
    const existing = await MarketingSegment.findById(id);
    if (!existing) throw new Error('Segment wurde nicht gefunden.');

    const merged = {
      ...existing.toObject(),
      ...pick(payload, ['internalName', 'description', 'status']),
      rules: {
        ...existing.rules,
        ...(payload.rules || {}),
      },
    };

    this.validateSegmentPayload(merged);

    const rules = {
      roles: Array.isArray(merged.rules?.roles) ? merged.rules.roles : ['customer'],
      statuses: Array.isArray(merged.rules?.statuses) ? merged.rules.statuses : ['active'],
      newsletterOptInOnly: merged.rules?.newsletterOptInOnly !== false,
      includeCustomerGroupIds: Array.isArray(merged.rules?.includeCustomerGroupIds) ? merged.rules.includeCustomerGroupIds : [],
      includeCountries: Array.isArray(merged.rules?.includeCountries) ? merged.rules.includeCountries : [],
      minTotalOrders: Math.max(0, toInt(merged.rules?.minTotalOrders, 0)),
      minTotalSpent: Math.max(0, toFloat(merged.rules?.minTotalSpent, 0)),
      createdAfter: merged.rules?.createdAfter ? new Date(merged.rules.createdAfter) : null,
      createdBefore: merged.rules?.createdBefore ? new Date(merged.rules.createdBefore) : null,
    };

    const previewUsers = await this.evaluateSegmentUsers(rules, { limit: 50000 });

    existing.internalName = String(merged.internalName || '').trim();
    existing.description = String(merged.description || '').trim();
    existing.status = normalizeStatus(merged.status, ['active', 'archived'], existing.status);
    existing.rules = rules;
    existing.lastPreviewCount = previewUsers.length;
    existing.updatedBy = context.user._id;

    await existing.save();

    await this.logAudit({
      action: 'segment_updated',
      entityType: 'segment',
      entityId: existing._id,
      entityLabel: existing.internalName,
      details: { previewCount: previewUsers.length },
      user: context.user,
      req: context.req,
    });

    return existing;
  }

  static async previewSegment(id) {
    const segment = await MarketingSegment.findById(id).lean();
    if (!segment) throw new Error('Segment wurde nicht gefunden.');

    const users = await this.evaluateSegmentUsers(segment.rules, {
      limit: 200,
      select: 'email firstName lastName name newsletter status role country totalOrders totalSpent',
    });

    return {
      count: users.length,
      sample: users.slice(0, 50),
    };
  }

  static async getOverview(query = {}) {
    const fromDate = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = query.to ? new Date(query.to) : new Date();

    const dateFilter = { createdAt: { $gte: fromDate, $lte: toDate } };

    const [
      newsletterStats,
      promoStats,
      activePromoCodes,
      recentNewsletters,
      recentPromoCodes,
      recentAudit,
    ] = await Promise.all([
      Newsletter.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            sent: { $sum: '$stats.sent' },
            opened: { $sum: '$stats.opened' },
            clicked: { $sum: '$stats.clicked' },
            bounced: { $sum: '$stats.bounced' },
            unsubscribed: { $sum: '$stats.unsubscribed' },
            failed: { $sum: '$stats.failed' },
          },
        },
      ]),
      PromoCode.aggregate([
        {
          $group: {
            _id: null,
            redemptions: { $sum: '$usageCount' },
            discountVolume: { $sum: '$discountVolume' },
            revenueAttributed: { $sum: '$revenueAttributed' },
          },
        },
      ]),
      PromoCode.countDocuments({ status: 'active' }),
      Newsletter.find({}).sort({ createdAt: -1 }).limit(5).select('internalName subject status sentAt scheduledAt stats createdAt').lean(),
      PromoCode.find({}).sort({ createdAt: -1 }).limit(5).select('internalName code status usageCount value discountType startDate endDate').lean(),
      MarketingAuditLog.find({}).sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    return {
      period: { from: fromDate, to: toDate },
      newsletterKpis: newsletterStats[0] || {
        sent: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
        failed: 0,
      },
      promoKpis: {
        activeCodes: activePromoCodes,
        redemptions: promoStats[0]?.redemptions || 0,
        discountVolume: promoStats[0]?.discountVolume || 0,
        revenueAttributed: promoStats[0]?.revenueAttributed || 0,
      },
      recentNewsletters,
      recentPromoCodes,
      recentAudit,
    };
  }

  static async getReports(query = {}) {
    const fromDate = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = query.to ? new Date(query.to) : new Date();
    const newsletterStatus = query.newsletterStatus && query.newsletterStatus !== 'all' ? query.newsletterStatus : null;
    const promoStatus = query.promoStatus && query.promoStatus !== 'all' ? query.promoStatus : null;

    const newsletterMatch = {
      createdAt: { $gte: fromDate, $lte: toDate },
    };

    if (newsletterStatus) {
      newsletterMatch.status = newsletterStatus;
    }

    const promoMatch = {};
    if (promoStatus) {
      promoMatch.status = promoStatus;
    }

    const [
      newsletters,
      promoCodes,
      redemptions,
      newsletterDeliveryStats,
    ] = await Promise.all([
      Newsletter.find(newsletterMatch)
        .sort({ createdAt: -1 })
        .limit(100)
        .select('internalName subject status sentAt scheduledAt stats createdAt')
        .lean(),
      PromoCode.find(promoMatch)
        .sort({ createdAt: -1 })
        .limit(100)
        .select('internalName code status usageCount discountVolume revenueAttributed startDate endDate value discountType')
        .lean(),
      PromoCodeRedemption.find({ redeemedAt: { $gte: fromDate, $lte: toDate } })
        .sort({ redeemedAt: -1 })
        .limit(200)
        .populate('promoCodeId', 'code internalName')
        .populate('customerId', 'firstName lastName email')
        .populate('orderId', 'orderNumber totalCost status')
        .lean(),
      NewsletterDelivery.aggregate([
        { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      period: { from: fromDate, to: toDate },
      newsletterRows: newsletters,
      promoRows: promoCodes,
      redemptionRows: redemptions,
      newsletterDeliveryStats,
    };
  }

  static async listAuditLogs(query = {}) {
    const page = Math.max(1, toInt(query.page, 1));
    const limit = Math.min(200, Math.max(1, toInt(query.limit, 50)));
    const skip = (page - 1) * limit;

    const filters = {};
    if (query.entityType && query.entityType !== 'all') {
      filters.entityType = query.entityType;
    }
    if (query.action && query.action !== 'all') {
      filters.action = query.action;
    }

    const [rows, total] = await Promise.all([
      MarketingAuditLog.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MarketingAuditLog.countDocuments(filters),
    ]);

    return {
      rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async getSettings() {
    return this.ensureSettings();
  }

  static async updateSettings(payload, context) {
    const settings = await this.ensureSettings();

    const updates = {
      defaultFromName: String(payload.defaultFromName || settings.defaultFromName || '').trim(),
      defaultReplyTo: String(payload.defaultReplyTo || settings.defaultReplyTo || '').trim().toLowerCase(),
      trackOpens: typeof payload.trackOpens === 'boolean' ? payload.trackOpens : settings.trackOpens,
      trackClicks: typeof payload.trackClicks === 'boolean' ? payload.trackClicks : settings.trackClicks,
      allowTestSend: typeof payload.allowTestSend === 'boolean' ? payload.allowTestSend : settings.allowTestSend,
      maxSendBatchSize: Math.min(500, Math.max(1, toInt(payload.maxSendBatchSize, settings.maxSendBatchSize || 200))),
      updatedBy: context.user._id,
    };

    const updated = await MarketingSettings.findByIdAndUpdate(settings._id, updates, { new: true });

    await this.logAudit({
      action: 'settings_updated',
      entityType: 'settings',
      entityId: updated._id,
      entityLabel: 'marketing_settings',
      details: updates,
      user: context.user,
      req: context.req,
    });

    return updated;
  }

  static async getAdcellConfig() {
    const settings = await this.ensureSettings();
    return {
      enabled: settings.adcellEnabled ?? true,
      pid: settings.adcellPid || '10419',
      eventId: settings.adcellEventId || '13229',
      conversionEnabled: settings.adcellConversionEnabled ?? true,
      firstPartyEnabled: settings.adcellFirstPartyEnabled ?? true,
      containerTagsEnabled: settings.adcellContainerTagsEnabled ?? true,
    };
  }

  static async updateAdcellConfig(payload, context) {
    const settings = await this.ensureSettings();

    const pid = String(payload.pid || '').trim().replace(/[^0-9]/g, '');
    const eventId = String(payload.eventId || '').trim().replace(/[^0-9]/g, '');

    const updates = {
      adcellEnabled: typeof payload.enabled === 'boolean' ? payload.enabled : settings.adcellEnabled,
      adcellPid: pid || settings.adcellPid || '10419',
      adcellEventId: eventId || settings.adcellEventId || '13229',
      adcellConversionEnabled: typeof payload.conversionEnabled === 'boolean' ? payload.conversionEnabled : settings.adcellConversionEnabled,
      adcellFirstPartyEnabled: typeof payload.firstPartyEnabled === 'boolean' ? payload.firstPartyEnabled : settings.adcellFirstPartyEnabled,
      adcellContainerTagsEnabled: typeof payload.containerTagsEnabled === 'boolean' ? payload.containerTagsEnabled : settings.adcellContainerTagsEnabled,
      updatedBy: context.user._id,
    };

    const updated = await MarketingSettings.findByIdAndUpdate(settings._id, updates, { new: true });

    await this.logAudit({
      action: 'adcell_config_updated',
      entityType: 'settings',
      entityId: updated._id,
      entityLabel: 'adcell_tracking_config',
      details: updates,
      user: context.user,
      req: context.req,
    });

    return {
      enabled: updated.adcellEnabled,
      pid: updated.adcellPid,
      eventId: updated.adcellEventId,
      conversionEnabled: updated.adcellConversionEnabled,
      firstPartyEnabled: updated.adcellFirstPartyEnabled,
      containerTagsEnabled: updated.adcellContainerTagsEnabled,
    };
  }

  static async getAdcellExcludedCustomerGroups() {
    const settings = await this.ensureSettings();
    return (settings.adcellExcludedCustomerGroupIds || []).map((id) => id.toString());
  }

  static async updateAdcellExcludedCustomerGroups(customerGroupIds, context) {
    const settings = await this.ensureSettings();
    const validIds = Array.isArray(customerGroupIds)
      ? customerGroupIds
          .filter((id) => id)
          .map((id) => new mongoose.Types.ObjectId(id))
      : [];

    const updated = await MarketingSettings.findByIdAndUpdate(
      settings._id,
      { adcellExcludedCustomerGroupIds: validIds },
      { new: true, runValidators: true }
    );

    await this.logAudit({
      action: 'adcell_excluded_groups_updated',
      entityType: 'settings',
      entityId: updated._id,
      entityLabel: 'adcell_excluded_customer_groups',
      details: { excludedGroupIds: validIds },
      user: context.user,
      req: context.req,
    });

    return (updated.adcellExcludedCustomerGroupIds || []).map((id) => id.toString());
  }

  static async isCustomerInExcludedAdcellGroup(userId) {
    try {
      const settings = await this.ensureSettings();
      if (!settings.adcellExcludedCustomerGroupIds || settings.adcellExcludedCustomerGroupIds.length === 0) {
        return false;
      }

      const CustomerGroupAssignment = require('../models/CustomerGroupAssignment');

      // Check if the user has ANY active assignment to an excluded group
      const assignment = await CustomerGroupAssignment.findOne({
        customerId: userId,
        groupId: { $in: settings.adcellExcludedCustomerGroupIds },
        status: 'active',
      }).lean();

      return !!assignment;
    } catch (err) {
      console.error('Error checking excluded ADCELL group:', err);
      return false;
    }
  }
}

module.exports = MarketingPromoService;
