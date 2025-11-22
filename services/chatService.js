// chatService.js
const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, SystemMessage, AIMessage } = require("@langchain/core/messages")
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
  response: "The Agent's complete response to the user (Must always be in the user language)",
  canResolve: "true if the AI can fully assist; false if human intervention is needed.",
  confidence: "Confidence level between 0 and 1 of your answer",
  reasoning: "Brief explanation of confidence level (max 60 words). Always in the business language or English if you don't have the business language",
  needsHumanIntervention: "true if the conversation needs human intervention to answer the question; false otherwise."
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
    
    const formatInstructions = responseParser.getFormatInstructions();
    /**
    const escapedFormatInstructions = formatInstructions
      .replace(/\{/g, '{{')
      .replace(/\}/g, '}}');
    */

    // Load chat history from MongoDB
    
    console.log(`Loaded ${chatHistory.length} messages from history`);

    let humanAgentAvailable = false;

    // Build messages
    const systemPromptTemplate = PromptTemplate.fromTemplate(`
      ${systemPromptContent}
      
      OUTPUT REQUIREMENTS:
      YOU MUST RESPOND ONLY WITH VALID JSON. NO TEXT BEFORE OR AFTER THE JSON OBJECT.
      
      CRITICAL JSON REQUIREMENTS:
      - Start your response with {{
      - End your response with }}
      - No markdown, no \`\`\`json blocks
      - No explanations outside the JSON
      - Even if the conversation history shows text responses, YOU must return JSON
      
        
        Decision logic for information gathering, contact handling, and resolution:

        0. Rule for Non-Problem Messages (SALUTATIONS / SMALL TALK / NO CONTENT)
          - If the user message contains no question, no problem, no request, and no actionable content (examples: “hola”, “hello”, “hi”, “buenas”, “qué tal”, emojis, or casual small talk), then:
            - Treat it as a neutral greeting.
            - Provide a short, friendly welcome aligned with the business tone.
            - Do NOT ask clarifying questions.
            - Do NOT request information.
            - Do NOT start the resolution workflow.
            - Set the JSON fields as:
              "canResolve" = true
              "needsHumanIntervention" = false
            - This message should NOT trigger alerts or escalation logic.
    
        1. Information collection (always first)
          - Before deciding "canResolve" or "needsHumanIntervention", you MUST collect enough details about the issue.
          - Ask 1–3 short, relevant questions to understand the situation from a business point of view.
            For example, for billing or service issues, ask about:
              • Which product or service is affected
              • Relevant dates or time period
              • Order ID, invoice ID, or account reference (if applicable)
              • Amount charged or type of problem (e.g. duplicated payment, missing access, wrong plan, etc.)
          - While you are still collecting information, set:
              "canResolve" = false
              "needsHumanIntervention" = false
            (the case is still in progress, not yet escalated).
    
        2. Contact information handling
          - If humanAgentAvailable = true:
                • DO NOT ask for contact information.
                • Tell the user that a representative is available and will join shortly.
                • Set:
                    "canResolve" = false
                    "needsHumanIntervention" = true
                (Because a human will handle the case immediately.)

          - If humanAgentAvailable = false:
                • If the user's contact information (email or phone) is NOT present:
                      - After clarifying questions, politely request their contact details.
                      - Keep:
                            "canResolve" = false
                            "needsHumanIntervention" = false
                      (The case cannot escalate yet.)
                
                • If contact information IS present already:
                      - Use it in reasoning.
                      - If the issue CANNOT be resolved:
                            Set:
                              "canResolve" = false
                              "needsHumanIntervention" = true
                      (The case can now be escalated.)
    
        3. Resolution vs escalation
          3.1 If you can fully solve the issue with the available information:
              - Provide a clear answer or step-by-step solution.
              - Set:
                  "canResolve" = true
                  "needsHumanIntervention" = false
    
          3.2 If you CANNOT fully solve the issue after asking clarifying questions:
              - If contact information is available (in history or just provided):
                  • Summarize the situation in a concise way so a human can understand the case quickly.
                  • Inform the user that a representative will contact them to continue the support.
                  • Set:
                      "canResolve" = false
                      "needsHumanIntervention" = true
              - If contact information is NOT available (This is mandatory):
                  • Ask for contact details.
                  • Until the user provides them, keep:
                      "canResolve" = false
                      "needsHumanIntervention" = false
                  • Once you have contact info and you still cannot resolve the issue:
                      - Summarize the case,
                      - Inform the user that a representative will reach out,
                      - Set:
                          "canResolve" = false
                          "needsHumanIntervention" = true
    
        4. General rules
          - Always base your response on the conversation context and the business knowledge base.
          - Keep responses professional, focused, and user-oriented.
          - Do NOT include any text outside the JSON block.
        
        5. IMPORTANT RULE ABOUT CLARIFYING QUESTIONS:
        - Only ask clarifying questions if they are logically necessary to solve the user's issue.
        - If the question the user is asking is already specific and the missing information cannot be inferred, AND additional details would NOT meaningfully change your ability to answer, DO NOT ask for more details.
        - If the business or knowledge base clearly lacks the type of information the user is requesting, DO NOT ask for extra details. Instead, state clearly that the information is not available.
        - If the question is ambiguous or incomplete in a way that prevents a correct answer, THEN ask 1–2 clarifying questions.
        - Your reasoning must always consider whether asking for more details would actually help produce a better answer. If not, you should avoid asking and proceed with the best possible response.


          Conversation history:
          {conversationHistory}

          Human agent available:
          {humanAgentAvailable}

          {format_instructions}
        
        `);
        const input = await systemPromptTemplate.format({
          conversationHistory: chatHistory,
          humanAgentAvailable: humanAgentAvailable,
          format_instructions: formatInstructions
        });
        
    

    console.log(`📨 Invoking LangChain with input: ${input}`);

    const aiMessage = await model.invoke(input);

    console.log(`Raw AI response: ${aiMessage.content}`);

    // Parse response
    let structuredResponse;
    try {
      structuredResponse = await responseParser.parse(aiMessage.content);
      structuredResponse.needsHumanIntervention = await parseBoolean(structuredResponse.needsHumanIntervention);
      console.log(`✅ Response parsed successfully`);
    } catch (parseError) {
      console.warn(`⚠️ Parse error, extracting JSON manually`);
      
      const jsonMatch = aiMessage.content.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                        aiMessage.content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        structuredResponse = JSON.parse(jsonStr);
        structuredResponse.canResolve = await parseBoolean(structuredResponse.canResolve);
        structuredResponse.needsHumanIntervention = await parseBoolean(structuredResponse.needsHumanIntervention);
      } else {
        structuredResponse = {
          response: aiMessage.content,
          canResolve: true,
          confidence: 0.7,
          reasoning: "Could not parse structured output, using raw response",
          needsHumanIntervention: true
        };
      }
    }

    return {
      response: structuredResponse.response || aiMessage.content,
      sourcesUsed,
      hasContext: ragConfidence > 0.5,
      ragConfidence: ragConfidence,
      canResolve: structuredResponse.canResolve !== undefined ? structuredResponse.canResolve : true,
      confidence: structuredResponse.confidence !== undefined ? Number(structuredResponse.confidence) : 0.7,
      reasoning: structuredResponse.reasoning || "Standard response",
      needsHumanIntervention: structuredResponse.needsHumanIntervention !== undefined ? structuredResponse.needsHumanIntervention : false
    };

  } catch (error) {
    console.error("❌ Error generando respuesta:", error);
    
    return {
      response: "I apologize, but I'm having technical difficulties. Please try again or contact support.",
      sourcesUsed: [],
      hasContext: false,
      ragConfidence: 0,
      canResolve: false,
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