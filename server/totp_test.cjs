const otplib = require('./node_modules/otplib');
(async () => {
  const secret = 'JBSWY3DPEHPK3PXP';
  // Generate current valid token
  const token = otplib.totp.generate(secret);
  console.log('current token:', token);
  console.log('verify no window:', otplib.totp.verify({token, secret}));
  console.log('verify window:1:', otplib.totp.verify({token, secret, window:1}));
  console.log('verify window:2:', otplib.totp.verify({token, secret, window:2}));
  // Check drift tolerance
  console.log('verify window:-1:', otplib.totp.verify({token, secret, window:-1}));
  process.exit(0);
})();
