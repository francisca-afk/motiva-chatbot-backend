// ragService.js
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { SimpleMemoryVectorStore } = require("./inMemoryVectorStore");
const KnowledgeSource = require("../models/KnowledgeSource");
const path = require("path");
const fs = require("fs");

const openAIApiKey = process.env.OPENAI_API_KEY;
if (!openAIApiKey) throw new Error("❌ OpenAI API key not provided");

const embeddings = new OpenAIEmbeddings({
  openAIApiKey,
  model: "text-embedding-3-small",
});


// Cargar documento PDF
const loadDocument = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) throw new Error("File not found");
    const loader = new PDFLoader(filePath, { splitPages: false });
    const docs = await loader.load();
    console.log("Documento cargado:", docs.length, "página(s)");
    return docs;
  } catch (err) {
    console.error("Error loading document:", err.message);
    throw new Error("Failed to load document");
  }
};

// Dividir documentos en chunks
const splitDocuments = async (docs, chunkSize = 1000, chunkOverlap = 150) => {
  try {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
    const splitDocs = await splitter.splitDocuments(docs);
    console.log("Documento dividido en", splitDocs.length, "chunks");
    return splitDocs;
  } catch (err) {
    console.error("❌ Error splitting documents:", err.message);
    throw new Error("Failed to split documents");
  }
};

// Crear vector store
const createVectorStore = async (splitDocs) => {
  try {
    const store = new SimpleMemoryVectorStore(embeddings);
    await store.addDocuments(splitDocs);
    console.log("Vector store creado con", splitDocs.length, "chunks");
    return store;
  } catch (err) {
    console.error("Error creating vector store:", err.message);
    throw new Error("Failed to create vector store");
  }
};

// Cache in memory of the vector stores by businessId
const vectorStoreCache = new Map();

/**
 * Load or retrieve the vector store for a businessId
 */
const getVectorStoreForBusiness = async (businessId) => {
  // If it's already in cache, return it
  if (vectorStoreCache.has(businessId)) {
    console.log(`Vector store retrieved from cache for business ${businessId}`);
    return vectorStoreCache.get(businessId);
  }

  console.log(`Loading documents for business ${businessId}...`);

  // Search all processed documents for this business
  const knowledgeSources = await KnowledgeSource.find({
    businessId,
    tags: "embedded", // Only processed documents
  });

  if (!knowledgeSources || knowledgeSources.length === 0) {
    console.log(`No processed documents found for business ${businessId}`);
    return null;
  }

  console.log(`Found ${knowledgeSources.length} processed documents`);

  // Load all documents and combine them
  const allSplitDocs = [];

  for (const knowledge of knowledgeSources) {
    const filePath = path.resolve(knowledge.fileUrl);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }

    try {
      const docs = await loadDocument(filePath);
      const splitDocs = await splitDocuments(docs);
      
      // Add additional metadata to each chunk
      splitDocs.forEach(doc => {
        doc.metadata = {
          ...doc.metadata,
          sourceTitle: knowledge.title,
          sourceId: knowledge._id.toString(),
        };
      });
      
      allSplitDocs.push(...splitDocs);
    } catch (error) {
      console.error(`Error loading document ${knowledge.title}:`, error.message);
    }
  }

  if (allSplitDocs.length === 0) {
    console.log(`No chunks could be loaded for business ${businessId}`);
    return null;
  }

  console.log(`Total chunks loaded: ${allSplitDocs.length}`);

  // Create the vector store with all documents
  const vectorStore = await createVectorStore(allSplitDocs);

  // Save in cache
  vectorStoreCache.set(businessId, vectorStore);

  return vectorStore;
}


const getRAGContext = async (businessId, userMessage) => {
  try {
    console.log("🔎 Searching RAG context");

    const vectorStore = await getVectorStoreForBusiness(businessId);

    if (!vectorStore) {
      return { context: "", sourcesUsed: [], ragConfidence: 0 };
    }

    // --- SAFE similaritySearchWithScore ---
    let results;
    try {
      results = await vectorStore.similaritySearchWithScore(userMessage, 3);
    } catch (err) {
      console.error("❌ similaritySearchWithScore error:", err);
      return { context: "", sourcesUsed: [], ragConfidence: 0 };
    }

    // Enforce array
    if (!Array.isArray(results) || results.length === 0) {
      return { context: "", sourcesUsed: [], ragConfidence: 0 };
    }

    const safeResults = results.filter(
      (r) => Array.isArray(r) && r.length >= 2 && r[0] && typeof r[1] === "number"
    );

    if (safeResults.length === 0) {
      console.warn("⚠️ No valid results found in similaritySearchWithScore()");
      return { context: "", sourcesUsed: [], ragConfidence: 0 };
    }

    const scores = safeResults.map((r) => r[1]);

    // FAISS: less score = more similar
    const maxScore = Math.max(...scores);
    const normalizedConfidence = Math.max(0, 1 - maxScore);

    const CONFIDENCE_THRESHOLD = 0.55;

    // Low confidence -> no send context
    if (normalizedConfidence < CONFIDENCE_THRESHOLD) {
      return { context: "", sourcesUsed: [], ragConfidence: normalizedConfidence };
    }

    // Build context + sources
    const sourcesUsed = [];
    const context = safeResults
      .map(([doc, score], i) => {
        const source = doc.metadata?.sourceTitle || "Documento sin título";
        sourcesUsed.push(source);
        return `[Source ${i + 1}: ${source} | score: ${score.toFixed(4)}]\n${doc.pageContent}`;
      })
      .join("\n\n---\n\n");

    return {
      context,
      sourcesUsed: [...new Set(sourcesUsed)],
      ragConfidence: normalizedConfidence,
    };

  } catch (error) {
    console.error("❌ Error en RAG:", error);
    return { context: "", sourcesUsed: [], ragConfidence: 0 };
  }
};



const clearVectorStoreCache = async (businessId) => {
  try {
    if (businessId) {
      vectorStoreCache.delete(businessId);
      console.log(`Vector store cache cleared for business ${businessId}`);
    }
    vectorStoreCache.clear();
    console.log(`Vector store cache cleared`);
  } catch (error) {
    console.error("Error clearing vector store cache:", error.message);
    throw new Error("Failed to clear vector store cache");
  }
}

module.exports = {
  loadDocument,
  splitDocuments,
  createVectorStore,
  clearVectorStoreCache,
  getRAGContext
}