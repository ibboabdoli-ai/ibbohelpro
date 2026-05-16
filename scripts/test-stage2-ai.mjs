import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const handler = require('../api/ai/chat.js');
const internal = handler.__internal;

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
  return res;
}

async function call(body, method = 'POST') {
  const req = {
    method,
    body,
    headers: { 'x-forwarded-for': `stage2-test-${Math.random()}` },
    socket: { remoteAddress: '127.0.0.1' }
  };
  const res = mockRes();
  await handler(req, res);
  return res;
}

assert.equal(internal.RESPONSE_SCHEMA.additionalProperties, false, 'Top-level schema must reject extra properties');
assert.equal(internal.RESPONSE_SCHEMA.properties.bookingPatch.additionalProperties, false, 'bookingPatch schema must reject extra properties');

const openAiBody = internal.buildOpenAIBody({ message: 'Book home cleaning in Stockholm', lang: 'en', context: {} });
assert.equal(openAiBody.response_format.type, 'json_schema', 'OpenAI request must use structured JSON Schema');
assert.equal(openAiBody.response_format.json_schema.strict, true, 'JSON Schema must be strict');

const cleanPatch = internal.cleanBookingPatch({
  category: 'home',
  address: 'Stockholm',
  ignored: 'must-not-pass',
  extras: ['deep clean', '', null, 'windows']
});
assert.deepEqual(cleanPatch, { category: 'home', address: 'Stockholm', extras: ['deep clean', 'windows'] });

const fallback = internal.buildFallbackResponse('I want weekly home cleaning in Stockholm for 2 bedrooms tomorrow at 10', 'en', { bookingDraft: {} });
assert.equal(fallback.mode, 'deterministic-fallback');
assert.equal(fallback.bookingPatch.category, 'home');
assert.equal(fallback.bookingPatch.address.toLowerCase(), 'stockholm');
assert.equal(fallback.bookingPatch.propertySize, '2 bedrooms');
assert.equal(fallback.bookingPatch.frequency, 'Weekly');
assert.ok(Array.isArray(fallback.missingFields));

const response = await call({
  message: '<img src=x onerror=alert(1)> price?',
  lang: 'sv',
  context: { bookingDraft: { category: 'home', address: 'Stockholm' } }
});
assert.equal(response.statusCode, 200);
assert.equal(response.body.mode, 'deterministic-fallback');
assert.equal(typeof response.body.assistantMessage, 'string');
assert.ok(Array.isArray(response.body.quickActions));
assert.ok(Object.keys(response.body.bookingPatch).every((key) => ['category', 'address', 'propertySize', 'frequency', 'dateTime', 'extras', 'notes'].includes(key)));

const invalid = await call({}, 'POST');
assert.equal(invalid.statusCode, 400);

const options = await call({}, 'OPTIONS');
assert.equal(options.statusCode, 200);

console.log('Stage 2 AI tests passed');
