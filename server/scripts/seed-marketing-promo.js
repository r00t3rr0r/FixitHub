#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/McRepair.de';

const User = require('../models/User');
const MarketingSegment = require('../models/MarketingSegment');
const PromoCode = require('../models/PromoCode');
const Newsletter = require('../models/Newsletter');
const MarketingSettings = require('../models/MarketingSettings');

async function seedMarketingPromo() {
  const admin = await User.findOne({ role: 'admin' }).select('_id email').lean();
  if (!admin) {
    throw new Error('No admin user found. Please run standard seed first.');
  }

  let settings = await MarketingSettings.findOne();
  if (!settings) {
    settings = await MarketingSettings.create({
      defaultFromName: 'McRepair.de Marketing',
      defaultReplyTo: process.env.SUPPORT_EMAIL || 'support@mcrepair.de',
      trackOpens: true,
      trackClicks: true,
      allowTestSend: true,
      maxSendBatchSize: 200,
      updatedBy: admin._id,
    });
  }

  let segment = await MarketingSegment.findOne({ internalName: 'Newsletter Opt-In Kunden' });
  if (!segment) {
    segment = await MarketingSegment.create({
      internalName: 'Newsletter Opt-In Kunden',
      description: 'Aktive Kunden mit Newsletter Opt-In',
      status: 'active',
      rules: {
        roles: ['customer'],
        statuses: ['active'],
        newsletterOptInOnly: true,
        minTotalOrders: 0,
        minTotalSpent: 0,
      },
      lastPreviewCount: 0,
      createdBy: admin._id,
      updatedBy: admin._id,
    });
  }

  let promoCode = await PromoCode.findOne({ code: 'WELCOME10' });
  if (!promoCode) {
    promoCode = await PromoCode.create({
      internalName: 'Willkommensrabatt',
      code: 'WELCOME10',
      description: '10% Rabatt fuer Newsletter-Kampagnen',
      discountType: 'percentage',
      value: 10,
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      status: 'active',
      rules: {
        minimumOrderValue: 25,
        usageLimitTotal: 10000,
        usageLimitPerCustomer: 1,
        combinable: false,
      },
      createdBy: admin._id,
      updatedBy: admin._id,
    });
  }

  let newsletter = await Newsletter.findOne({ internalName: 'Welcome Promo Newsletter' });
  if (!newsletter) {
    newsletter = await Newsletter.create({
      internalName: 'Welcome Promo Newsletter',
      subject: 'Willkommen bei McRepair.de - 10% Promo fuer dich',
      preheader: 'Sichere dir jetzt deinen Newsletter-Willkommensrabatt.',
      content: '<p>Danke fuer dein Interesse an McRepair.de.</p><p>Mit dem Code <strong>WELCOME10</strong> bekommst du 10% Rabatt.</p>',
      templateName: 'Allgemeine Systemnachricht',
      status: 'draft',
      segmentId: segment._id,
      promoCodeIds: [promoCode._id],
      createdBy: admin._id,
      updatedBy: admin._id,
    });
  }

  return {
    settingsId: String(settings._id),
    segmentId: String(segment._id),
    promoCodeId: String(promoCode._id),
    newsletterId: String(newsletter._id),
  };
}

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(DATABASE_URL);
  console.log('Connected.');

  try {
    const result = await seedMarketingPromo();
    console.log('Marketing/Promo seed completed:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Marketing/Promo seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
