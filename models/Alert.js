const mongoose = require('mongoose');

const ALERT_TYPES = [
  'lowMood',
  'unresolved',
  'critical',
];

const ALERT_STATUS = ['unread', 'read'];

const alertSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true
  },
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage',
    required: false
  },
  type: {
    type: String,
    enum: ALERT_TYPES,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ALERT_STATUS,
    default: 'unread'
  },
  readBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  readAt: {
    type: Date,
    default: null
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Alert', alertSchema);
