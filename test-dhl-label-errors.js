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
  // Legacy aliases and lower case keep being normalised to today's product codes.
  assert.strictEqual(DHLService.resolveShippingProduct({ serviceType: 'P' }, 'DEFAULT'), 'V01PAK');
  assert.strictEqual(DHLService.resolveShippingProduct({ serviceType: 'N' }, 'DEFAULT'), 'V53WPAK');
  assert.strictEqual(DHLService.resolveShippingProduct({ product: 'y' }, 'DEFAULT'), 'V54EPAK');
  // No request -> the product configured in the DHL integration.
  assert.strictEqual(DHLService.resolveShippingProduct({}, 'V01PAK'), 'V01PAK');
  // The configured product itself stays allowed even if it is not in the offered list.
  assert.strictEqual(DHLService.resolveShippingProduct({ product: 'v62wp' }, 'V62WP'), 'V62WP');
}

function testUnknownProductIsRejected() {
  // An unknown code is neither passed through to DHL nor silently replaced by the configured
  // default: it is rejected with a German 400 validation error before any DHL call.
  for (const code of ['CUSTOM', 'V99TEST']) {
    assert.throws(
      () => DHLService.resolveShippingProduct({ product: code }, 'DEFAULT'),
      (error) => {
        assert.strictEqual(error.status, 400);
        assert.strictEqual(error.code, 'DHL_PRODUCT_NOT_OFFERED');
        assert.strictEqual(error.retryable, false);
        assert.match(error.message, /wird nicht angeboten/);
        assert.match(error.message, /V01PAK/);
        return true;
      }
    );
  }
}

testPackstationValidationError();
testPostalCodeValidationError();
testServiceTypeValidationError();
testTemporaryDhlFailuresAreRetryable();
testServiceTypeMapping();
testUnknownProductIsRejected();
console.log('[DHL-LABEL-ERRORS] All label error classification tests passed');