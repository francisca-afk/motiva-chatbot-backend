const mongoose = require('mongoose')

const chatbotSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },

  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },

  settings: {
    welcomeMessage: { type: String, default: 'Hi! How can I help you today?' },
    offlineMessage: { type: String, default: 'We’re currently offline.' },

    theme: {
      primary: { type: String, default: '#b9d825' },
      secondary: { type: String, default: '#7d3f97' },
      background: { type: String, default: '#f2f6f8e8' },
      backgroundField: { type: String, default: '#ffffff' },
      text: { type: String, default: '#646464' },
      textMuted: { type: String, default: '#9ca3af' },
    }
  },

  knowledgeSources: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgeSource'
  }],

  apiKey: { type: String, trim: true },

}, { timestamps: true });

module.exports = mongoose.model('Chatbot', chatbotSchema);
