const { VectorStore } = require("@langchain/core/vectorstores");

class SimpleMemoryVectorStore extends VectorStore {
  constructor(embeddings) {
    super(embeddings);
    this.documents = [];
    this.vectors = [];
  }

  async addDocuments(documents) {
    const texts = documents.map((d) => d.pageContent || "");
    const vectors = await this.embeddings.embedDocuments(texts);
    await this.addVectors(vectors, documents);
  }

  async addVectors(vectors, documents) {
    this.vectors.push(...vectors);
    this.documents.push(...documents);
  }

  async similaritySearchVectorWithScore(queryVector, k) {
    const scored = this.vectors.map((v, i) => ({
      doc: this.documents[i],
      score: cosineSimilarity(v, queryVector),
    }));
    return scored.sort((a, b) => b.score - a.score).slice(0, k);
  }

  async similaritySearch(query, k = 4) {
    const qVec = await this.embeddings.embedQuery(query);
    const results = await this.similaritySearchVectorWithScore(qVec, k);
    return results.map((r) => r.doc);
  }

  _vectorstoreType() {
    return "simple_memory";
  }
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (normA * normB);
}

module.exports = { SimpleMemoryVectorStore };

