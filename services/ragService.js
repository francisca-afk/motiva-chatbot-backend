// ragService.js
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { SimpleMemoryVectorStore } = require("./inMemoryVectorStore");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");
const { StructuredOutputParser } = require("@langchain/core/output_parsers");
const KnowledgeSource = require("../models/KnowledgeSource");
const path = require("path");
const fs = require("fs");

const openAIApiKey = process.env.OPENAI_API_KEY;
if (!openAIApiKey) throw new Error("❌ OpenAI API key not provided");

const embeddings = new OpenAIEmbeddings({
  openAIApiKey,
  model: "text-embedding-3-small",
});

const model = new ChatOpenAI({
  openAIApiKey,
  modelName: "gpt-4o-mini",
  temperature: 0.2,
});

// Cargar documento PDF
const loadDocument = async (filePath) => {
  try {
    if (!fs.existsSync(filePath)) throw new Error("File not found");
    const loader = new PDFLoader(filePath, { splitPages: false });
    const docs = await loader.load();
    console.log("✅ Documento cargado:", docs.length, "página(s)");
    return docs;
  } catch (err) {
    console.error("❌ Error loading document:", err.message);
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
    console.log("✅ Documento dividido en", splitDocs.length, "chunks");
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
    console.log("✅ Vector store creado con", splitDocs.length, "chunks");
    return store;
  } catch (err) {
    console.error("❌ Error creating vector store:", err.message);
    throw new Error("Failed to create vector store");
  }
};

const parser = StructuredOutputParser.fromNamesAndDescriptions({
    answer: "AI's detailed response to the user's query.",
    canResolve: "true if AI can fully assist based on context; false if a human follow-up is needed.",
    confidence: "0–1 value representing AI's confidence in the answer.",
    reasoning: "Brief justification for confidence and intervention flag (max 60 words).",
    needsHumanIntervention: "true if the AI needs human intervention to answer the question; false otherwise."
})
/**
exports.query = async (store, query) => {
    try {
      console.log("Searching relevant documents...");
      const relevantDocs = await store.similaritySearch(query, 4);
      
      if (!relevantDocs || relevantDocs.length === 0) {
        console.log("No relevant documents found");
        return {
          answer: "I don't have enough information to answer. Please leave your email or phone number so we can contact you.",
          canResolve: false,
          confidence: 0,
          reasoning: "No enough context or relevant documents.",
          needsHumanIntervention: true
        };
      }
      
      console.log(`Found ${relevantDocs.length} relevant documents`);
      
      const context = relevantDocs
        .map((doc, i) => `Document ${i + 1}:\n${doc.pageContent}`)
        .join("\n\n---\n\n");
      
      const formatInstructions = parser.getFormatInstructions();
      
      const promptTemplate = PromptTemplate.fromTemplate(`
            Use the following context to answer the question.
            If you can't answer with confidence or the user explicitly asks for human help,
            set canResolve=false and ask politely for their contact media (email or phone number)
            so a representative can contact them.
            
            Context:
            {context}
            
            Question: {question}
            
            {format_instructions}
            
            IMPORTANT: You MUST respond ONLY with valid JSON matching the format above. Do not include any other text.
      `);
      
      const chain = RunnableSequence.from([
        {
          context: () => context,
          question: (input) => input.question,
          format_instructions: () => formatInstructions,
        },
        promptTemplate,
        model,
        new StringOutputParser(),
      ]);
      
      const response = await chain.invoke({ question: query });
      console.log(`Response from RAG: ${response}`);
      
      // Intenta parsear la respuesta
      let parsed;
      try {
        parsed = await parser.parse(response);
        console.log(`Parsed response from RAG:`, parsed);
      } catch (parseError) {
        console.error(" Error parsing response, attempting to extract JSON:", parseError.message);
        
        // Intenta extraer JSON de la respuesta si el LLM agregó texto adicional
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
          console.log(`Extracted JSON:`, parsed);
        } else {
          throw new Error("Could not extract valid JSON from response");
        }
      }
      
      // Valida que todas las propiedades existan
      return {
        answer: parsed.answer || "I couldn't process your request properly.",
        canResolve: parsed.canResolve !== undefined ? parsed.canResolve : false,
        confidence: parsed.confidence !== undefined ? parsed.confidence : 0,
        reasoning: parsed.reasoning || "Unable to parse response properly.",
        needsHumanIntervention: parsed.needsHumanIntervention !== undefined ? parsed.needsHumanIntervention : false
      };
      
    } catch (err) {
      console.error("❌ Error running RAG query:", err.message);
      return {
        answer: "There was an error processing your request. Please leave your contact media and we will assist you soon.",
        canResolve: false,
        confidence: 0,
        reasoning: "Error in the RAG process.",
        needsHumanIntervention: true
      };
    }
  };
*/

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

    // VALIDAR que cada resultado sea [doc, score]
    const safeResults = results.filter(
      (r) => Array.isArray(r) && r.length >= 2 && r[0] && typeof r[1] === "number"
    );

    if (safeResults.length === 0) {
      console.warn("⚠️ No valid results found in similaritySearchWithScore()");
      return { context: "", sourcesUsed: [], ragConfidence: 0 };
    }

    // Extraer scores
    const scores = safeResults.map((r) => r[1]);

    // FAISS: menor score = más cercano
    const maxScore = Math.max(...scores);
    const normalizedConfidence = Math.max(0, 1 - maxScore);

    const CONFIDENCE_THRESHOLD = 0.55;

    // Baja confianza → NO enviar contexto
    if (normalizedConfidence < CONFIDENCE_THRESHOLD) {
      return { context: "", sourcesUsed: [], ragConfidence: normalizedConfidence };
    }

    // Construir contexto + fuentes
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
    console.error("❌ Error clearing vector store cache:", error.message);
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