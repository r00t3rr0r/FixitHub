#!/usr/bin/env node

const assert = require('assert');
const DHLService = require('./server/services/dhlService');

function dhlResponseError(status, data) {
  return { response: { status, data } };
}

function testPackstationValidationError() {
  const result = DHLService.getDhlErrorDetails(dhlResponseError(400, {
    detail: 'Validation failed',
    items: [{ validationMessages: [{ validationMessage: 'lockerID is invalid' }] }]
  }));

  assert.strictEqual(result.code, 'PACKSTATION_INVALID');
  assert.match(result.message, /Packstationsnummer/);
  assert.strictEqual(result.retryable, false);
}

function testPostalCodeValidationError() {
  const result = DHLService.getDhlErrorDetails(dhlResponseError(400, {
    items: [{ validationMessages: [{ property: 'consignee.postalCode' }] }]
  }));

  assert.strictEqual(result.code, 'POSTAL_CODE_INVALID');
  assert.match(result.message, /PLZ/);
}

function testServiceTypeValidationError() {
  const result = DHLService.getDhlErrorDetails(dhlResponseError(400, {
    detail: 'Unknown product V99TEST'
  }));

  assert.strictEqual(result.code, 'SERVICE_TYPE_UNAVAILABLE');
  assert.match(result.message, /Service Type/);
}

function testTemporaryDhlFailuresAreRetryable() {
  const networkResult = DHLService.getDhlErrorDetails({ code: 'ETIMEDOUT' });
  const serverResult = DHLService.getDhlErrorDetails(dhlResponseError(503, {}));

  assert.strictEqual(networkResult.code, 'DHL_API_UNAVAILABLE');
  assert.strictEqual(networkResult.retryable, true);
  assert.strictEqual(serverResult.code, 'DHL_API_UNAVAILABLE');
  assert.strictEqual(serverResult.retryable, true);
}

function testServiceTypeMapping() {
  assert.strictEqual(DHLService.resolveShippingProduct({ serviceType: 'P' }, 'DEFAULT'), 'V01PAK');
  assert.strictEqual(DHLService.resolveShippingProduct({ serviceType: 'N' }, 'DEFAULT'), 'V53WPAK');
  assert.strictEqual(DHLService.resolveShippingProduct({ product: 'CUSTOM' }, 'DEFAULT'), 'CUSTOM');
  assert.strictEqual(DHLService.resolveShippingProduct({}, 'V01PAK'), 'V01PAK');
}

testPackstationValidationError();
testPostalCodeValidationError();
testServiceTypeValidationError();
testTemporaryDhlFailuresAreRetryable();
testServiceTypeMapping();
console.log('[DHL-LABEL-ERRORS] All label error classification tests passed');