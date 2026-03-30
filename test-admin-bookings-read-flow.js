#!/usr/bin/env node

const API_URL = process.env.API_URL || 'http://localhost:3000';

const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'admin@example.com',
  password: process.env.ADMIN_PASSWORD || 'admin123',
};

const STAFF_CREDENTIALS = {
  email: process.env.STAFF_EMAIL || 'staff@example.com',
  password: process.env.STAFF_PASSWORD || 'password123',
};

const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS || 20000);
const MESSAGE_PREFIX = '[ADMIN-BOOKINGS-READ-FLOW]';

async function apiRequest(method, path, { token = null, body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data?.error || `${method} ${path} failed with ${response.status}`);
      error.response = { status: response.status, data };
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function login(credentials) {
  const data = await apiRequest('POST', '/api/auth/login', { body: credentials });

  const token = data?.token || data?.accessToken;
  const user = data?.user || data;

  if (!token || !user?._id) {
    throw new Error(`Login failed for ${credentials.email}: missing token/user in response`);
  }

  return {
    token,
    user,
  };
}

function extractOrderIdsFromBooking(booking) {
  const ids = (booking?.items || [])
    .map((item) => item?.orderId)
    .filter(Boolean);

  return Array.from(new Set(ids));
}

function getUnreadCountForOrder(unreadCounts, orderId) {
  return Number(unreadCounts?.[orderId]?.unread || 0);
}

async function fetchAdminBookings(adminClient) {
  const data = await apiRequest('GET', '/api/bookings?limit=50&skip=0', { token: adminClient.token });
  return data?.bookings || [];
}

async function fetchUnreadCounts(adminClient, orderIds) {
  const data = await apiRequest('POST', '/api/inspection-communication/unread-counts', {
    token: adminClient.token,
    body: { orderIds },
  });
  return data?.unreadCounts || {};
}

async function markAllAsReadForOrders(adminClient, orderIds) {
  for (const orderId of orderIds) {
    await apiRequest('PUT', `/api/inspection-communication/${orderId}/mark-read`, {
      token: adminClient.token,
      body: {},
    });
  }
}

async function sendStaffMessage(staffClient, orderId, messageText) {
  await apiRequest('POST', `/api/inspection-communication/${orderId}/message`, {
    token: staffClient.token,
    body: { content: messageText },
  });
}

async function run() {
  console.log('='.repeat(72));
  console.log('Admin Bookings Read Flow Integration Test');
  console.log('='.repeat(72));
  console.log(`API_URL: ${API_URL}`);

  try {
    console.log('\n1) Login as admin and staff');
    const adminSession = await login(ADMIN_CREDENTIALS);
    const staffSession = await login(STAFF_CREDENTIALS);

    const adminClient = { token: adminSession.token };
    const staffClient = { token: staffSession.token };

    console.log(`   Admin: ${adminSession.user.email} (${adminSession.user.role})`);
    console.log(`   Staff: ${staffSession.user.email} (${staffSession.user.role})`);

    console.log('\n2) Select a booking with at least one order');
    const bookings = await fetchAdminBookings(adminClient);
    const bookingWithOrders = bookings.find((booking) => extractOrderIdsFromBooking(booking).length > 0);

    if (!bookingWithOrders) {
      throw new Error('No booking with orderIds found. Seed data or create a booking first.');
    }

    const bookingOrderIds = extractOrderIdsFromBooking(bookingWithOrders);
    const targetOrderId = bookingOrderIds[0];

    console.log(`   Booking: ${bookingWithOrders.bookingNumber || bookingWithOrders._id}`);
    console.log(`   Target order: ${targetOrderId}`);

    console.log('\n3) Ensure clean baseline (mark existing messages as read for admin)');
    await markAllAsReadForOrders(adminClient, bookingOrderIds);

    const baselineUnread = await fetchUnreadCounts(adminClient, bookingOrderIds);
    const baselineCount = getUnreadCountForOrder(baselineUnread, targetOrderId);
    console.log(`   Baseline unread for target order: ${baselineCount}`);

    console.log('\n4) Staff posts a new message (becomes unread for admin)');
    const messageText = `${MESSAGE_PREFIX} ${new Date().toISOString()}`;
    await sendStaffMessage(staffClient, targetOrderId, messageText);
    console.log('   Message sent');

    console.log('\n5) Verify unread appears for admin (like badge on admin bookings page)');
    const unreadAfterMessage = await fetchUnreadCounts(adminClient, bookingOrderIds);
    const unreadCountAfterMessage = getUnreadCountForOrder(unreadAfterMessage, targetOrderId);
    console.log(`   Unread after message: ${unreadCountAfterMessage}`);

    if (unreadCountAfterMessage <= baselineCount) {
      throw new Error(
        `Expected unread count to increase above baseline (${baselineCount}) after staff message, got ${unreadCountAfterMessage}.`
      );
    }

    console.log('\n6) Simulate admin viewing flow by marking as read');
    await apiRequest('PUT', `/api/inspection-communication/${targetOrderId}/mark-read`, {
      token: adminClient.token,
      body: {},
    });
    console.log('   mark-read executed');

    console.log('\n7) Verify unread is cleared');
    const unreadAfterMarkRead = await fetchUnreadCounts(adminClient, bookingOrderIds);
    const unreadCountAfterMarkRead = getUnreadCountForOrder(unreadAfterMarkRead, targetOrderId);
    console.log(`   Unread after mark-read: ${unreadCountAfterMarkRead}`);

    if (unreadCountAfterMarkRead > baselineCount) {
      throw new Error(
        `Expected unread count to return to baseline (${baselineCount}) after mark-read, but got ${unreadCountAfterMarkRead}.`
      );
    }

    console.log('\n✅ PASS: Admin bookings read-flow works end-to-end.');
    console.log('   New message becomes unread and is cleared after view/mark-read.');
    process.exit(0);
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || String(error);
    console.error('\n❌ FAIL:', message);
    process.exit(1);
  }
}

run();
