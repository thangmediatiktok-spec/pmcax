const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  hoTen: { type: String, required: true },
  email: { type: String, trim: true },
  role: { type: String, enum: ['admin', 'truong_cax', 'pho_cax', 'cbcs'], default: 'cbcs' },
  officerProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer' },
  canManageRoster: { type: Boolean, default: false },
  trangThai: { type: Boolean, default: true },
  lastLogin: { type: Date },
  twoFactorSecret: { type: String },
  twoFactorEnabled: { type: Boolean, default: false },
  mustChangePassword: { type: Boolean, default: true },
  failedLoginAttempts: { type: Number, default: 0 },
  securityPin: { type: String, default: null } // Hashed PIN code
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
