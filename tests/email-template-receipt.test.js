require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { connectDB } = require('../server/config/database');
const EmailService = require('../server/services/emailService');
const NotificationTemplateService = require('../server/services/notificationTemplateService');
const SystemConfigService = require('../server/services/systemConfigService');

const testRecipient = 'e2e-email-receipt@example.test';
const sampleValues = {
  baseUrl: 'http://localhost:5173',
  companyName: 'McRepair.de',
  customerName: 'E2E Testkunde',
  customerEmail: testRecipient,
  customerPhone: '+49 151 12345678',
  supportEmail: 'support@mcrepair.de',
  supportPhone: '+49 30 12345678',
  orderNumber: 'ORD-E2E-0001',
  bookingNumber: 'BKG-E2E-0001',
  invoiceNumber: 'INV-E2E-0001',
  complaintNumber: 'R-E2E-0001',
  requestNumber: 'REQ-E2E-0001',
  deviceBrand: 'Apple',
  deviceModel: 'iPhone 15',
  orderStatus: 'in-progress',
  bookingStatus: 'processing',
  paymentStatus: 'pending',
  totalAmount: '199,90 EUR',
  amount: '199,90 EUR',
  invoiceTotal: '199,90 EUR',
  statusMessage: 'Ihre Reparatur wird bearbeitet.',
  message: 'Dies ist eine E2E-Testnachricht.',
};

function sampleValue(name) {
  if (Object.prototype.hasOwnProperty.call(sampleValues, name)) return sampleValues[name];
  if (/(url|link)$/i.test(name)) return `/e2e-test/${name}`;
  if (/^(date|.*At|.*Date)$/i.test(name)) return '14.09.2026';
  if (/^(is|has|should|requires)/i.test(name)) return 'true';
  if (/amount|price|cost|total|fee|discount|tax/i.test(name)) return '199,90 EUR';
  return `E2E ${name}`;
}

function templatePlaceholders(text) {
  return [...String(text || '').matchAll(/{{(\w+)}}/g)].map((match) => match[1]);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  process.env.EMAIL_TEST_TRANSPORT = 'stream';
  const databaseUrl = process.env.DATABASE_URL || process.env.MONGODB_URI;
  assert(databaseUrl, 'DATABASE_URL or MONGODB_URI is required');

  await connectDB();
  const config = await SystemConfigService.getSystemConfiguration();
  const templates = await NotificationTemplateService.getAvailableTemplates('email');
  assert(templates.length > 0, 'No active email templates found');

  const templateNames = new Set(templates.map((template) => template.name));
  const triggerEntries = Object.entries(EmailService.TRIGGER_TEMPLATE_MAP);
  const failures = [];
  let receivedCount = 0;

  for (const template of templates) {
    const placeholders = new Set([
      ...templatePlaceholders(template.subject),
      ...templatePlaceholders(template.content),
      ...(template.variables || []).map((variable) => variable.name).filter(Boolean),
    ]);
    const variables = Object.fromEntries([...placeholders].map((name) => [name, sampleValue(name)]));

    try {
      const validation = await NotificationTemplateService.validateTemplateVariables(template.name, 'email', variables);
      assert(validation.isValid, `${template.name}: missing ${validation.missingVariables.join(', ')}`);

      const rendered = await NotificationTemplateService.renderTemplate(template.name, 'email', variables);
      assert(rendered?.subject, `${template.name}: empty subject`);
      assert(rendered?.content, `${template.name}: empty HTML content`);
      assert(rendered?.text, `${template.name}: empty plaintext content`);
      assert(!/{{\w+}}/.test(rendered.content), `${template.name}: unresolved HTML placeholder`);
      assert(!/{{\w+}}/.test(rendered.text), `${template.name}: unresolved plaintext placeholder`);

      const links = [...rendered.content.matchAll(/(?:href|src)="([^"]+)"/gi)].map((match) => match[1]);
      for (const link of links) {
        if (/^mailto:/i.test(link)) {
          assert(/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/i.test(link), `${template.name}: invalid mailto link ${link}`);
          continue;
        }
        assert(/^https?:\/\//i.test(link), `${template.name}: non-absolute email link ${link}`);
        const parsed = new URL(link);
        assert(parsed.host === new URL(config.templateLinkSettings?.mode === 'production'
          ? config.templateLinkSettings.productionBaseUrl
          : config.templateLinkSettings?.localhostBaseUrl || 'http://localhost:5173').host,
        `${template.name}: link host does not match active system URL: ${link}`);
      }

      const receipt = await EmailService.sendTemplateEmail(template.name, testRecipient, variables);
      assert(receipt.success, `${template.name}: receipt failed: ${receipt.error || 'unknown error'}`);
      receivedCount += 1;
    } catch (error) {
      failures.push(error.message);
    }
  }

  for (const [trigger, templateName] of triggerEntries) {
    const fallbackNames = EmailService.TRIGGER_TEMPLATE_FALLBACKS[trigger] || [];
    assert(templateNames.has(templateName) || fallbackNames.some((name) => templateNames.has(name)),
      `Trigger ${trigger} has no active template or fallback`);
  }

  assert(failures.length === 0, failures.join('\n'));
  console.log(`Email template receipt test passed: ${receivedCount}/${templates.length} active templates received.`);
  console.log(`Verified ${triggerEntries.length} trigger mappings and active system link host.`);
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });