/**
 * Generate bcrypt hash for AdminUsers.PasswordHash
 * Usage: node scripts/hash-password.js "YourPassword"
 */
const bcrypt = require('bcryptjs');

const plain = process.argv[2] || 'Admin@123';
const hash = bcrypt.hashSync(plain, 10);
console.log(hash);
