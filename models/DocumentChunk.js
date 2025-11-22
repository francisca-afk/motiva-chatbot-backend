const mongoose = require('mongoose')

const documentChunkSchema = new mongoose.Schema({   
    knowledgeSource: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeSource', required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    position: { type: Number, required: true },
  });

module.exports = mongoose.model('DocumentChunk', documentChunkSchema)