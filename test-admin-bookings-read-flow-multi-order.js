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
const MESSAGE_PREFIX = '[ADMIN-BOOKINGS-MULTI-ORDER-READ-FLOW]';

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

  return { token, user };
}

function extractOrderIdsFromBooking(booking) {
  const ids = (booking?.items || [])
    .map((item) => item?.orderId)
    .filter(Boolean);

  return Array.from(new Set(ids));
}

function getUnreadCount(unreadCounts, orderId) {
  return Number(unreadCounts?.[orderId]?.unread || 0);
}

async function fetchAdminBookings(token) {
  const data = await apiRequest('GET', '/api/bookings?limit=100&skip=0', { token });
  return data?.bookings || [];
}

async function fetchUnreadCounts(token, orderIds) {
  const data = await apiRequest('POST', '/api/inspection-communication/unread-counts', {
    token,
    body: { orderIds },
  });

  return data?.unreadCounts || {};
}

async function markReadForOrder(token, orderId) {
  try {
    await apiRequest('PUT', `/api/inspection-communication/${orderId}/mark-read`, {
      token,
      body: {},
    });
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || '';
    if (String(message).toLowerCase().includes('communication thread not found')) {
      return;
    }
    throw error;
  }
}

async function markReadForOrders(token, orderIds) {
  for (const orderId of orderIds) {
    await markReadForOrder(token, orderId);
  }
}

async function sendStaffMessage(token, orderId, text) {
  await apiRequest('POST', `/api/inspection-communication/${orderId}/message`, {
    token,
    body: { content: text },
  });
}

async function run() {
  console.log('='.repeat(80));
  console.log('Admin Bookings Multi-Order Read Flow Integration Test');
  console.log('='.repeat(80));
  console.log(`API_URL: ${API_URL}`);

  try {
    console.log('\n1) Login as admin and staff');
    const admin = await login(ADMIN_CREDENTIALS);
    const staff = await login(STAFF_CREDENTIALS);

    console.log(`   Admin: ${admin.user.email} (${admin.user.role})`);
    console.log(`   Staff: ${staff.user.email} (${staff.user.role})`);

    console.log('\n2) Find booking with at least 2 orders');
    const bookings = await fetchAdminBookings(admin.token);
    const booking = bookings.find((b) => extractOrderIdsFromBooking(b).length >= 2);

    if (!booking) {
      throw new Error('No booking with at least 2 orders found. Seed data with multi-order booking first.');
    }

    const bookingOrderIds = extractOrderIdsFromBooking(booking);
    const targetOrderIds = bookingOrderIds.slice(0, 2);

    console.log(`   Booking: ${booking.bookingNumber || booking._id}`);
    console.log(`   Booking orders: ${bookingOrderIds.length}`);
    console.log(`   Targets: ${targetOrderIds.join(', ')}`);

    console.log('\n3) Establish baseline (mark all booking orders read for admin)');
    await markReadForOrders(admin.token, bookingOrderIds);

    const baselineUnread = await fetchUnreadCounts(admin.token, bookingOrderIds);
    const baselineMap = Object.fromEntries(
      targetOrderIds.map((id) => [id, getUnreadCount(baselineUnread, id)])
    );

    targetOrderIds.forEach((id) => {
      console.log(`   Baseline unread for ${id}: ${baselineMap[id]}`);
    });

    console.log('\n4) Staff posts one new message on each target order');
    for (const orderId of targetOrderIds) {
      const content = `${MESSAGE_PREFIX} ${orderId} ${new Date().toISOString()}`;
      await sendStaffMessage(staff.token, orderId, content);
      console.log(`   Message sent for order ${orderId}`);
    }

    console.log('\n5) Verify unread increased on both orders');
    const unreadAfterMessages = await fetchUnreadCounts(admin.token, bookingOrderIds);

    for (const orderId of targetOrderIds) {
      const unreadNow = getUnreadCount(unreadAfterMessages, orderId);
      console.log(`   Unread after message for ${orderId}: ${unreadNow}`);

      if (unreadNow <= baselineMap[orderId]) {
        throw new Error(
          `Unread did not increase for order ${orderId}. Baseline=${baselineMap[orderId]}, current=${unreadNow}`
        );
      }
    }

    console.log('\n6) Simulate booking-level viewing: mark all booking orders as read');
    await markReadForOrders(admin.token, bookingOrderIds);

    console.log('\n7) Verify both target orders returned to baseline');
    const unreadAfterRead = await fetchUnreadCounts(admin.token, bookingOrderIds);

    for (const orderId of targetOrderIds) {
      const unreadNow = getUnreadCount(unreadAfterRead, orderId);
      console.log(`   Unread after read for ${orderId}: ${unreadNow}`);

      if (unreadNow > baselineMap[orderId]) {
        throw new Error(
          `Unread did not return to baseline for order ${orderId}. Baseline=${baselineMap[orderId]}, current=${unreadNow}`
        );
      }
    }

    console.log('\n✅ PASS: Multi-order booking read-flow works end-to-end.');
    process.exit(0);
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || String(error);
    console.error('\n❌ FAIL:', message);
    process.exit(1);
  }
}

run();
