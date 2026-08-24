const mongoose = require('mongoose');

const telegramCommandSchema = new mongoose.Schema({
  command: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['dynamic', 'static'],
    default: 'static'
  },
  staticText: {
    type: String,
    default: ''
  },
  scheduleTime: {
    type: String, // Định dạng "HH:mm"
    default: '',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TelegramCommand', telegramCommandSchema);
