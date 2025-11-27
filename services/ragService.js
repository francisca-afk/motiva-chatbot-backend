const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { SimpleMemoryVectorStore } = require("./inMemoryVectorStore");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { DocxLoader } = require("@langchain/community/document_loaders/fs/docx");
const { TextLoader } = require("@langchain/classic/document_loaders/fs/text");
const KnowledgeSource = require("../models/KnowledgeSource");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const os = require("os");

const openAIApiKey = process.env.OPENAI_API_KEY;
if (!openAIApiKey) throw new Error("❌ OpenAI API key not provided");

const embeddings = new OpenAIEmbeddings({
  openAIApiKey,
  model: "text-embedding-3-small",
});

const loadDocument = async (fileUrl) => {
  try {
    console.log(`🔽 Downloading file: ${fileUrl}`);

    // Download file
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    console.log(`📥 Response headers: ${JSON.stringify(response.headers, null, 2)}`);

    const mimetype =
      response.headers["content-type"] || "application/octet-stream";
    console.log(`📄 Mimetype detected: ${mimetype}`);

    // Create temp file
    const lowerMime = mimetype.toLowerCase();
    const extension = lowerMime.includes("pdf")
      ? "pdf"
      : lowerMime.includes("word") || lowerMime.includes("officedocument")
      ? "docx"
      : lowerMime.includes("text") || lowerMime.includes("plain")
      ? "txt"
      : "bin";

    const tempPath = path.join(os.tmpdir(), `temp_${Date.now()}.${extension}`);
    fs.writeFileSync(tempPath, response.data);
    console.log(`💾 Temp file written: ${tempPath}`);

    // Select loader
    let loader = null;

    if (lowerMime.includes("pdf")) {
      console.log("📘 Using PDFLoader");
      loader = new PDFLoader(tempPath, { splitPages: false });
    } else if (lowerMime.includes("word") || lowerMime.includes("officedocument")) {
      console.log("📗 Using DocxLoader");
      loader = new DocxLoader(tempPath);
    } else if (lowerMime.includes("text") || lowerMime.includes("plain")) {
      console.log("📙 Using TextLoader");
      loader = new TextLoader(tempPath);
    }

    // Validate loader
    if (!loader) {
      fs.unlinkSync(tempPath);
      throw new Error(`❌ Unsupported or unknown file type: ${mimetype}`);
    }

    // Load document
    const docs = await loader.load();

    console.log(`📚 Loaded ${docs.length} documents`);
    docs.forEach((d, i) => {
      console.log(`------ DOCUMENT ${i + 1} ------`);
      console.log(`Metadata: ${JSON.stringify(d.metadata, null, 2)}`);
      console.log(`Content preview: ${String(d.pageContent).slice(0, 300)}...`);
      console.log("------------------------------");
    });

    fs.unlinkSync(tempPath);
    console.log(`🧹 Temp file deleted`);

    if (docs.length === 0) {
      console.error("⚠️ WARNING: Loader returned 0 docs");
    }

    return docs;
  } catch (err) {
    console.error("❌ Error loading document:", err);
    throw new Error("Failed to load document");
  }
};


// split documents into chunks
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

// Create vector store
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
    const fileUrl = knowledge.fileUrl;

    try {
      const docs = await loadDocument(fileUrl);
      console.log(`Docs: ${docs}`);
      const splitDocs = await splitDocuments(docs);
      console.log(`Split docs: ${splitDocs}`);
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
  console.log("🔎 [RAG] Searching context…");

  try {
    //Load cached vector store
    const vectorStore = await getVectorStoreForBusiness(businessId);
    console.log("📚 [RAG] Vector store loaded:", !!vectorStore);

    if (!vectorStore) {
      console.warn("⚠️ [RAG] No vector store available for this business");
      return { context: "", sourcesUsed: [], ragConfidence: 0 };
    }

    // Retrieve top-k similar documents
    let results;
    try {
      results = await vectorStore.similaritySearchWithScore(userMessage, 5);
      console.log(`📌 [RAG] similaritySearchWithScore returned ${results.length} results`);
    } catch (err) {
      console.error("❌ [RAG] Error during similaritySearchWithScore:", err);
      return { context: "", sourcesUsed: [], ragConfidence: 0 };
    }

    if (!Array.isArray(results) || results.length === 0) {
      console.warn("⚠️ [RAG] No documents retrieved from vector store");
      return { context: "", sourcesUsed: [], ragConfidence: 0 };
    }

    // Normalize results format
    const normalized = results
      .map((entry, index) => {
        if (entry && entry.doc) {
          console.log(`   🔸 [RAG] Result #${index + 1} — doc: ${entry.doc} — score: ${entry.score}`);
          return { doc: entry.doc, score: entry.score ?? null };
        }
        console.warn(`   ⚠️ [RAG] Unexpected result format at index ${index}:`, entry);
        return null;
      })
      .filter(Boolean)
      .filter(r => r.doc);

    if (normalized.length === 0) {
      console.warn("⚠️ [RAG] All normalized results invalid");
      return { context: "", sourcesUsed: [], ragConfidence: 0 };
    }

    // Compute ragConfidence (simple cosine-to-confidence heuristic)
    let ragConfidence = 1;
    if (normalized[0].score != null) {
      ragConfidence = Math.max(0.05, 1 - normalized[0].score);
    }

    console.log("📈 [RAG] ragConfidence:", ragConfidence);

    // Build context to feed the LLM
    const sourcesUsed = [];
    const context = normalized
      .map(({ doc, score }, i) => {
        const src = doc.metadata?.sourceTitle || "Untitled source";
        sourcesUsed.push(src);

        return (
          `[Source ${i + 1}: ${src} | score: ${score ?? "none"}]\n` +
          doc.pageContent
        );
      })
      .join("\n\n---\n\n");

    console.log(`📝 [RAG] Context built with ${normalized.length} chunks`);
    console.log("📄 [RAG] Sources used:", [...new Set(sourcesUsed)]);

    return {
      context,
      sourcesUsed: [...new Set(sourcesUsed)],
      ragConfidence,
    };

  } catch (error) {
    console.error("❌ [RAG] Unexpected error:", error);
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