const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  ten: { type: String, required: true, unique: true, trim: true },
  thuTu: { type: Number, default: 0 },
  moTa: { type: String, trim: true },
  trangThai: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
