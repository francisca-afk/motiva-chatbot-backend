const { ChatOpenAI } = require("@langchain/openai");
const { StructuredOutputParser } = require("@langchain/core/output_parsers");
const { PromptTemplate } = require("@langchain/core/prompts");
const Sentiment = require("sentiment");
const ChatMessage = require('../models/ChatMessage');

const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.2,
});

const sentiment = new Sentiment();

// Parser estructurado
const parser = StructuredOutputParser.fromNamesAndDescriptions({
  detectedMood: "User's real emotional state (e.g., low, frustrated, angry, calm, positive)",
  engagementLevel: "Level 1–10 (1 = disengaged, 10 = highly engaged)",
  conversationType: "Type: support, sales, complaint, inquiry, casual",
  needsIntervention: "true if human intervention is needed, false otherwise",
  title: "Brief title for the alert (max 10 words)",
  summary: "Concise narrative summary of the conversation (max 150 words) highlighting user's state, needs, and relevant context"
});

const summarizeParser = StructuredOutputParser.fromNamesAndDescriptions({
    businessInsights: "Key insights and patterns relevant to business strategy, marketing, or customer success (max 200 words)",
    recommendations: "Concrete next actions for the business (e.g., follow up, send offer, adjust pricing, improve UX) (max 150 words)",
    summary: "Clear, concise summary (max 150 words) of what happened and what matters for the business",
})

const insightsParser = StructuredOutputParser.fromNamesAndDescriptions({
  insights: "Array of 3 concise and actionable business insights extracted from the provided metrics. Each item must be 1–2 sentences.",
  recommendations: "Array of 3 clear recommendations for the business team to improve engagement, reduce negative sentiment, or increase conversion.",
  summary: "A short executive summary (max 80 words) connecting the metrics to the overall business health.",
});

const sentimentParser = StructuredOutputParser.fromNamesAndDescriptions({
  detectedMood: "User's emotional tone: must be one of [positive, negative, excited, calm, frustrated, tired, neutral]",
  score: "Numeric sentiment score from -5 to +5 as a string (e.g., '-3', '0', '4')",
  isLowMood: "String 'true' if sentiment indicates frustration, sadness, or low mood; 'false' otherwise"
});

/**
 * Analyze mood and generate narrative summary
 */
exports.analyzeMoodAndEngagement = async (
  messageHistory,
  currentMessage,
  sentimentData,
  userMood,
  result
) => {
  try {
    const formatInstructions = parser.getFormatInstructions();

    // Determinar el mood efectivo (preferir userMood si existe, de lo contrario el detectado por el analizador)
    const effectiveMood = userMood && userMood !== "none"
      ? userMood
      : sentimentData?.detectedMood || "neutral";

    const conversationContext = messageHistory
      .slice(-10)
      .map(
        (m) => `${m.role}: ${m.content} ${m.role === "user" ? `(Mood: ${m.mood || "unknown"})` : ""}`
      )
      .join("\n");

    const prompt = PromptTemplate.fromTemplate(`
      You are an **empathic AI business assistant** that monitors live chat interactions 
      to detect user mood, engagement, and the need for human intervention in real time. 

      You receive:
      - The full recent conversation
      - The latest message
      - AI response metadata (context, confidence, and resolution capability)
      - The user's self-declared mood (if available)
      - The sentiment automatically detected by an LLM
      
      Use this data to produce a business-oriented analysis.

      Provided Data:
      - userMood: ${userMood || "none"}
      - detectedMood: ${sentimentData?.detectedMood || "unknown"}
      - sentimentScore: ${sentimentData?.score ?? "N/A"}
      - isLowMood: ${sentimentData?.isLowMood ?? false}
      - hasContext: ${result.hasContext}
      - canResolve: ${result.canResolve}
      - needsHumanIntervention: ${result.needsHumanIntervention}
      - confidence: ${result.confidence}
      - reasoning: ${result.reasoning || "N/A"}

      Analyze and return:
      1. User's **emotional tone** (must align with one of ['positive','negative','excited','calm','frustrated','tired'])
      2. **Engagement level** (1–10)
      3. **Conversation type** (support, complaint, sales, feedback, inquiry)
      4. **Urgency** — true if human follow-up is needed (e.g., low confidence, canResolve=false, or low mood)
      5. **Suggested action** — one actionable step for the business (max 20 words)
      6. **Brief context summary** (5–8 sentences max)

      Focus on clarity, empathy, and practical recommendations.
      Be concise and analytical, since this will be used in real-time dashboards.

      Conversation:
      {conversation}

      Latest message:
      {currentMessage}

      {format_instructions}
    `);

    const input = await prompt.format({
      conversation: conversationContext,
      currentMessage,
      format_instructions: formatInstructions,
    });

    const modelResponse = await model.invoke(input);
    const analysis = await parser.parse(modelResponse.content);

    console.log("Live Mood Analysis:", analysis);

    return {
      ...analysis,
      effectiveMood,
      source: {
        userMood,
        sentimentDetected: sentimentData?.detectedMood,
        sentimentScore: sentimentData?.score,
        reasoning: result.reasoning,
        confidence: result.confidence,
        canResolve: result.canResolve,
        hasContext: result.hasContext,
        needsHumanIntervention: result.needsHumanIntervention,
      },
    };
  } catch (error) {
    console.error("❌ Error analyzing mood:", error);
    return {
      detectedMood: "neutral",
      engagementLevel: 5,
      conversationType: "inquiry",
      urgency: false,
      suggestedAction: "Monitor user tone; continue with empathy.",
      summary: "User seems neutral; no urgent action required.",
      source: { fallback: true },
    };
  }
};

exports.summarizeConversation = async (messageHistory) => {
    try {
      const formatInstructions = summarizeParser.getFormatInstructions();
  
      const conversationContext = messageHistory
        .map(m => `${m.role}: ${m.content} ${m.role === 'user' ? `(Mood: ${m.mood})` : ''}`)
        .join("\n");
  
      const prompt = PromptTemplate.fromTemplate(`
        You are an expert **Business & Marketing Analyst AI**. 
        Your job is to summarize a customer conversation in a way that produces **actionable insights for a business team**.
        
        ⚙️ Instructions:
        - Focus on *why the user is contacting the business*, their *real emotion*, and *what the business can learn*.
        - Identify tone, buying intent, pain points, satisfaction, or risk.
        - Generate practical insights, not fluff.
        - Think like a business strategist or CRM analyst writing a summary for a report.
  
         📊 Required analysis:
            1. Provide **business insights** derived from tone, intent, and keywords.
            2. Add **specific recommendations** that a manager or marketing team could act on.
            3. End with a **brief natural-language summary** usable in a CRM dashboard or report.
  
        🧩 Output Format:
        {format_instructions}
  
        💬 Conversation History:
        {conversation}
  
      `);
  
      const input = await prompt.format({
        conversation: conversationContext,
        format_instructions: formatInstructions,
      });
  
      const response = await model.invoke(input);
      const summary = await summarizeParser.parse(response.content);
  
      console.log("📈 Full Conversation Summary:", summary);
      return summary;
  
    } catch (error) {
      console.error("❌ Error summarizing business conversation:", error);
      return {
        businessInsights: "Limited data; unable to extract reliable insights.",
        recommendations: "Monitor user engagement; gather more context in next interaction.",
        summary: "User appears calm and curious. No urgent action required.",
      };
    }
  };  

  /**
   * Generate business insights from chat metrics
   * - Total sessions
   * - Total messages
   * - Average messages per session
   * - Session status distribution
   * - Mood distribution
   * - Action distribution
   * - Negative rate
   * - Recent sessions
   */

/**
 * Generate business insights using an LLM prompt
 */
exports.generateBusinessInsights = async (metrics) => {
  try {
    const formatInstructions = insightsParser.getFormatInstructions();

    const prompt = PromptTemplate.fromTemplate(`
      You are a **Senior Business Intelligence Analyst AI**.
      Your task is to interpret quantitative chat performance metrics and transform them into **strategic, high-value insights** for the business team.

      💡 Focus on:
      - Engagement trends
      - Emotional sentiment patterns
      - Automation efficiency (actions triggered)
      - Retention and satisfaction opportunities
      - Conversion or lead potential

      Avoid restating numbers — infer *what they mean for the business*.
      Provide concise, professional insights that can be used directly in a report or dashboard.

      📊 Metrics data:
      {metrics}

      {format_instructions}
    `);

    const input = await prompt.format({
      metrics: JSON.stringify(metrics, null, 2),
      format_instructions: formatInstructions,
    });

    const response = await model.invoke(input);
    const result = await insightsParser.parse(response.content);

    console.log("📊 Business Insights:", result);
    return result;

  } catch (error) {
    console.error("❌ Error generating business insights:", error);
    return {
      insights: [
        "Insufficient data to derive meaningful insights.",
        "Monitor user sentiment and collect more sessions.",
        "Consider improving feedback loop with human follow-up.",
      ],
      recommendations: [
        "Increase session volume for more reliable analytics.",
        "Review tone in negative interactions.",
        "Adjust chatbot responses for empathy and personalization.",
      ],
      summary: "Limited data context. Generated fallback insights to maintain reporting continuity.",
    };
  }
}

/** Layer to analyze sentiment with the LLM  */
exports.analyzeSentiment = async (message) => {
  try {
    const local = sentiment.analyze(message);
    const localScore = local.score;
    const needsLLM = localScore >= -1 && localScore <= 1;
    
    if (!needsLLM) {
      const mood = localScore > 0 ? "positive" : "negative";
      const isLowMood = localScore < 0;
      return {
        detectedMood: mood,
        score: localScore,
        isLowMood
      };
    }

    const formatInstructions = sentimentParser.getFormatInstructions();
    
    const prompt = PromptTemplate.fromTemplate(`
      You are an expert sentiment analyst. Analyze this user message for emotional tone and sentiment.

      CRITICAL RULES:
      - detectedMood MUST be one of: positive, negative, excited, calm, frustrated, tired, neutral
      - score MUST be a string number from -5 to +5 (e.g., "-3", "0", "4")
      - isLowMood MUST be the string "true" or "false"
      - Keywords like "cancelar", "renunciar", "problema", "esperar" indicate negative/frustrated mood
      - Return ONLY valid JSON, no markdown blocks

      Message: "{message}"

      {format_instructions}
    `);

    const input = await prompt.format({
      message,
      format_instructions: formatInstructions,
    });

    const response = await model.invoke(input);
    
    // Strip markdown if present
    let content = response.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    const parsed = await sentimentParser.parse(content);
    
    return {
      detectedMood: parsed.detectedMood,
      score: parseInt(parsed.score) || 0,
      isLowMood: parsed.isLowMood === "true"
    };
  } catch (error) {
    console.error("❌ Error in hybrid sentiment analysis:", error);
    
    // Better fallback based on keywords
    const lowerMessage = message.toLowerCase();
    const negativeKeywords = ['cancelar', 'renunciar', 'problema', 'esperar', 'malo', 'frustrado', 'enojado'];
    const hasNegative = negativeKeywords.some(word => lowerMessage.includes(word));
    
    return {
      detectedMood: hasNegative ? "frustrated" : "neutral",
      score: hasNegative ? -2 : 0,
      isLowMood: hasNegative
    };
  }
}

const MIN_CHARS_FOR_ANALYSIS = 10;
const MIN_MESSAGES_FOR_ANALYSIS = 1;

exports.shouldAnalyzeSentiment = async (sessionId, currentMessage) => {
  // Short messages are not worth analyzing
  if (currentMessage.trim().length < MIN_CHARS_FOR_ANALYSIS) {
    return false;
  }

  // Count previous messages in the session
  const messageCount = await ChatMessage.countDocuments({
    session: sessionId,
    role: 'user'
  });

  // If it's one of the first messages, don't analyze (no enough context)
  if (messageCount < MIN_MESSAGES_FOR_ANALYSIS) {
    return false;
  }

  return true;
}