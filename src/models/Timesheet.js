const mongoose = require('mongoose');

const dailyRecordSchema = new mongoose.Schema({
  day: { type: Number, required: true }, // 1 to 31
  code: { type: String, required: true }, // '+', 'A', 'CT-A', 'P', 'NL', etc.
  note: { type: String, trim: true }, // e.g. "Xã ABC"
  adlPlan: { type: String }, // For ADL preview manual edit
  adlResult: { type: String }
}, { _id: false });

const timesheetSchema = new mongoose.Schema({
  officer: { type: mongoose.Schema.Types.ObjectId, ref: 'Officer', required: true },
  month: { type: Number, required: true }, // 1 to 12
  year: { type: Number, required: true }, // e.g. 2026
  records: [dailyRecordSchema],
  status: { type: String, enum: ['draft', 'submitted', 'approved'], default: 'draft' },
  submittedAt: Date,
  approvedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

timesheetSchema.index({ officer: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Timesheet', timesheetSchema);
