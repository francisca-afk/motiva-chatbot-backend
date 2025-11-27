const mongoose = require('mongoose')

const ACTIONS = ['sendEmailNotification', 'escalatedCase', 'triggerWebhook']

const chatMessageSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true
  },
  mood: {
    type: String,
    enum: ['positive', 'negative', 'excited', 'calm', 'frustrated', 'tired', 'none'],
    default: 'none',
    required: true
  },
  action: {
    type: String,
    enum: ACTIONS,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system', 'humanAgent'],
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  // added metadata field for stuffs like: model, temperature, etc
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true 
});

chatMessageSchema.post('save', async function() {
  await mongoose.model('ChatSession').findByIdAndUpdate(
    this.session,
    { lastMessageAt: this.createdAt },
    { new: true }
  );
})

module.exports = mongoose.model('ChatMessage', chatMessageSchema)