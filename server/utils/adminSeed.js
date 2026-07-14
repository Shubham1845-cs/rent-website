const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function adminSeed() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn('[adminSeed] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }

  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log('[adminSeed] Admin already exists — skipping');
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.create({ name: 'Admin', email: ADMIN_EMAIL, passwordHash, role: 'admin' });
  console.log(`[adminSeed] Admin account created: ${ADMIN_EMAIL}`);
}

module.exports = adminSeed;
