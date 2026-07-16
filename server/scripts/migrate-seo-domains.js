const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { connectDB } = require('../config/database');
const SEOSettings = require('../models/SEOSettings');

const LEGACY_CANONICAL_URL_PREFIX = 'https://fixithub.de';
const CURRENT_CANONICAL_URL_PREFIX = 'https://mcrepair.de';

function normalizeSiteUrl(url) {
  if (typeof url !== 'string') {
    return url;
  }

  const trimmedUrl = url.trim();

  if (!trimmedUrl.startsWith(LEGACY_CANONICAL_URL_PREFIX)) {
    return trimmedUrl;
  }

  return `${CURRENT_CANONICAL_URL_PREFIX}${trimmedUrl.slice(LEGACY_CANONICAL_URL_PREFIX.length)}`;
}

function getNormalizedFields(settings) {
  const canonicalUrl = normalizeSiteUrl(settings.canonicalUrl);
  const openGraphUrl = normalizeSiteUrl(settings.openGraph?.url);

  return {
    canonicalUrl,
    openGraphUrl,
    changed:
      canonicalUrl !== settings.canonicalUrl ||
      openGraphUrl !== settings.openGraph?.url,
  };
}

async function run() {
  const applyChanges = process.argv.includes('--apply');

  console.log('SEO domain migration started');
  console.log('Mode:', applyChanges ? 'apply' : 'dry-run');

  await connectDB();

  try {
    const candidates = await SEOSettings.find({
      $or: [
        { canonicalUrl: { $regex: `^${LEGACY_CANONICAL_URL_PREFIX}` } },
        { 'openGraph.url': { $regex: `^${LEGACY_CANONICAL_URL_PREFIX}` } },
      ],
    });

    if (candidates.length === 0) {
      console.log('No SEO settings with legacy domain URLs found.');
      return;
    }

    console.log(`Found ${candidates.length} SEO setting(s) with legacy URLs.`);

    let updatedDocuments = 0;
    let updatedCanonicalUrls = 0;
    let updatedOpenGraphUrls = 0;

    for (const settings of candidates) {
      const { canonicalUrl, openGraphUrl, changed } = getNormalizedFields(settings);

      if (!changed) {
        continue;
      }

      if (canonicalUrl !== settings.canonicalUrl) {
        updatedCanonicalUrls += 1;
      }

      if (openGraphUrl !== settings.openGraph?.url) {
        updatedOpenGraphUrls += 1;
      }

      console.log(
        `- ${settings.pageType}:${settings.pageId || '<default>'}`,
        `canonicalUrl=${settings.canonicalUrl || '-'} -> ${canonicalUrl || '-'}`,
        `openGraph.url=${settings.openGraph?.url || '-'} -> ${openGraphUrl || '-'}`
      );

      if (!applyChanges) {
        continue;
      }

      settings.canonicalUrl = canonicalUrl;

      if (settings.openGraph) {
        settings.openGraph.url = openGraphUrl;
      } else if (openGraphUrl) {
        settings.openGraph = { url: openGraphUrl };
      }

      await settings.save();
      updatedDocuments += 1;
    }

    console.log('Migration summary:');
    console.log(`- documents matched: ${candidates.length}`);
    console.log(`- canonicalUrl changes: ${updatedCanonicalUrls}`);
    console.log(`- openGraph.url changes: ${updatedOpenGraphUrls}`);

    if (applyChanges) {
      console.log(`- documents updated: ${updatedDocuments}`);
    } else {
      console.log('Dry-run complete. Re-run with --apply to persist the changes.');
    }
  } finally {
    await mongoose.connection.close();
  }
}

run().catch((error) => {
  console.error('SEO domain migration failed:', error);
  process.exit(1);
});