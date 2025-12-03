const mongoose = require('mongoose');

const InvitationSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  email: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'chatRep', 'owner'],
    required: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  invitedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  token: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'expired'], default: 'pending' }
});

module.exports = mongoose.model('Invitation', InvitationSchema);
