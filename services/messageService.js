const ChatMessage = require("../models/ChatMessage");

exports.saveUserMessage = async (sessionId, mood, content) => {
    const userMessage = await ChatMessage.create({
        session: sessionId,
        mood,
        role: 'user',
        content
    });
    console.log(`User message saved in MongoDB`);
    return userMessage;
}

exports.saveHumanAgentMessage = async (sessionId, content) => {
    const humanAgentMessage = await ChatMessage.create({
        session: sessionId,
        mood: 'none',
        role: 'humanAgent',
        content
    });
    console.log(`Human agent message saved in MongoDB`);
    return humanAgentMessage;
}

exports.saveAssistantResponse = async (sessionId, mood, result, sentimentData, engagementAnalysis) => {
    const metadata = {
        model: 'gpt-4o-mini',
        temperature: '0.3',
        hasKnowledgeBase: result.hasContext.toString(),
        knowledgeConfidence: result.confidence.toString(),
        agentCanContinue: result.agentCanContinue.toString(),
        issueResolved: result.issueResolved.toString(),
        needsHumanIntervention: result.needsHumanIntervention.toString(),
        reasoningByLLM: result.reasoning,
        sourcesCount: result.sourcesUsed.length.toString(),
        selectedMoodByUser: mood,
        sentiment: sentimentData ? sentimentData : null,
        engagement: engagementAnalysis ? engagementAnalysis : null
    };

    const assistantMessage = await ChatMessage.create({
        session: sessionId,
        mood,
        role: 'assistant',
        content: result.response,
        metadata
    });
    console.log(`Assistant response saved in MongoDB`);

    return assistantMessage;
}
