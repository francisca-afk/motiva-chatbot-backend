// chatService.js
const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { StructuredOutputParser } = require("@langchain/core/output_parsers")
const { getRAGContext } = require("./ragService");
const { buildSystemPromptContent } = require("../helpers/promptBuilder"); 
const { summarizeConversation } = require("./analyzer");
const ChatMessage = require("../models/ChatMessage");
const ChatSession = require("../models/ChatSession");
const mongoose = require('mongoose');
const { parseBoolean } = require("../helpers/booleanParser");


const model = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o-mini",
  temperature: 0.3,
});

const responseParser = StructuredOutputParser.fromNamesAndDescriptions({
  response: "The agent's full response to the user (must always be in the user language).",
  agentCanContinue: "true if the AI agent can continue handling the conversation flow (asking questions, providing steps, or closing the case). false ONLY when the agent must stop because meaningful progress is no longer possible.",
  issueResolved: "true if the user's issue has been fully resolved by the AI. false if the issue is pending, incomplete, unknown, or needs clarification.",
  needsHumanIntervention: "true if the case should now be handled by a human (due to missing data, business constraints, errors, or policy limits). false otherwise.",
  confidence: "Confidence level between 0 and 1 of your answer.",
  reasoning: "Brief explanation (max 60 words) of why your confidence level is appropriate—always in the business language, or English if unknown."
});

/**
 * load chat history
 */
const loadChatHistory = async (sessionId) => {
  if (!sessionId) return [];

  const dbMessages = await ChatMessage.find({
    session: sessionId,
    role: { $ne: "system" }
  })
  .sort({ timestamp: 1 })
  .lean();

  // Normalizar formato manteniendo información limpia
  return dbMessages.map(msg => ({
    role: msg.role,             
    content: msg.content,    
    timestamp: msg.timestamp,    
    mood: msg.mood || null,      
  }));
};


/**
 * generate response with context
 */
const generateResponseWithContext = async (businessId, userMessage, mood, chatHistory) => {
  try {
    console.log(`Generating response (mood: ${mood})`);

    // Get RAG context
    const { context, sourcesUsed, ragConfidence } = await getRAGContext(businessId, userMessage);

    // Build system prompt
    const systemPromptContent = await buildSystemPromptContent(businessId, mood, context);
    const safeSystemPrompt = systemPromptContent
    .replace(/{/g, "{{")
    .replace(/}/g, "}}");
    
    const formatInstructions = responseParser.getFormatInstructions();
    const safeFormatInstructions = formatInstructions
      .replace(/{/g, "{{")
      .replace(/}/g, "}}");

    // Load chat history from MongoDB
    
    console.log(`Loaded ${chatHistory.length} messages from history`);

    let humanAgentAvailable = false;

    // Build messages
    const systemPromptTemplate = PromptTemplate.fromTemplate(`
      ${safeSystemPrompt}
      
      OUTPUT REQUIREMENTS:
      YOU MUST RESPOND ONLY WITH VALID JSON. NO TEXT BEFORE OR AFTER THE JSON OBJECT.
      
      CRITICAL JSON REQUIREMENTS:
      - Start your response with {{
      - End your response with }}
      - No markdown, no \`\`\`json blocks
      - No explanations outside the JSON
      - Even if the conversation history shows text responses, YOU must return JSON

      FIELD DEFINITIONS (CRITICAL):
        "agentCanContinue":
          - "true"  → You (the AI) can continue the conversation flow 
                      (ask questions, clarify, answer, give steps, or close the case).
          - "false" → You cannot make further useful progress. A human must take over.

        "issueResolved":
          - "true"  → The issue is fully solved.
          - "false" → The issue is NOT fully solved (still clarifying, answering, or escalating).

        "needsHumanIntervention":
          - "true"  → Escalate case to a human.
          - "false" → Keep the case with the AI.

        RELATION RULES (MUST FOLLOW):
        - If issueResolved = true  → agentCanContinue = true AND needsHumanIntervention = false
        - If needsHumanIntervention = true → agentCanContinue = false AND issueResolved = false
        - The combination (agentCanContinue = false AND needsHumanIntervention = false) is INVALID
            
        
        Decision logic for information gathering, contact handling, and resolution:

        0. Rule for Non-Problem Messages (SALUTATIONS / SMALL TALK / NO CONTENT)
          - If the user message contains no question, no problem, no request, and no actionable content
            (e.g., “hola”, “hello”, emojis, small talk):
                • Treat it as a neutral greeting.
                • Respond with a short friendly welcome.
                • Do NOT ask clarifying questions.
                • Do NOT request information.
                • Do NOT start the problem-resolution workflow.
                • Set:
                    agentCanContinue = "true"
                    issueResolved = "false"
                    needsHumanIntervention = "false"

        1. Information collection (always first)
          - If additional details are needed, ask 1–3 focused questions.
          - WHILE collecting info:
                agentCanContinue = "true"
                issueResolved = "false"
                needsHumanIntervention = "false"

        2. Contact information handling
          - If humanAgentAvailable = true:
                • Do NOT ask for contact info.
                • Inform the user a human will join.
                • Set:
                    agentCanContinue = "false"
                    issueResolved = "false"
                    needsHumanIntervention = "true"

          - If humanAgentAvailable = false:
                a) If NO contact info yet:
                    • After clarifying questions, request contact info.
                    • Continue AI workflow:
                        agentCanContinue = "true"
                        issueResolved = "false"
                        needsHumanIntervention = "false"

                b) If contact info IS available:
                    • If AI cannot fully solve the issue:
                        agentCanContinue = "false"
                        issueResolved = "false"
                        needsHumanIntervention = "true"

        3. Resolution vs escalation
          3.1 Issue fully solved by AI:
                • Provide the solution.
                • Set:
                    agentCanContinue = "true"
                    issueResolved = "true"
                    needsHumanIntervention = "false"

          3.2 Issue NOT fully solved:
                - If contact info exists:
                      agentCanContinue = "false"
                      issueResolved = "false"
                      needsHumanIntervention = "true"

                - If contact info NOT available:
                      • Ask for contact details.
                      • While waiting:
                            agentCanContinue = "true"
                            issueResolved = "false"
                            needsHumanIntervention = "false"

        4. Clarifying question rules:
          - Ask questions ONLY when logically necessary.
          - DO NOT ask for info that won’t change the answer.
          - If the knowledge base lacks the answer → clearly say so, no extra questions.
          - If ambiguous → ask up to 2 clarifying questions.

        IMPORTANT BUSINESS RULE — MUST FOLLOW:
          The AI cannot “resolve” issues that require human-driven operations such as:
          - canceling a subscription or service
          - processing refunds
          - modifying billing or invoices
          - account deletion
          - manual configuration
          - administrative or internal system changes

          For those cases:
          - The issue can NEVER be marked as resolved by the AI.
          - The AI must ALWAYS escalate once contact info is available.

          Therefore:
          issueResolved = "false"
          needsHumanIntervention = "true"
          agentCanContinue = "false"
        
        REPETITION RULE — MUST FOLLOW:
          - If the user already provided the required information (such as contact details), DO NOT repeat previous explanations.
          - Instead, give a short confirmation and proceed with the next step (summary + escalation).

          Conversation history:
          {conversationHistory}

          Human agent available:
          {humanAgentAvailable}

          {format_instructions}
        
        `);
        const input = await systemPromptTemplate.format({
          conversationHistory: chatHistory,
          humanAgentAvailable: humanAgentAvailable,
          format_instructions: safeFormatInstructions
        });
        
    

    console.log(`Invoking LangChain model`);

    const aiMessage = await model.invoke(input);

    console.log(`Raw AI response: ${aiMessage.content}`);

    // Parse response
    let structuredResponse;
    try {
      structuredResponse = await responseParser.parse(aiMessage.content);
      structuredResponse.agentCanContinue = await parseBoolean(structuredResponse.agentCanContinue);
      structuredResponse.issueResolved = await parseBoolean(structuredResponse.issueResolved);
      structuredResponse.needsHumanIntervention = await parseBoolean(structuredResponse.needsHumanIntervention);
      structuredResponse.confidence = Number(structuredResponse.confidence);
      structuredResponse.reasoning = structuredResponse.reasoning || "Standard response";
      console.log(`✅ Response parsed successfully`);
    } catch (parseError) {
      console.warn(`⚠️ Parse error, extracting JSON manually`);
      
      const jsonMatch = aiMessage.content.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                        aiMessage.content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        structuredResponse = JSON.parse(jsonStr);
        structuredResponse.agentCanContinue = await parseBoolean(structuredResponse.agentCanContinue);
        structuredResponse.issueResolved = await parseBoolean(structuredResponse.issueResolved);
        structuredResponse.needsHumanIntervention = await parseBoolean(structuredResponse.needsHumanIntervention);
      } else {
        structuredResponse = {
          response: aiMessage.content,
          agentCanContinue: true,
          issueResolved: false,
          confidence: 0.7,
          reasoning: "Could not parse structured output, using raw response",
          needsHumanIntervention: false
        };
      }
    }

    return {
      response: structuredResponse.response || aiMessage.content,
      sourcesUsed,
      hasContext: ragConfidence > 0.5,
      ragConfidence: ragConfidence,
      agentCanContinue: structuredResponse.agentCanContinue === undefined 
      ? true 
      : await parseBoolean(structuredResponse.agentCanContinue),
      issueResolved: structuredResponse.issueResolved === undefined 
          ? false 
          : await parseBoolean(structuredResponse.issueResolved),
      needsHumanIntervention:
          structuredResponse.needsHumanIntervention !== undefined
            ? await parseBoolean(structuredResponse.needsHumanIntervention)
            : false,
      confidence: structuredResponse.confidence
          ? Number(structuredResponse.confidence)
          : 0.7,
      reasoning: structuredResponse.reasoning || "Standard response"
    };

  } catch (error) {
    console.error("❌ Error generando respuesta:", error);
    
    return {
      response: "I apologize, but I'm having technical difficulties. Please try again or contact support.",
      sourcesUsed: [],
      hasContext: false,
      ragConfidence: 0,
      agentCanContinue: false,
      issueResolved: false,
      confidence: 0,
      reasoning: `Error: ${error.message}`,
      needsHumanIntervention: true
    };
  }
}
/**
 * Clear message history
 */

const clearMessageHistory = (sessionId) => {
  if (sessionId) {
    messageHistoriesStore.delete(sessionId);
    console.log(`Message history cleared for session ${sessionId}`);
  } else {
    messageHistoriesStore.clear();
    console.log(`All message histories cleared`);
  }
};

const generateAndSaveSummary = async (session) => {
  try {
    const messages = await ChatMessage.find({ session: session._id })
        .sort({ timestamp: 1 })
        .select('role content mood timestamp metadata');

    const summary = await summarizeConversation(messages);
    console.log(`Summary: ${summary}`);
    session.summary = {
      businessInsights: summary.businessInsights,
      recommendations: summary.recommendations,
      summary: summary.summary
    };
    await session.save();
    return true;
  } catch (error) {
    console.error("❌ Error generating and saving summary:", error);
    return false;
  }
}

async function findOrCreateSession(businessId, visitorId, sessionId, message) {
  let session = null;

  if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
    session = await ChatSession.findOne({
      _id: sessionId,
      business: businessId,
      status: 'active'
    });
  }

  if (!session) {
    const title = message.length > 50 ? `${message.slice(0, 47)}...` : message;
    session = await ChatSession.create({
      business: businessId,
      visitorId,
      title,
      status: 'active'
    });
    console.log(`New session created: ${session._id}`);
  } else {
    console.log(`Existing session retrieved: ${session._id}`);
    if (session.title === 'Untitled Chat' || session.title.startsWith('New Chat')) {
      session.title = message.length > 50 ? `${message.slice(0, 47)}...` : message;
      await session.save();
    }
  }

  return session;
}

module.exports = {
  generateResponseWithContext,
  clearMessageHistory,
  generateAndSaveSummary,
  findOrCreateSession,
  loadChatHistory
};