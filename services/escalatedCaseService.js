// services/escalatedCaseService.js

const EscalatedCase = require("../models/EscalatedCase");
const { analyzeMoodAndEngagement } = require("./analyzer");
const Business = require("../models/Business");
const { sendEscalationEmail } = require("./actionService"); 

async function createCase({ businessId, sessionId, message, sentimentData, userMood, result }) {
  console.log(`Creating escalated case for session ${sessionId}`);

  const caseDoc = await EscalatedCase.create({
    business: businessId,
    session: sessionId,
    initialMessage: message,
    mood: userMood !== "none" ? userMood : sentimentData?.detectedMood || null,
    sentiment: sentimentData
      ? { detectedMood: sentimentData.detectedMood, score: sentimentData.score }
      : { detectedMood: null, score: null },
    ai: {
      confidence: result.confidence,
      agentCanContinue: result.agentCanContinue,
      issueResolved: result.issueResolved,
      hasContext: result.hasContext,
      reasoning: result.reasoning
    }
  });
  caseDoc.save();
  console.log(`Escalated case created`);
  return caseDoc;
}

async function enrichCaseWithEngagement(caseDoc, chatHistory, message, sentimentData, userMood, result) {
  const analysis = await analyzeMoodAndEngagement(
    chatHistory,
    message,
    sentimentData,
    userMood,
    result
  );

  caseDoc.engagementAnalysis = {
    detectedMood: analysis.detectedMood,
    engagementLevel: analysis.engagementLevel,
    conversationType: analysis.conversationType,
    needsIntervention: analysis.needsIntervention,
    summary: analysis.summary,
    title: analysis.title
  };

  await caseDoc.save();
  return caseDoc;
}

async function notifyCaseByEmail(caseDoc, result, userMood, sentimentData, message) {
  const business = await Business.findById(caseDoc.business);
  if (!business) return false;

  return sendEscalationEmail(
    business._id,
    caseDoc.session,
    message,
    sentimentData,
    caseDoc.engagementAnalysis,
    userMood,
    result
  );
}

module.exports = {
  createCase,
  enrichCaseWithEngagement,
  notifyCaseByEmail
};

