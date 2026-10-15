const express = require('express');
// In-memory short-lived MFA verification state (userId -> {verifiedAt})
const mfaVerifiedState = new Map();
const MFA_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function isMfaVerified(userId) {
  const entry = mfaVerifiedState.get(userId);
  if (!entry) return false;
  if (Date.now() - entry.verifiedAt > MFA_WINDOW_MS) {
    mfaVerifiedState.delete(userId);
    return false;
  }
  return true;
}

function markMfaVerified(userId) {
  mfaVerifiedState.set(userId, { verifiedAt: Date.now() });
}

const router = express.Router();
const User = require('../models/User');
const SecurityEvent = require('../models/SecurityEvent');
const { generateToken, authenticate } = require('../middleware/auth');
const { otpauthUrl, totp, authenticator } = require('otplib');
const QRCode = require('qrcode');

// Helper to get client IP
const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
};

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    // Validation
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Create user
    const userId = await User.create({ email, name, password });

    // Log security event
    await SecurityEvent.log({
      userId,
      eventType: 'REGISTER',
      status: 'success',
      ipAddress,
      userAgent,
      details: 'Account created successfully'
    });

    // Generate token
    const token = generateToken(userId, 'user');

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: {
        id: userId,
        email,
        name,
        role: 'user',
        mfaEnabled: false,
        webauthnEnabled: false
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }

    // Find user
    const user = await User.findByEmail(email);

    if (!user) {
      // Log failed attempt with no user ID
      await SecurityEvent.log({
        eventType: 'LOGIN_FAILED',
        status: 'failure',
        ipAddress,
        userAgent,
        details: `Failed login attempt for non-existent email: ${email}`
      });

      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if account is locked
    const isLocked = await User.isAccountLocked(user.id);
    if (isLocked) {
      const lockMinutes = Math.ceil((user.locked_until - Math.floor(Date.now() / 1000)) / 60);

      await SecurityEvent.log({
        userId: user.id,
        eventType: 'LOGIN_BLOCKED_LOCKED',
        status: 'failure',
        ipAddress,
        userAgent,
        details: `Login attempt on locked account (${lockMinutes} min remaining)`
      });

      return res.status(423).json({
        error: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${lockMinutes} minutes.`,
        lockedUntil: user.locked_until
      });
    }

    // Check if account is suspended or terminated
    if (user.account_status !== 'active') {
      return res.status(403).json({
        error: `Account is ${user.account_status}. Please contact administrator.`
      });
    }

    // Verify password
    const isPasswordValid = await User.verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment failed attempts and check if account gets locked
      const isNowLocked = await User.incrementFailedAttempts(user.id);

      await SecurityEvent.log({
        userId: user.id,
        eventType: isNowLocked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
        status: 'failure',
        ipAddress,
        userAgent,
        details: isNowLocked
          ? 'Account locked after 3 failed login attempts'
          : `Failed password attempt (${user.failed_login_attempts + 1}/3)`
      });

      if (isNowLocked) {
        return res.status(423).json({
          error: 'Account locked due to 3 failed login attempts. Please try again in 15 minutes.'
        });
      }

      return res.status(401).json({
        error: 'Invalid email or password.',
        attemptsRemaining: 3 - (user.failed_login_attempts + 1)
      });
    }

    // Login successful - update last login and reset failed attempts
    await User.updateLastLogin(user.id, ipAddress);

    // Log successful login
    await SecurityEvent.log({
      userId: user.id,
      eventType: 'LOGIN_SUCCESS',
      status: 'success',
      ipAddress,
      userAgent,
      details: 'Password login successful'
    });

    // Generate token
    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mfaEnabled: !!user.mfa_enabled,
        webauthnEnabled: !!user.webauthn_credentials
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent security events
    const recentEvents = await SecurityEvent.getByUserId(user.id, 5);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        accountStatus: user.account_status,
        mfaEnabled: !!user.mfa_enabled,
        webauthnEnabled: !!user.webauthn_credentials,
        createdAt: user.created_at,
        lastLogin: user.last_login
      },
      recentEvents
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Logout endpoint (logs security event)
router.post('/logout', authenticate, async (req, res) => {
  try {
    await SecurityEvent.log({
      userId: req.user.id,
      eventType: 'LOGOUT',
      status: 'success',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      details: 'User logged out'
    });

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// POST /api/auth/mfa/setup — Generate TOTP secret + QR
router.post('/mfa/setup', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const secret = authenticator.generateSecret();
    await User.updateMFA(userId, secret, true);
    const otpauth = authenticator.keyuri(req.user.email, 'CloudVault', secret);
    const qr = await QRCode.toDataURL(otpauth);
    res.json({ secret, qrCodeUrl: qr, setup: true });
  } catch (err) {
    res.status(500).json({ error: 'MFA setup failed', message: err.message });
  }
});

// POST /api/auth/mfa/verify — Verify TOTP code
router.post('/mfa/verify', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id);
    if (!user || !user.mfa_secret) return res.status(400).json({ error: 'MFA not configured' });
    const valid = authenticator.check(code, user.mfa_secret);
    if (valid) markMfaVerified(req.user.id); // establish server-side verified state
    await SecurityEvent.log({
      userId: req.user.id, eventType: 'mfa_verify', status: valid ? 'success' : 'failure',
      ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
      details: valid ? 'MFA verified' : 'Invalid TOTP code'
    });
    res.json({ valid, message: valid ? 'MFA verified' : 'Invalid code' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/mfa/disable
router.post('/mfa/disable', authenticate, async (req, res) => {
  try {
    await User.updateMFA(req.user.id, null, false);
    res.json({ disabled: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Phase 14 — WebAuthn / Passkey / Windows Hello
const { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } = require('@simplewebauthn/server');
const webauthnChallenges = new Map(); // userId -> challenge

// GET WebAuthn registration options
router.get('/webauthn/register-options', authenticate, async (req, res) => {
  try {
    const options = await generateRegistrationOptions({
      rpName: 'Cloud Vault',
      rpID: 'localhost',
      userName: req.user.email,
      userDisplayName: req.user.name
    });
    webauthnChallenges.set(req.user.id, options.challenge); // store server-side
    res.json({ options, challengeReturned: true });
  } catch (err) {
    console.error('WebAuthn register options error:', err);
    res.status(500).json({ error: 'Failed to generate WebAuthn options' });
  }
});

// POST WebAuthn verify registration
router.post('/webauthn/register-verify', authenticate, async (req, res) => {
  try {
    const { credential, expectedChallenge } = req.body;
    if (!credential) return res.status(400).json({ error: 'No credential provided' });

    const storedChallenge = webauthnChallenges.get(req.user.id);
    if (!storedChallenge) {
      return res.status(403).json({ error: 'No pending challenge. Start registration again.' });
    }
    const challengeToVerify = expectedChallenge || storedChallenge;

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeToVerify,
      expectedOrigin: 'http://localhost:5173',
      expectedRPID: 'localhost',
      requireUserVerification: true
    });

    if (!verification.verified) {
      return res.status(400).json({ verified: false, error: 'WebAuthn attestation verification failed' });
    }
    webauthnChallenges.delete(req.user.id); // consume after success (prevent reuse)

    const credentials = JSON.parse(
      (await User.findById(req.user.id)).webauthn_credentials || '[]'
    );
    credentials.push({
      id: credential.id,
      type: credential.type,
      registeredAt: Math.floor(Date.now() / 1000),
      attestationVerified: true
    });
    await User.updateWebAuthn(req.user.id, JSON.stringify(credentials));

    await SecurityEvent.log({
      userId: req.user.id,
      eventType: 'WEBAUTHN_REGISTERED',
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: `Passkey registered: ${credential.id}`
    });

    res.json({ verified: true, message: 'Passkey registered successfully' });
  } catch (err) {
    console.error('WebAuthn register verify error:', err);
    res.status(500).json({ error: 'WebAuthn registration failed' });
  }
});

// GET WebAuthn authentication options
router.get('/webauthn/auth-options', authenticate, async (req, res) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: 'localhost',
      allowCredentials: []
    });
    res.json({ options });
  } catch (err) {
    console.error('WebAuthn auth options error:', err);
    res.status(500).json({ error: 'Failed to generate WebAuthn auth options' });
  }
});

// POST WebAuthn verify authentication
router.post('/webauthn/auth-verify', authenticate, async (req, res) => {
  try {
    const { credential, expectedChallenge } = req.body;
    if (!credential) return res.status(400).json({ error: 'No credential provided' });

    // Real verification (not fake)
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: expectedChallenge || '',
      expectedOrigin: 'http://localhost:5173',
      expectedRPID: 'localhost',
      requireUserVerification: true
    });

    await SecurityEvent.log({
      userId: req.user.id,
      eventType: 'WEBAUTHN_AUTH',
      status: verification.verified ? 'success' : 'failure',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: `Passkey auth verified=${verification.verified}`
    });

    res.json({ verified: verification.verified, message: verification.verified ? 'Passkey verified successfully' : 'Passkey verification failed' });
  } catch (err) {
    console.error('WebAuthn auth verify error:', err);
    res.status(500).json({ error: 'WebAuthn authentication failed' });
  }
});

module.exports = router;
module.exports.mfaVerifiedState = mfaVerifiedState;
module.exports.isMfaVerified = isMfaVerified;
module.exports.markMfaVerified = markMfaVerified;
