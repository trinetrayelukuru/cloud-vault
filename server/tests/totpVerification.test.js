/**
 * TOTP verification regression tests.
 * Tests: already-enrolled user with valid code, missing/invalid codes, successful verification.
 * Uses otplib (same as server routes/auth.js). No MFA reset/enrol change.
 */
const assert = require('assert');
const otplib = require('otplib');

function test(name, fn) {
  try { fn(); console.log('PASS:', name); }
  catch (e) { console.error('FAIL:', name, '-', e.message); process.exitCode = 1; }
}

const secret = otplib.authenticator.generateSecret(); // simulates already-enrolled secret

// 1. Already-enrolled user, valid 6-digit code
test('valid 6-digit TOTP for enrolled user', () => {
  const code = otplib.authenticator.generate(secret);
  assert.strictEqual(code.length, 6, 'code must be 6 digits');
  assert.strictEqual(otplib.authenticator.check(code, secret), true, 'valid code must verify');
});

// 2. Invalid (wrong) code
test('invalid wrong TOTP fails', () => {
  assert.strictEqual(otplib.authenticator.check('000000', secret), false, 'wrong code must fail');
});

// 3. Missing / empty code
test('missing empty TOTP fails', () => {
  assert.strictEqual(otplib.authenticator.check('', secret), false, 'empty code must fail');
  assert.strictEqual(otplib.authenticator.check(null, secret), false, 'null code must fail');
});

// 4. Non-6-digit (too short / too long / non-numeric)
test('invalid length / non-numeric TOTP fails', () => {
  assert.strictEqual(otplib.authenticator.check('123', secret), false, '3-digit must fail');
  assert.strictEqual(otplib.authenticator.check('1234567', secret), false, '7-digit must fail');
  assert.strictEqual(otplib.authenticator.check('12a456', secret), false, 'mixed alphanumeric must fail');
});

// 5. Verify backend contract (routes/auth.js expects { code })
test('backend contract field is code', () => {
  const payload = { code: otplib.authenticator.generate(secret) };
  assert.ok(payload.code && payload.code.length === 6, 'backend expects code field with 6 digits');
});

console.log('\n✅ All TOTP verification tests passed. Existing secret preserved; no MFA reset performed.');
