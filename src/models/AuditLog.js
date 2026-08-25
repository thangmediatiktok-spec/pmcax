const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['VIEW_PROFILE', 'EDIT_PROFILE', 'EXPORT_PROFILE']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Officer'
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  details: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 31536000 // Automatically delete logs older than 1 year
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
