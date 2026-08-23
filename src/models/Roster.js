const mongoose = require('mongoose');

const daySchema = new mongoose.Schema({
  date: { type: Date, required: true },
  trucChiHuy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Officer' }],
  trucBanNgay: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Officer' }],
  trucBanDem: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Officer' }],
  ghiChu: { type: String },
  ghiChuPhu: { type: String }
});

const rosterSchema = new mongoose.Schema({
  weekStart: { type: Date, required: true, unique: true },
  weekEnd: { type: Date, required: true },
  days: [daySchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Roster', rosterSchema);
