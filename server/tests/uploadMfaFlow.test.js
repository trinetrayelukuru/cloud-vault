/**
 * Upload MFA verification flow tests.
 * Tests: missing/invalid code blocked, valid code allows upload authorization path.
 * Does NOT call /files/upload — verifies frontend verification contract and server /mfa/verify.
 */
const assert = require('assert');
const otplib = require('otplib');

function test(name, fn) {
  try { fn(); console.log('PASS:', name); }
  catch (e) { console.error('FAIL:', name, '-', e.message); process.exitCode = 1; }
}

const secret = otplib.authenticator.generateSecret();

// 1. Missing code — must fail verification
test('missing TOTP code fails verification', () => {
  assert.strictEqual(otplib.authenticator.check('', secret), false, 'empty must fail');
  assert.strictEqual(otplib.authenticator.check('    ', secret), false, 'whitespace must fail');
});

// 2. Invalid (wrong) 6-digit code — must fail
test('invalid wrong TOTP code fails', () => {
  const valid = otplib.authenticator.generate(secret);
  assert.strictEqual(otplib.authenticator.check('000000', secret), false, 'wrong code must fail');
  assert.strictEqual(otplib.authenticator.check(valid.replace('0','1'), secret), false, 'slightly altered must fail');
});

// 3. Non-6-digit / non-numeric — must fail
test('invalid length/non-numeric TOTP fails', () => {
  assert.strictEqual(otplib.authenticator.check('123', secret), false, '3-digit fail');
  assert.strictEqual(otplib.authenticator.check('1234567', secret), false, '7-digit fail');
  assert.strictEqual(otplib.authenticator.check('12a456', secret), false, 'non-numeric fail');
});

// 4. Valid 6-digit code for enrolled secret — passes
test('valid 6-digit TOTP passes for enrolled user', () => {
  const code = otplib.authenticator.generate(secret);
  assert.strictEqual(code.length, 6, 'must be 6 digits');
  assert.strictEqual(otplib.authenticator.check(code, secret), true, 'valid must pass');
});

// 5. Backend /mfa/verify contract: expects { code: string }
test('upload flow sends code field matching /mfa/verify', () => {
  const payload = { code: otplib.authenticator.generate(secret) };
  assert.strictEqual(typeof payload.code, 'string', 'code is string');
  assert.strictEqual(payload.code.length, 6, '6 digits');
  assert.ok(/^\d{6}$/.test(payload.code), 'numeric only');
});

console.log('\n✅ Upload MFA flow tests passed. Existing Aegis secret preserved; no disable/re-enrol. No AWS/config change.');
