const mongoose = require('mongoose')

const SESSION_STATUS = ['active', 'ended', 'deleted']

const chatSessionSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  visitorId: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    default: 'Untitled Chat',
    trim: true
  },
  status: {
    type: String,
    enum: SESSION_STATUS,
    default: 'active'
  },
  handedOff: { type: Boolean, default: false },
  handedOffAt: { type: Date },
  handedOffBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  summary: {
    businessInsights: {
      type: String,
      default: null
    },
    recommendations: {
      type: String,
      default: null
    },
    summary: {
      type: String,
      default: null
    }
  },
  alertState: {
    lastAlertType: {
      type: String,
      enum: ["lowMood", "unresolved", "critical", null],
      default: null
    },
    lastAlertTimestamp: {
      type: Date,
      default: null
    },
    emailSent: {
      type: Boolean,
      default: false
    }
  },
}, { 
  timestamps: true 
});

module.exports = mongoose.model('ChatSession', chatSessionSchema)