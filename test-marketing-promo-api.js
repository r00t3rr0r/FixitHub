#!/usr/bin/env node

/**
 * Simple smoke test for Marketing/Promo admin API.
 *
 * Required env vars:
 *   API_BASE_URL=http://localhost:3000
 *   ADMIN_BEARER_TOKEN=<jwt>
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_BEARER_TOKEN = process.env.ADMIN_BEARER_TOKEN;

if (!ADMIN_BEARER_TOKEN) {
  console.error('Missing ADMIN_BEARER_TOKEN.');
  process.exit(1);
}

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Authorization: `Bearer ${ADMIN_BEARER_TOKEN}`,
    'Content-Type': 'application/json',
  },
  validateStatus: () => true,
});

async function main() {
  const endpoints = [
    '/api/admin/marketing-promo/overview',
    '/api/admin/marketing-promo/reports',
    '/api/admin/marketing-promo/settings',
    '/api/admin/marketing-promo/newsletters?limit=5',
    '/api/admin/marketing-promo/promo-codes?limit=5',
    '/api/admin/marketing-promo/segments?limit=5',
    '/api/admin/marketing-promo/audit-log?limit=5',
  ];

  let failed = false;

  for (const endpoint of endpoints) {
    const response = await client.get(endpoint);
    const ok = response.status >= 200 && response.status < 300;
    console.log(`${ok ? 'OK' : 'FAIL'} ${response.status} ${endpoint}`);
    if (!ok) {
      failed = true;
      console.log('Response:', JSON.stringify(response.data));
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Smoke test failed:', error.message);
  process.exit(1);
});
