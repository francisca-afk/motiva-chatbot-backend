const KnowledgeSource = require('../models/KnowledgeSource');
const fs = require('fs');
const path = require('path');
const { loadDocument, splitDocuments, createVectorStore, clearVectorStoreCache } = require('../services/ragService');
const { validateFile } = require('../validators/knowledgeValidator');
const { uploadToFirebase, deleteFromFirebase } = require('../services/firestoreService');

exports.uploadKnowledgeFile = async (req, res) => {
  try {
    const { businessId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    validateFile(file)

    const { url, fileName } = await uploadToFirebase(file, businessId);

    const knowledge = new KnowledgeSource({
      businessId,
      title: file.originalname,
      description: '',
      sourceType: 'document',
      fileUrl: url,
      fileName,
      metadata: {
        mimetype: file.mimetype,
        size: file.size,
        originalName: file.originalname,
        uploadedBy: req.user?.userId || "system"
      },
      tags: ["unprocessed"]
    });

    await knowledge.save();

    return res.status(201).json({
      message: "File uploaded successfully",
      data: knowledge
    });

  } catch (error) {
    console.error("Error uploading file:", error);
    return res
      .status(500)
      .json({ message: "Error uploading file", error: error.message });
  }
}

exports.processKnowledgeFile = async (req, res) => {
  try {
    const { knowledgeId } = req.params;

    // search the knowledge document
    const knowledge = await KnowledgeSource.findById(knowledgeId);
    if (!knowledge) {
      return res.status(404).json({ message: "Knowledge not found" });
    }

    // verify that the file exists
    const fileUrl = knowledge.fileUrl;

    // load and split the document
    const docs = await loadDocument(fileUrl);
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

    // clear vector store cache to reload with the new document
    clearVectorStoreCache(knowledge.businessId.toString());

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

    const knowledgeFiles = await KnowledgeSource.find({ businessId }).lean();

    if (!knowledgeFiles || knowledgeFiles.length === 0) {
      return res.status(200).json({
        message: "No knowledge files found",
        data: []
      });
    }

    

    return res.status(200).json({
      message: "Knowledge files retrieved successfully",
      data: knowledgeFiles,
    });

  } catch (error) {
    console.error("Error getting knowledge files:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


exports.deleteKnowledgeFile = async (req, res) => {
  try {
    const { knowledgeId } = req.params;

    const knowledge = await KnowledgeSource.findById(knowledgeId);

    if (!knowledge) {
      return res.status(404).json({ message: "Knowledge not found" });
    }

    await deleteFromFirebase(knowledge.fileUrl);

    await knowledge.deleteOne();

    return res.status(200).json({
      message: "Knowledge file deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting knowledge file:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};