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
    },
    apiKey: { type: String, trim: true },
  }, { 
    timestamps: true 
  });

module.exports = mongoose.model('Business', businessSchema)
