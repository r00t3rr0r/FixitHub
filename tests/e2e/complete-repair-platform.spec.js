const { test, expect, request: playwrightRequest } = require('@playwright/test');

const apiBaseUrl = process.env.E2E_API_URL || 'http://localhost:3000';
const webBaseUrl = process.env.E2E_WEB_URL || 'http://localhost:5173';
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'admin123';
const customerEmail = process.env.E2E_CUSTOMER_EMAIL || 'customer@example.com';
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD || 'password123';
let contextSequence = 0;
let loginIpSequence = 0;

const address = {
  street: 'E2E Teststrasse 1',
  city: 'Berlin',
  zipCode: '10115',
  country: 'DE',
};

function id(value) {
  return String(value?._id || value?.id || value);
}

async function request(context, method, path, body, token, extraHeaders = {}) {
  const csrfToken = (await context.storageState()).cookies.find((cookie) => cookie.name === 'csrf_token')?.value;
  const response = await context.fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    data: body,
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function expectSuccess(result, expectedStatus) {
  if (expectedStatus) expect(result.response.status(), JSON.stringify(result.payload)).toBe(expectedStatus);
  else expect(result.response.ok(), JSON.stringify(result.payload)).toBeTruthy();
  expect(result.payload.success ?? true, JSON.stringify(result.payload)).toBeTruthy();
  return result.payload;
}

async function login(context, email, password) {
  loginIpSequence += 1;
  const result = await request(context, 'POST', '/api/auth/login', { email, password }, undefined, {
    'x-forwarded-for': `10.253.0.${loginIpSequence}`,
  });
  await expectSuccess(result);
  return { token: result.payload.accessToken || result.payload.token, user: result.payload.user || result.payload };
}

function newApiContext() {
  contextSequence += 1;
  return playwrightRequest.newContext({
    baseURL: apiBaseUrl,
    extraHTTPHeaders: { 'x-forwarded-for': `10.254.0.${contextSequence}` },
  });
}

test.describe('Complete repair platform E2E workflow', () => {
  test('registers, activates and logs in a new customer', async () => {
    test.setTimeout(30000);

    const adminContext = await newApiContext();
    const publicContext = await newApiContext();
    const registrationEmail = `e2e-registration-${Date.now()}@example.test`;

    try {
      const registration = await expectSuccess(await request(publicContext, 'POST', '/api/auth/register', {
        email: registrationEmail,
        password: 'E2eRegistration!123',
        firstName: 'E2E',
        lastName: 'Registration',
        phone: '+4915112345678',
      }));
      expect(registration.user?._id).toBeTruthy();
      expect(registration.message).toContain('registered');

      const admin = await login(adminContext, adminEmail, adminPassword);
      const activated = await expectSuccess(await request(adminContext, 'PUT', `/api/admin/users/${id(registration.user)}`, {
        status: 'active',
        isActive: true,
      }, admin.token));
      expect(activated.user?.isActive).toBe(true);

      const registeredCustomer = await login(publicContext, registrationEmail, 'E2eRegistration!123');
      expect(registeredCustomer.user.email).toBe(registrationEmail);
    } finally {
      await adminContext.dispose();
      await publicContext.dispose();
    }
  });

  test('creates multiple devices with complete lock and repair information', async () => {
    test.setTimeout(90000);

    const adminContext = await newApiContext();
    const customerContext = await newApiContext();
    const publicContext = await newApiContext();

    try {
      const admin = await login(adminContext, adminEmail, adminPassword);
      const customer = await login(customerContext, customerEmail, customerPassword);
      const serviceList = await expectSuccess(await request(publicContext, 'GET', '/api/services?limit=20'));
      expect(serviceList.services?.length).toBeGreaterThanOrEqual(2);

      const services = serviceList.services.slice(0, 2).map((service) => ({
        serviceId: id(service),
        name: service.name || 'E2E Reparaturservice',
        price: Number(service.price || 99),
        estimatedTime: Number(service.estimatedTime || 60),
      }));
      const repairOrders = [
        {
          deviceBrand: 'Apple', deviceModel: 'iPhone 14', deviceType: 'Smartphone', services: [services[0]],
          totalCost: services[0].price, customerNotes: 'Kunde benoetigt das Geraet beruflich.',
          unlockPattern: ['1', '2', '5', '8'], unlockCode: '', noLock: false,
          errorDescription: 'Display reagiert nur sporadisch und zeigt gruenes Flackern.',
          waterDamage: 'no', previousRepairAttempts: 'yes', previousRepairDetails: 'Display wurde bereits einmal extern geoeffnet.',
          itemCondition: 'original', imei: '356789012345678', serialNumber: 'E2E-IP14-001',
        },
        {
          deviceBrand: 'Samsung', deviceModel: 'Galaxy S23', deviceType: 'Smartphone', services: [services[1]],
          totalCost: services[1].price, customerNotes: 'Bitte vor Reparatur telefonisch bestaetigen.',
          unlockPattern: [], unlockCode: '2580', noLock: false,
          errorDescription: 'Akku entlaedt sich innerhalb weniger Stunden.',
          waterDamage: 'dont-know', previousRepairAttempts: 'no', previousRepairDetails: '',
          itemCondition: 'refurbished', imei: '357890123456789', serialNumber: 'E2E-S23-002',
        },
        {
          deviceBrand: 'Google', deviceModel: 'Pixel 8', deviceType: 'Smartphone', services: [services[0], services[1]],
          totalCost: services[0].price + services[1].price, customerNotes: 'Datenschutz: keine Fotos behalten.',
          unlockPattern: [], unlockCode: '', noLock: true,
          errorDescription: 'Kamera fokussiert nicht mehr und produziert unscharfe Bilder.',
          waterDamage: 'no', previousRepairAttempts: 'dont-know', previousRepairDetails: 'Keine verlaesslichen Angaben vorhanden.',
          itemCondition: 'original', imei: '358901234567890', serialNumber: 'E2E-PIX8-003',
        },
      ];

      const createdOrders = [];
      for (const repairOrder of repairOrders) {
        const created = await expectSuccess(await request(customerContext, 'POST', '/api/orders', {
          ...repairOrder,
          shippingAddress: address,
        }, customer.token), 201);
        createdOrders.push({ id: id(created.orderId || created), orderNumber: created.orderNumber });
      }
      expect(new Set(createdOrders.map((order) => order.id)).size).toBe(3);

      const firstDetails = await expectSuccess(await request(customerContext, 'GET', `/api/orders/${createdOrders[0].id}`, undefined, customer.token));
      expect(firstDetails.order.guestInfo?.isGuest).toBe(false);
      expect(firstDetails.order.errorDescription).toContain('Display');
      expect(firstDetails.order.unlockPattern).toEqual(['1', '2', '5', '8']);
      expect(firstDetails.order.serialNumber).toBe('E2E-IP14-001');

      const booking = await expectSuccess(await request(adminContext, 'POST', '/api/bookings/group', {
        orderIds: createdOrders.map((order) => order.id),
        customerId: id(customer.user),
      }, admin.token));
      expect(booking.bookingId).toBeTruthy();
      const groupedBooking = await expectSuccess(await request(adminContext, 'GET', `/api/bookings/${booking.bookingId}`, undefined, admin.token));
      expect(groupedBooking.booking.orderIds).toHaveLength(3);
      await expectSuccess(await request(customerContext, 'GET', `/api/bookings/${booking.bookingId}/orders`, undefined, customer.token));
    } finally {
      await adminContext.dispose();
      await customerContext.dispose();
      await publicContext.dispose();
    }
  });

  test('runs different repair lifecycles through the admin order detail actions', async () => {
    test.setTimeout(120000);

    const adminContext = await newApiContext();
    const customerContext = await newApiContext();
    const publicContext = await newApiContext();

    try {
      const admin = await login(adminContext, adminEmail, adminPassword);
      const customer = await login(customerContext, customerEmail, customerPassword);
      const serviceList = await expectSuccess(await request(publicContext, 'GET', '/api/services?limit=1'));
      const service = serviceList.services?.[0];
      expect(service?._id).toBeTruthy();
      const repairService = {
        serviceId: id(service), name: service.name || 'E2E Service',
        price: Number(service.price || 99), estimatedTime: Number(service.estimatedTime || 60),
      };
      const createOrder = async (deviceModel, extra = {}) => {
        const result = await expectSuccess(await request(customerContext, 'POST', '/api/orders', {
          deviceBrand: 'Apple', deviceModel, deviceType: 'Smartphone', services: [repairService],
          totalCost: repairService.price, shippingAddress: address,
          unlockCode: '1234', noLock: false,
          errorDescription: `${deviceModel} weist einen reproduzierbaren Fehler auf.`,
          waterDamage: 'no', previousRepairAttempts: 'no', previousRepairDetails: '',
          itemCondition: 'original', imei: `359${Date.now()}${deviceModel.length}`, serialNumber: `E2E-${deviceModel}`,
          customerNotes: 'Admin detail workflow test', ...extra,
        }, customer.token), 201);
        return id(result.orderId || result);
      };

      const standardOrderId = await createOrder('iPhone 15');
      const pausedOrderId = await createOrder('iPhone 13');
      const cancelledOrderId = await createOrder('iPhone SE');

      for (const orderId of [standardOrderId, pausedOrderId, cancelledOrderId]) {
        const details = await expectSuccess(await request(adminContext, 'GET', `/api/admin/orders/${orderId}`, undefined, admin.token));
        expect(id(details.order)).toBe(orderId);
      }

      await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${standardOrderId}/assign`, {
        staffIds: [id(admin.user)],
      }, admin.token));
      await expectSuccess(await request(adminContext, 'POST', `/api/admin/orders/${standardOrderId}/notes`, {
        note: 'E2E: Eingang geprueft und Reparatur freigegeben.', type: 'technical',
      }, admin.token), 201);
      const addon = await expectSuccess(await request(adminContext, 'POST', `/api/admin/orders/${standardOrderId}/addons`, {
        name: 'Express-Diagnose', description: 'Priorisierte Diagnose', price: 29, estimatedTime: '60', status: 'pending',
      }, admin.token));
      const addonId = id(addon.order?.addOns?.at(-1));
      expect(addonId).toBeTruthy();
      await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${standardOrderId}/addons/${addonId}`, {
        status: 'in-progress', progress: 50,
      }, admin.token));
      await expectSuccess(await request(adminContext, 'DELETE', `/api/admin/orders/${standardOrderId}/addons/${addonId}`, undefined, admin.token));

      await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${standardOrderId}/device`, {
        deviceBrand: 'Apple', deviceModel: 'iPhone 15 Pro', deviceType: 'Smartphone',
      }, admin.token));
      await expectSuccess(await request(adminContext, 'POST', `/api/admin/orders/${standardOrderId}/confirm-unlock`, {
        confirmationStatus: 'verified', notes: 'E2E PIN erfolgreich geprueft.',
      }, admin.token));

      for (const status of ['in-progress', 'quality-check', 'ready-for-pickup']) {
        await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${standardOrderId}/status`, {
          status, note: `E2E Status ${status}`,
        }, admin.token));
      }
      const pickup = await expectSuccess(await request(adminContext, 'POST', `/api/admin/orders/${standardOrderId}/confirm-pickup`, {}, admin.token));
      expect(pickup.order.pickupConfirmation?.confirmedAt).toBeTruthy();

      await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${pausedOrderId}/status`, { status: 'paused', note: 'Warte auf neue Entsperrinformation.' }, admin.token));
      await expectSuccess(await request(adminContext, 'POST', `/api/admin/orders/${pausedOrderId}/request-unlock-update`, {
        notes: 'Bitte bestaetigen Sie den Entsperrcode erneut.',
      }, admin.token));
      await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${pausedOrderId}/status`, { status: 'in-progress' }, admin.token));
      await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${pausedOrderId}/status`, { status: 'completed' }, admin.token));

      await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${cancelledOrderId}/status`, { status: 'cancelled', note: 'E2E Stornoablauf' }, admin.token));
      const finalStandard = await expectSuccess(await request(adminContext, 'GET', `/api/admin/orders/${standardOrderId}`, undefined, admin.token));
      expect(finalStandard.order.status).toBe('completed');
      expect(finalStandard.order.deviceModel).toBe('iPhone 15 Pro');
    } finally {
      await adminContext.dispose();
      await customerContext.dispose();
      await publicContext.dispose();
    }
  });

  test('runs device inspection, electronic parts and repair workflow operations', async () => {
    test.setTimeout(120000);

    const adminContext = await newApiContext();
    const customerContext = await newApiContext();
    const publicContext = await newApiContext();

    try {
      const admin = await login(adminContext, adminEmail, adminPassword);
      const customer = await login(customerContext, customerEmail, customerPassword);
      const serviceList = await expectSuccess(await request(publicContext, 'GET', '/api/services?limit=1'));
      const service = serviceList.services?.[0];
      expect(service?._id).toBeTruthy();
      const repairService = {
        serviceId: id(service), name: service.name || 'Inspection Service',
        price: Number(service.price || 129), estimatedTime: Number(service.estimatedTime || 60),
      };

      const createdOrder = await expectSuccess(await request(customerContext, 'POST', '/api/orders', {
        deviceBrand: 'Apple', deviceModel: 'iPhone 15', deviceType: 'Smartphone', services: [repairService],
        totalCost: repairService.price, shippingAddress: address,
        unlockPattern: [], unlockCode: '2468', noLock: false,
        errorDescription: 'Device inspection E2E: camera and charging must be checked.',
        waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original',
        imei: '351234567890123', serialNumber: 'E2E-INSPECTION-001', customerNotes: 'Inspection workflow test',
      }, customer.token), 201);
      const orderId = id(createdOrder.orderId || createdOrder);

      const initialized = await expectSuccess(await request(adminContext, 'POST', '/api/device-inspections/init', {
        orderId, customerId: id(customer.user),
      }, admin.token));
      const inspectionId = id(initialized.inspection);
      expect(inspectionId).toBeTruthy();

      await expectSuccess(await request(adminContext, 'PUT', `/api/device-inspections/${orderId}/model-verification`, {
        reportedModel: 'iPhone 15', actualModel: 'iPhone 15', verificationStatus: 'correct', costDifference: 0,
        notes: 'Modell anhand Gehaeuse und Seriennummer bestaetigt.',
      }, admin.token));
      await expectSuccess(await request(adminContext, 'PUT', `/api/device-inspections/${orderId}/identification`, {
        deviceType: 'Smartphone', imei: '351234567890123', serialNumber: 'E2E-INSPECTION-001',
      }, admin.token));
      await expectSuccess(await request(adminContext, 'PUT', `/api/device-inspections/${orderId}/accessories`, {
        originalPackaging: { present: true, description: 'Originalkarton vorhanden' },
        caseCover: { present: true, description: 'Schutzhulle vorhanden' },
        powerAdapter: { present: false, description: 'Nicht mitgeliefert' },
        simTray: { present: true, description: 'SIM-Schlitten vorhanden' },
        cables: { present: true, description: 'USB-C Kabel vorhanden' },
        otherAccessories: [{ name: 'Karton', present: true, description: 'Original' }],
        additionalAccessoriesText: 'Keine weiteren Zubehoerteile.',
      }, admin.token));
      await expectSuccess(await request(adminContext, 'PUT', `/api/device-inspections/${orderId}/external-inspection`, {
        display: { status: 'light-wear', notes: 'Leichte Gebrauchsspuren' },
        frame: { status: 'OK', notes: 'Rahmen intakt' },
        backCover: { status: 'OK', notes: 'Rueckseite intakt' },
        buttons: { status: 'working', notes: 'Alle Tasten funktionieren' },
        visibleDamages: { hasDamage: false, description: '' }, uniqueNotes: 'E2E Sichtpruefung', photos: [],
      }, admin.token));
      const deviceTests = {
        charging: { status: 'OK', current: '1.8A', notes: 'Laedt normal' },
        power: { status: 'OK', notes: 'Startet ohne Fehler' },
        wifi: { status: 'OK', notes: 'WLAN verbunden' },
        frontCamera: { status: 'OK', notes: 'Frontkamera klar' },
        mainCamera: { status: 'Not OK', notes: 'Autofokus pruefen' },
        buttons: { status: 'working', notes: 'Tasten getestet' },
        notes: 'Hauptkamera benoetigt weitere Diagnose.',
      };
      const testResult = await expectSuccess(await request(adminContext, 'PUT', `/api/device-inspections/${orderId}/device-tests`, deviceTests, admin.token));
      expect(testResult.hasFailedTests).toBe(true);
      await expectSuccess(await request(adminContext, 'PUT', `/api/device-inspections/${orderId}/apple-specific`, {
        modemFirmware: { status: 'working', present: true, notes: 'Firmware aktuell' },
        touchIdFaceId: { status: 'working', applicable: true, working: true, notes: 'Face ID funktioniert' },
      }, admin.token));
      const completedInspection = await expectSuccess(await request(adminContext, 'PUT', `/api/device-inspections/${orderId}/complete`, {
        isRepairable: true,
        repairOffer: { amount: repairService.price, currency: 'EUR', description: 'Kamera-Autofokus reparieren' },
        completionAction: 'repairable',
        customerInformation: 'Diagnose abgeschlossen, Reparaturangebot folgt.',
      }, admin.token));
      expect(completedInspection.inspection.status).toBe('completed');
      const inspectionRead = await expectSuccess(await request(adminContext, 'GET', `/api/device-inspections/${orderId}`, undefined, admin.token));
      expect(id(inspectionRead.inspection)).toBe(inspectionId);
      await expectSuccess(await request(adminContext, 'GET', `/api/device-inspections/${orderId}/report`, undefined, admin.token));

      const inventory = await expectSuccess(await request(adminContext, 'POST', '/api/inventory', {
        itemName: `E2E Camera Part ${Date.now()}`, itemDescription: 'Test-Ersatzteil fuer Device Inspection',
        category: 'camera', sku: `E2E-CAM-${Date.now()}`, manufacturer: 'E2E Parts', brand: 'Apple', model: 'iPhone 15',
        compatibleDevices: ['iPhone 15'], versions: [{
          versionType: 'original', versionId: `E2E-V-${Date.now()}`, quantity: 10, minStockLevel: 2,
          reorderLevel: 4, unitCost: 25, sellingPrice: 49, storageLocation: 'E2E-A-01',
          supplierInfo: { name: 'E2E Supplier', contactPerson: 'Test', email: 'parts@example.test' },
        }],
      }, admin.token), 201);
      const partId = id(inventory.item);
      const versionId = id(inventory.item.versions?.[0]);
      expect(partId).toBeTruthy();
      expect(versionId).toBeTruthy();
      const assignedPart = await expectSuccess(await request(adminContext, 'POST', `/api/admin/orders/${orderId}/eparts`, {
        partId, versionId, quantity: 1,
      }, admin.token));
      const ePartId = id(assignedPart.order?.eParts?.at(-1));
      expect(ePartId).toBeTruthy();
      await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${orderId}/eparts/${ePartId}/status`, {
        status: 'allocated',
      }, admin.token));
      await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${orderId}/eparts/${ePartId}/status`, {
        status: 'used',
      }, admin.token));

      const needList = await expectSuccess(await request(adminContext, 'POST', '/api/need-lists', {
        name: `E2E Need List ${Date.now()}`, description: 'Fehlende Teile fuer Inspection Workflow',
        items: [{ part: partId, quantity: 1, notes: 'Fuer Hauptkamera' }], priority: 'high', tags: ['e2e', 'inspection'],
      }, admin.token));
      const needListId = id(needList.needList);
      expect(needListId).toBeTruthy();
      await expectSuccess(await request(adminContext, 'POST', `/api/admin/orders/${orderId}/eparts/need-list`, {
        partId, quantity: 1, needListId, needListName: needList.needList.name,
        needListStatus: 'draft', targetType: 'new', notes: 'E2E Teil nachbestellen',
      }, admin.token));
      await expectSuccess(await request(adminContext, 'GET', '/api/need-lists/statistics', undefined, admin.token));
      await expectSuccess(await request(adminContext, 'PUT', `/api/need-lists/${needListId}`, {
        status: 'ready', priority: 'high',
      }, admin.token));
      await expectSuccess(await request(adminContext, 'DELETE', `/api/admin/orders/${orderId}/eparts/${ePartId}`, undefined, admin.token));

      const initializedWorkflow = await expectSuccess(await request(adminContext, 'POST', `/api/repair-workflows/${orderId}/init`, {
        customerId: id(customer.user), inspectionId,
      }, admin.token));
      expect(initializedWorkflow.workflow).toBeTruthy();
      await expectSuccess(await request(adminContext, 'POST', `/api/repair-workflows/${orderId}/approve`, {
        internalNotes: 'E2E Diagnose freigegeben', orderChanges: {}, notifyCustomer: false,
      }, admin.token));
      await expectSuccess(await request(adminContext, 'POST', `/api/repair-workflows/${orderId}/pause`, {
        pauseReason: 'E2E Ersatzteilpruefung',
      }, admin.token));
      await expectSuccess(await request(adminContext, 'POST', `/api/repair-workflows/${orderId}/resume`, {}, admin.token));
      await expectSuccess(await request(adminContext, 'POST', `/api/repair-workflows/${orderId}/incidents`, {
        incidentType: 'spare_part_needed', reason: 'E2E Incident zur Ablaufpruefung', additionalData: { severity: 'low' },
      }, admin.token));
      await expectSuccess(await request(adminContext, 'GET', `/api/repair-workflows/${orderId}`, undefined, admin.token));
      await expectSuccess(await request(adminContext, 'GET', '/api/repair-workflows/admin/inactive', undefined, admin.token));
      const completedWorkflow = await expectSuccess(await request(adminContext, 'POST', `/api/repair-workflows/${orderId}/complete`, {}, admin.token));
      expect(completedWorkflow.workflow).toBeTruthy();
    } finally {
      await adminContext.dispose();
      await customerContext.dispose();
      await publicContext.dispose();
    }
  });

  test('completes all seven device inspection steps through the admin UI', async ({ page }) => {
    test.setTimeout(120000);

    const adminContext = await newApiContext();
    const customerContext = await newApiContext();

    try {
      const admin = await login(adminContext, adminEmail, adminPassword);
      const customer = await login(customerContext, customerEmail, customerPassword);
      const serviceList = await expectSuccess(await request(customerContext, 'GET', '/api/services?limit=1', undefined, customer.token));
      const service = serviceList.services?.[0];
      expect(service?._id).toBeTruthy();

      const created = await expectSuccess(await request(customerContext, 'POST', '/api/orders', {
        deviceBrand: 'Samsung', deviceModel: 'Galaxy S23', deviceType: 'Smartphone',
        services: [{
          serviceId: id(service), name: service.name || 'Display-Reparatur',
          price: Number(service.price || 169.9), estimatedTime: Number(service.estimatedTime || 60),
        }],
        totalCost: Number(service.price || 169.9), shippingAddress: address,
        unlockCode: '1357', noLock: false, errorDescription: 'UI Device Inspection E2E',
        waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original',
        imei: '352345678901234', serialNumber: 'E2E-UI-INSPECTION',
      }, customer.token), 201);
      const orderId = id(created.orderId || created);

      await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.255.0.${Date.now() % 200}` });
      await page.goto(`${webBaseUrl}/login`);
      await page.locator('#email').fill(adminEmail);
      await page.locator('#password').fill(adminPassword);
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL(/\/admin(\/|$)/, { timeout: 15000 });
      await page.goto(`${webBaseUrl}/orders/${orderId}`);
      await expect(page.getByRole('heading', { name: new RegExp(`Order #${created.orderNumber || 'ORD-'}`) })).toBeVisible({ timeout: 20000 });
      await expect(page.getByText('Geräteinspektion', { exact: true }).first()).toBeVisible({ timeout: 20000 });
      await page.getByRole('button', { name: /Geräteinspektion starten|Geräteinspektion beginnen|Start Device Inspection/i }).click();

      const dialog = page.getByRole('dialog');
      const stepCard = (title) => dialog.locator('.inspection-step-card').filter({ hasText: title });
      const openStep = async (title, fieldSelector) => {
        const field = dialog.locator(fieldSelector);
        if (!(await field.isVisible())) {
          await dialog.getByText(title, { exact: true }).click();
        }
        await expect(field).toBeVisible();
      };
      await expect(dialog).toContainText('Modellprüfung');
      await dialog.locator('#model-notes').fill('UI Schritt 1 geprüft');
      await stepCard('Modellprüfung').locator('button.inspection-primary-button').click();

      await openStep('Geräteidentifikation', '#imei');
      await dialog.locator('#imei').fill('352345678901234');
      await stepCard('Geräteidentifikation').locator('button.inspection-primary-button').click();

      await openStep('Zubehör & Verpackung', '#packaging');
      await dialog.locator('#packaging').click();
      await dialog.locator('#case').click();
      await dialog.locator('#adapter').click();
      await dialog.locator('#sim-tray').click();
      await page.getByRole('option', { name: 'Ja' }).click();
      await dialog.locator('#additional-accessories').fill('USB-C Kabel');
      await dialog.locator('#accessories-notes').fill('Zubehör vollständig erfasst');
      await stepCard('Zubehör & Verpackung').locator('button.inspection-primary-button').click();

      await openStep('Äußere Inspektion', '#external-notes');
      await dialog.locator('#external-notes').fill('Keine weiteren sichtbaren Auffälligkeiten');
      const externalSaveResponse = page.waitForResponse((response) => response.url().includes(`/api/device-inspections/${orderId}/external-inspection`));
      await stepCard('Äußere Inspektion').locator('button.inspection-primary-button').click();
      expect((await externalSaveResponse).status()).toBe(200);
      const externalInspectionSaved = await expectSuccess(await request(customerContext, 'GET', `/api/device-inspections/${orderId}`, undefined, customer.token));
      expect(externalInspectionSaved.inspection.externalInspection).toBeTruthy();

      await openStep('Gerätetests', '#charging-current');
      await dialog.locator('#charging-current').fill('1.8A');
      await dialog.locator('#device-test-notes').fill('Alle Funktionstests durchgeführt');
      await stepCard('Gerätetests').locator('button.inspection-primary-button').click();

      await openStep('Apple-spezifische Prüfungen', '#modem-status');
      await stepCard('Apple-spezifische Prüfungen').locator('button.inspection-primary-button').click();

      await openStep('Abschluss & Zusammenfassung', '#repair-timeframe');
      await dialog.locator('#repair-timeframe').fill('3-5 Werktage');
      await dialog.locator('#repair-description').fill('Display und Funktion werden abschließend repariert.');
      await dialog.getByRole('button', { name: /Inspektion abschließen/ }).click();
      await expect(dialog).toBeHidden({ timeout: 15000 });

      await expect(page.getByText('Inspektionsbericht', { exact: true })).toBeVisible({ timeout: 20000 });
      await expect(page.getByText('352345678901234', { exact: true })).toBeVisible();
      await expect(page.getByText('Tests fehlgeschlagen', { exact: true })).not.toBeVisible();

      const inspection = await expectSuccess(await request(customerContext, 'GET', `/api/device-inspections/${orderId}`, undefined, customer.token));
      expect(inspection.inspection.status).toBe('completed');
      expect(inspection.inspection.identification.imei).toBe('352345678901234');
      expect(inspection.inspection.accessories.originalPackaging.present).toBe(true);
      expect(inspection.inspection.externalInspection).toBeTruthy();
      expect(inspection.inspection.deviceTest).toBeTruthy();
    } finally {
      await adminContext.dispose();
      await customerContext.dispose();
    }
  });

  test('completes booking lifecycle in admin UI and verifies customer progress, invoice and payment', async ({ page }) => {
    test.setTimeout(120000);

    const adminContext = await newApiContext();
    const customerContext = await newApiContext();

    try {
      const admin = await login(adminContext, adminEmail, adminPassword);
      const customer = await login(customerContext, customerEmail, customerPassword);
      const serviceList = await expectSuccess(await request(customerContext, 'GET', '/api/services?limit=1', undefined, customer.token));
      const service = serviceList.services?.[0];
      expect(service?._id).toBeTruthy();
      const price = Number(service.price || 129);
      const created = await expectSuccess(await request(customerContext, 'POST', '/api/orders', {
        deviceBrand: 'Apple', deviceModel: 'iPhone 14', deviceType: 'Smartphone',
        services: [{ serviceId: id(service), name: service.name || 'Reparatur', price, estimatedTime: Number(service.estimatedTime || 60) }],
        totalCost: price, shippingAddress: address, unlockCode: '2468', noLock: false,
        errorDescription: 'Durchgängiger Buchungsablauf im Browser-E2E-Test.',
        waterDamage: 'no', previousRepairAttempts: 'no', itemCondition: 'original',
        imei: '353456789012345', serialNumber: 'E2E-LIFECYCLE-001',
      }, customer.token), 201);
      const orderId = id(created.orderId || created);

      await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.252.0.${Date.now() % 200}` });
      await page.goto(`${webBaseUrl}/login`);
      await page.locator('#email').fill(adminEmail);
      await page.locator('#password').fill(adminPassword);
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL(/\/admin(\/|$)/, { timeout: 15000 });
      await page.goto(`${webBaseUrl}/orders/${orderId}`);
      await expect(page.getByRole('heading', { name: new RegExp(`Order #${created.orderNumber || 'ORD-'}`) })).toBeVisible({ timeout: 20000 });

      const statusButton = page.getByRole('button', { name: /Ausstehend|Pending/ }).first();
      await statusButton.click();
      await page.getByRole('menuitem', { name: /In Bearbeitung|In progress/ }).click();
      await expect(page.getByText(/In Bearbeitung|In progress/).first()).toBeVisible();

      await page.getByRole('button', { name: /Rechnung erstellen|Create invoice/ }).click();
      await expect(page.getByText('Rechnung erstellt', { exact: true })).toBeVisible({ timeout: 15000 });

      const invoices = await expectSuccess(await request(customerContext, 'GET', '/api/invoices', undefined, customer.token));
      const invoice = invoices.invoices?.find((item) => id(item.orderId) === orderId);
      expect(invoice?._id).toBeTruthy();
      expect(invoice.total).toBeGreaterThan(0);

      await page.getByRole('button', { name: 'Abmelden' }).click();
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.251.0.${Date.now() % 200}` });
      await page.locator('#email').fill(customerEmail);
      await page.locator('#password').fill(customerPassword);
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });

      await page.goto(`${webBaseUrl}/orders/${orderId}`);
      await expect(page.getByText(/In Bearbeitung|In progress/).first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(/Fortschritt|Progress/).first()).toBeVisible();

      await page.goto(`${webBaseUrl}/invoices`);
      await expect(page.locator(`[data-invoice-id="${invoice._id}"]`)).toBeVisible({ timeout: 20000 });
      await page.locator(`[data-invoice-id="${invoice._id}"]`).click();
      await expect(page.getByText(/Rechnung bezahlen|Pay invoice/)).toBeVisible({ timeout: 10000 });

      await expect(page.getByText(/Zahlungsmethode|Payment method/).first()).toBeVisible();
      await expect(page.getByText(/Zahlungsbedingungen|payment terms/).first()).toBeVisible();

      await expect(page.getByText(/Rechnung bezahlen|Pay invoice/)).toBeVisible({ timeout: 15000 });
    } finally {
      await adminContext.dispose();
      await customerContext.dispose();
    }
  });

  test('repair order, operations, billing, communication, complaints and guest flows', async () => {
    test.setTimeout(120000);

    const adminContext = await newApiContext();
    const customerContext = await newApiContext();
    const publicContext = await newApiContext();
    const admin = await login(adminContext, adminEmail, adminPassword);
    const customer = await login(customerContext, customerEmail, customerPassword);

    const customerToken = customer.token;
    const adminToken = admin.token;
    const guestEmail = `guest-${Date.now()}@example.test`;
    const created = {};

    const guestRequest = await expectSuccess(await request(publicContext, 'POST', '/api/repair-requests/guest', {
      guestInfo: { firstName: 'E2E', lastName: 'Gast', email: guestEmail, phone: '+4915112345678' },
      deviceType: 'Smartphone', deviceBrand: 'Apple', deviceModel: 'iPhone 14',
      issueDescription: 'Display and touch input are intermittently unavailable.',
    }), 201);
    expect(guestRequest.requestNumber).toBeTruthy();
    expect(guestRequest.guestTrackingToken).toBeTruthy();
    const trackedGuest = await expectSuccess(await request(
      publicContext,
      'GET',
      `/api/repair-requests/guest/track?token=${encodeURIComponent(guestRequest.guestTrackingToken)}&email=${encodeURIComponent(guestEmail)}`,
    ));
    expect(trackedGuest.request).toBeTruthy();
    const guestId = id(trackedGuest.request);
    await expectSuccess(await request(publicContext, 'POST', `/api/repair-requests/guest/${guestId}/message`, {
      token: guestRequest.guestTrackingToken, email: guestEmail, content: 'Bitte teilen Sie mir den aktuellen Bearbeitungsstand mit.',
    }, undefined), 201);

    const serviceList = await expectSuccess(await request(publicContext, 'GET', '/api/services?limit=1'));
    const service = serviceList.services?.[0];
    expect(service?._id).toBeTruthy();
    const repairService = {
      serviceId: id(service),
      name: service.name || 'Display-Reparatur',
      price: Number(service.price || 149.9),
      estimatedTime: Number(service.estimatedTime || 60),
    };

    const order = await expectSuccess(await request(customerContext, 'POST', '/api/orders', {
      deviceBrand: 'Apple', deviceModel: 'iPhone 14', deviceType: 'Smartphone',
      serviceName: repairService.name, services: [repairService],
      totalCost: 149.9, customerNotes: 'E2E workflow order', shippingAddress: address,
    }, customerToken), 201);
    created.orderId = id(order.orderId || order);
    expect(order.orderNumber).toBeTruthy();

    const orderDetails = await expectSuccess(await request(customerContext, 'GET', `/api/orders/${created.orderId}`, undefined, customerToken));
    expect(id(orderDetails.order)).toBe(created.orderId);
    await expectSuccess(await request(customerContext, 'GET', `/api/orders/${created.orderId}/progress-timeline`, undefined, customerToken));
    await expectSuccess(await request(customerContext, 'GET', '/api/orders', undefined, customerToken));

    await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${created.orderId}/status`, { status: 'in-progress' }, adminToken));
    const bookingList = await expectSuccess(await request(adminContext, 'GET', '/api/bookings', undefined, adminToken));
    const booking = bookingList.bookings?.find((item) => (item.orderIds || []).some((itemId) => id(itemId) === created.orderId));
    if (booking) {
      created.bookingId = id(booking);
      await expectSuccess(await request(adminContext, 'GET', `/api/bookings/${created.bookingId}`, undefined, adminToken));
      await expectSuccess(await request(adminContext, 'GET', `/api/bookings/${created.bookingId}/summary`, undefined, adminToken));
      await expectSuccess(await request(adminContext, 'GET', `/api/bookings/${created.bookingId}/orders`, undefined, adminToken));
    }

    await expectSuccess(await request(customerContext, 'GET', '/api/messages/conversations', undefined, customerToken));
    await expectSuccess(await request(customerContext, 'GET', '/api/notifications', undefined, customerToken));
    await expectSuccess(await request(customerContext, 'GET', '/api/repair-requests/my-requests', undefined, customerToken));

    await expectSuccess(await request(adminContext, 'PUT', `/api/admin/orders/${created.orderId}/status`, { status: 'completed' }, adminToken));
    const complaint = await expectSuccess(await request(customerContext, 'POST', `/api/orders/${created.orderId}/complaint`, {
      reason: 'repeat_failure', description: 'The same fault returned after the repair was completed.',
    }, customerToken), 201);
    created.complaintId = id(complaint.complaint);
    await expectSuccess(await request(customerContext, 'GET', `/api/complaints/${created.complaintId}`, undefined, customerToken));
    await expectSuccess(await request(customerContext, 'POST', `/api/complaints/${created.complaintId}/comments`, {
      comment: 'Customer follow-up message for the complaint.', isInternal: false,
    }, customerToken));
    await expectSuccess(await request(adminContext, 'PATCH', `/api/complaints/${created.complaintId}/reject`, {
      rejection_reason: 'E2E rejection path validation',
    }, adminToken));

    const invoices = await expectSuccess(await request(customerContext, 'GET', '/api/invoices', undefined, customerToken));
    const invoice = invoices.invoices?.find((item) => id(item.orderId) === created.orderId);
    if (invoice) {
      created.invoiceId = id(invoice);
      await expectSuccess(await request(customerContext, 'GET', `/api/invoices/${created.invoiceId}`, undefined, customerToken));
      const gateways = await expectSuccess(await request(customerContext, 'GET', '/api/invoices/payment-gateways', undefined, customerToken));
      const bank = gateways.gateways?.find((item) => item.provider === 'bank_transfer');
      if (bank) {
        await expectSuccess(await request(customerContext, 'POST', `/api/invoices/${created.invoiceId}/pay`, {
          amount: invoice.total, gatewayId: id(bank), gatewayProvider: 'bank_transfer',
          paymentData: { payerName: 'E2E Customer', payerEmail: customerEmail, acceptedTerms: true, reference: 'E2E payment' },
        }, customerToken));
      }
    }
    await expectSuccess(await request(adminContext, 'GET', '/api/admin/financial/invoices', undefined, adminToken));
    await expectSuccess(await request(adminContext, 'GET', '/api/admin/financial/payments', undefined, adminToken));
    await expectSuccess(await request(adminContext, 'GET', '/api/admin/financial/reports', undefined, adminToken));

    const contact = await expectSuccess(await request(publicContext, 'POST', '/api/contact', {
      name: 'E2E Contact', email: `contact-${Date.now()}@example.test`, phone: '+4915112345678',
      subject: 'repair', message: 'Ich benoetige Informationen zu einer Reparaturanfrage im E2E-Test.',
      privacyAccepted: true,
    }), 201);
    expect(contact.messageId).toBeTruthy();
    const contactInbox = await expectSuccess(await request(adminContext, 'GET', '/api/admin/contact-messages', undefined, adminToken));
    expect(contactInbox.messages || contactInbox.contactMessages || contactInbox.data).toBeTruthy();

    const guestOrder = await expectSuccess(await request(adminContext, 'POST', '/api/bookings/manual-repair', {
      guestInfo: { firstName: 'E2E', lastName: 'GuestOrder', email: `order-${Date.now()}@example.test`, phone: '+4915112345678', ...address },
      repairOrders: [{ deviceBrand: 'Apple', deviceModel: 'iPhone 14', deviceType: 'Smartphone',
        services: [repairService], totalCost: repairService.price, customerNotes: 'Guest E2E order' }],
      createShippingLabel: true,
    }, adminToken), 201);
    expect(guestOrder.bookingId).toBeTruthy();
    expect(guestOrder.orderIds?.length).toBe(1);
    expect(guestOrder.booking?.guestTrackingToken).toBeTruthy();
    expect(guestOrder.booking?.trackingNumber).toBeTruthy();
    expect(guestOrder.booking?.shippingLabelUrl).toMatch(/^data:application\/pdf;base64,/);

    for (const path of ['/api/services', '/api/products', '/api/faqs', '/api/blog-posts', '/api/languages']) {
      await expectSuccess(await request(publicContext, 'GET', path));
    }

    await adminContext.dispose();
    await customerContext.dispose();
    await publicContext.dispose();
  });
});