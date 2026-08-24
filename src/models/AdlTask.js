const mongoose = require('mongoose');

const adlTaskSchema = new mongoose.Schema({
  team: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Team', 
    required: true 
  },
  plan: { 
    type: String, 
    required: true,
    trim: true 
  },
  result: { 
    type: String, 
    required: true,
    trim: true 
  },
  type: {
    type: String,
    enum: ['A', 'CT-A'],
    default: 'A'
  }
}, { timestamps: true });

module.exports = mongoose.model('AdlTask', adlTaskSchema);
