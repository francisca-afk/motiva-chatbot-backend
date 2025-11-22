const mongoose = require("mongoose");

const escalatedCaseSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ChatSession",
    required: true
  },

  initialMessage: { type: String, required: true },

  mood: { type: String, default: null },
  sentiment: {
    detectedMood: { type: String, default: null },
    score: { type: Number, default: null }
  },

  ai: {
    confidence: { type: Number, default: null },
    canResolve: { type: Boolean, default: null },
    hasContext: { type: Boolean, default: null },
    reasoning: { type: String, default: null }
  },

  engagementAnalysis: {
    detectedMood: { type: String, default: null },
    engagementLevel: { type: Number, default: null },
    conversationType: { type: String, default: null },
    needsIntervention: { type: Boolean, default: null },
    summary: { type: String, default: null },
    title: { type: String, default: null }
  },

  status: {
    type: String,
    enum: ["open", "in_progress", "resolved"],
    default: "open"
  },

  createdAt: { type: Date, default: Date.now },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  resolvedAt: { type: Date, default: null },
  resolutionNotes: { type: String, default: null }
});

module.exports = mongoose.model("EscalatedCase", escalatedCaseSchema);

