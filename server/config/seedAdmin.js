const User = require('../models/User');

// Default admin credentials (change these in production!)
const DEFAULT_ADMIN = {
  email: 'admin@cloudevault.local',
  name: 'Vault Administrator',
  password: 'Admin@2026!', // Change this in production!
  role: 'admin'
};

async function seedAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findByEmail(DEFAULT_ADMIN.email);

    if (existingAdmin) {
      console.log('✅ Admin account already exists');
      return;
    }

    // Create admin account
    const adminId = await User.create(DEFAULT_ADMIN);

    console.log(`
╔════════════════════════════════════════════════════════╗
║     🛡️  DEFAULT ADMIN ACCOUNT CREATED                 ║
╚════════════════════════════════════════════════════════╝

  📧 Email:    ${DEFAULT_ADMIN.email}
  🔑 Password: ${DEFAULT_ADMIN.password}

  ⚠️  IMPORTANT: Change this password after first login!

    `);

  } catch (err) {
    console.error('❌ Failed to seed admin account:', err.message);
  }
}

module.exports = { seedAdmin, DEFAULT_ADMIN };
