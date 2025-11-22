const mongoose = require('mongoose');

const knowledgeSourceSchema = new mongoose.Schema({
    businessId: {
      // Reference to the business owning the knowledge
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true
    },
  
    title: {
      type: String,
      required: true,
      trim: true
    },
  
    description: {
      type: String,
      trim: true,
      default: ''
    },
  
    sourceType: {
      // Classification of the content type
      type: String,
      enum: ['document', 'url', 'faq', 'manual', 'dataset', 'note'],
      default: 'document'
    },
  
    fileUrl: {
      // Location of the file in S3 / GCS / local
      type: String,
      default: ''
    },
  
    fileName: {
      type: String,
      trim: true
    },
  
    embedding: {
      // Vector of the document or fragment — optional
      type: [Number],
      select: false // Not included by default in queries
    },
  
    externalVectorId: {
      // In case we migrate to Pinecone / Weaviate / Qdrant / etc.
      type: String,
      default: null,
      index: true
    },
  
    chunkCount: {
      // For documents divided into fragments (chunking)
      type: Number,
      default: 0
    },
  
    metadata: {
      // Contextual data: author, language, model, category, etc.
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },
  
    tags: [{
      type: String,
      trim: true
    }],
  }, { 
    timestamps: true 
  });

// Middleware to update updatedAt
knowledgeSourceSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

knowledgeSourceSchema.index({ businessId: 1, createdAt: -1 });
knowledgeSourceSchema.index({ tags: 1 });
knowledgeSourceSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('KnowledgeSource', knowledgeSourceSchema)
