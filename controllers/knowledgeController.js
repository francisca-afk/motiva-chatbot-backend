const KnowledgeSource = require('../models/KnowledgeSource');
const fs = require('fs');
const path = require('path');
const { loadDocument, splitDocuments, createVectorStore, clearVectorStoreCache } = require('../services/ragService');

exports.uploadKnowledgeFile = async (req, res) => {
  try {
    const { businessId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    console.log(req.user, 'userID uploadKnowledgeFile from controller');
    // Save the file metadata
    const knowledge = new KnowledgeSource({
      businessId,
      title: file.originalname,
      description: '',
      sourceType: 'document',
      fileUrl: path.join('uploads', file.filename),
      fileName: file.filename,
      metadata: {
        mimetype: file.mimetype,
        size: file.size,
        uploadedBy: req.user?.userId || 'system',
        originalName: file.originalname
      },
      tags: ['unprocessed']
    });

    await knowledge.save();

    res.status(201).json({
      message: 'File uploaded successfully',
      data: knowledge
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Error uploading file', error });
  }
};

exports.processKnowledgeFile = async (req, res) => {
  try {
    const { knowledgeId } = req.params;

    // search the knowledge document
    const knowledge = await KnowledgeSource.findById(knowledgeId);
    if (!knowledge) {
      return res.status(404).json({ message: "Knowledge not found" });
    }

    // verify that the file exists
    const filePath = path.resolve(knowledge.fileUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on disk" });
    }

    console.log(`📄 Processing file: ${filePath}`);

    // load and split the document
    const docs = await loadDocument(filePath);
    const splitDocs = await splitDocuments(docs);

    // create embeddings and vector store in memory
    const vectorStore = await createVectorStore(splitDocs);

    // calculate a summary of embeddings for debugging
    const sampleEmbeddings = splitDocs.slice(0, 3).map(d => d.pageContent.slice(0, 150));

    const existingMetadata = knowledge.metadata ? Object.fromEntries(knowledge.metadata) : {};

    // update the record in db    
    knowledge.chunkCount = splitDocs.length;
    knowledge.tags = ["embedded"];
    knowledge.embedding = []; // we don't save the vectors by weight, only metadata
    knowledge.metadata = {
      ...existingMetadata,
      processedAt: new Date(),
      chunksPreview: sampleEmbeddings,
    };

    await knowledge.save();

    // Limpiar caché del vector store para que se recargue con el nuevo documento
    clearVectorStoreCache(knowledge.businessId.toString());

    console.log(`✅ Processed ${splitDocs.length} chunks for ${knowledge.title}`);

    res.status(200).json({
      message: "File processed successfully",
      data: {
        knowledgeId,
        chunkCount: splitDocs.length,
        tags: knowledge.tags,
        sample: sampleEmbeddings,
      },
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({
      message: "Error processing file",
      error: error.message,
    });
  }
};

exports.getKnowledgeFiles = async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log(businessId, 'businessId getKnowledgeFiles from controller');

    const knowledgeFiles = await KnowledgeSource.find({ businessId });
    if(!knowledgeFiles) {
      console.log('No knowledge files found');
      return res.status(204).json({ message: 'No knowledge files found', data: [] });
    }
    res.status(200).json({ message: 'Knowledge files retrieved successfully', data: knowledgeFiles });
  } catch (error) {
    console.error('Error getting knowledge files:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteKnowledgeFile = async (req, res) => {
  try {
    const { knowledgeId } = req.params;
    const knowledge = await KnowledgeSource.findById(knowledgeId);
    if(!knowledge) {
      return res.status(404).json({ message: 'Knowledge not found' });
    }
    await knowledge.deleteOne();
    res.status(200).json({ message: 'Knowledge file deleted successfully' });
  } catch (error) {
    console.error('Error deleting knowledge file:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};