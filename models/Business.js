const mongoose = require('mongoose')

const businessSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    sector: { type: String, trim: true },
    description: { type: String, trim: true },
    website: { type: String, trim: true },
    logoUrl: { type: String },
    businessEmail: { type: String, trim: true },
    alertEmail: { type: String, trim: true },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
  
    chatbotSettings: {
      welcomeMessage: { type: String, default: 'Hi! How can I help you today?' },
      offlineMessage: { type: String, default: 'We\'re currently offline. Leave a message!' },
      theme: {
        primary: { type: String, default: '#b9d825' },
        secondary: { type: String, default: '#7d3f97'},
        background: { type: String, default: '#f2f6f8e8'},
        backgroundField: { type: String, default: '#ffffff'},
        text: { type: String, default: '#646464' },
        textMuted: { type: String, default: '#9ca3af'},
        updatedAt: { type: Date, default: Date.now }
      }
    },
    apiKey: { type: String, trim: true },
  }, { 
    timestamps: true 
  });

module.exports = mongoose.model('Business', businessSchema)
