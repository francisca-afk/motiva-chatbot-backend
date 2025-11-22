//chatController.js
const { generateResponseWithContext, clearMessageHistory, generateAndSaveSummary, findOrCreateSession } = require('../services/chatService');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const { summarizeConversation, shouldAnalyzeSentiment, analyzeSentiment } = require('../services/analyzer');
const { handleAlerts } = require('../services/alertService');
const { saveUserMessage, saveAssistantResponse } = require('../services/messageService');
const { validateChatRequest } = require('../middleware/validations');
const { loadChatHistory } = require('../services/chatService');
const { computeAlertDecision } = require("../services/decisionEngine");

const mongoose = require('mongoose');

const VALID_MOODS = ['positive', 'negative', 'excited', 'calm', 'frustrated', 'tired'];
const LOW_MOODS = ['frustrated', 'tired', 'negative'];

exports.generateChatResponse = async (req, res) => {
  try {
    const { businessId, message, mood, sessionId, visitorId } = req.body;

    validateChatRequest({ businessId, message, visitorId });

    const userMood = VALID_MOODS.includes(mood) ? mood : 'none';
    console.log(`Nueva consulta - Business: ${businessId}, Mood: ${userMood}, Visitor: ${visitorId}`);

    const session = await findOrCreateSession(businessId, visitorId, sessionId, message);

    await saveUserMessage(session._id, userMood, message);

    if (session.handedOff) {
      const io = req.app.get('io');
      io.to(session._id.toString()).emit('new_message', {
        sessionId: session._id.toString(),
        message: { role: 'user', content: message, createdAt: new Date() }
      });

      return res.status(200).json({
        message: 'Message sent to human agent',
        data: { sessionId: session._id, handedOff: true }
      });
    }

    const shouldAnalyze = await shouldAnalyzeSentiment(session._id, message);
    console.log(`Should analyze: ${shouldAnalyze}`);
    console.log(`User mood: ${userMood}`);

    const chatHistory = await loadChatHistory(session._id);

    let runSentiment = false;

    if (userMood === 'none') {
      const shouldAnalyze = await shouldAnalyzeSentiment(session._id, message);
      runSentiment = shouldAnalyze;
    }

    let result, sentimentData;

    if (runSentiment) {
      [result, sentimentData] = await Promise.all([
        generateResponseWithContext(businessId, message, userMood, chatHistory),
        analyzeSentiment(message)
      ]);
    } else {
      result = await generateResponseWithContext(businessId, message, userMood, chatHistory);
      sentimentData = null;
    }
    
    console.log(`Result from response:  ${result.response}`);
    console.log(`Result from sourcesUsed:  ${result.sourcesUsed}`);
    console.log(`Result from hasContext:  ${result.hasContext}`);
    console.log(`Result from confidence:  ${result.confidence}`);
    console.log(`Result from canResolve:  ${result.canResolve}`);
    console.log(`Result from reasoning:  ${result.reasoning}`);
    console.log(`Result from needsHumanIntervention:  ${result.needsHumanIntervention}`);

    const flags = {
      isLowMood: userMood !== 'none'
        ? LOW_MOODS.includes(userMood)
        : sentimentData?.isLowMood || false,
    
      aiUnresolved:
        !result.canResolve ||
        !result.hasContext ||
        result.confidence < 0.4 ||
        result.needsHumanIntervention
    };
    
    const decision = computeAlertDecision(flags, session.alertState || {});
    
    if (decision.severity !== "none") {
      await handleAlerts({
        req,
        session,
        decision,
        sentimentData,
        userMood,
        businessId,
        chatHistory,
        message,
        result
      });
    }

    await saveAssistantResponse(session._id, userMood, result, sentimentData );

    res.status(200).json({
      message: 'Response generated successfully',
      data: {
        sessionId: session._id,
        response: result.response,
        mood: userMood,
        sources: result.sourcesUsed || [],
        hasKnowledgeBase: result.hasContext || false,
        createdAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error in generateChatResponse:', error);
    res.status(500).json({
      message: 'Error generating response',
      error: error.message
    });
  }
};

exports.countMoodsBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Obtener TODOS los mensajes del user
    const messages = await ChatMessage.find({
      session: sessionId,
      role: "user"
    }).sort({ createdAt: 1 }); // ordenado para tomar el último fácil

    // Si no hay mensajes del usuario
    if (messages.length === 0) {
      return res.status(200).json({
        message: "No user moods found",
        data: {
          moodStats: {},
          lastMood: null
        }
      });
    }

    // Contar moods
    const moodStats = messages.reduce((acc, message) => {
      acc[message.mood] = (acc[message.mood] || 0) + 1;
      return acc;
    }, {});

    // El mood más reciente (último en la lista)
    const lastMood = messages[messages.length - 1].mood;

    res.status(200).json({
      message: "Moods counted successfully",
      data: {
        moodStats,
        lastMood
      }
    });

  } catch (error) {
    console.error("Error in countMoodsBySession:", error);
    res.status(500).json({ message: "Error", error: error.message });
  }
};


/**
 * Take over a session from a human agent
 */
exports.takeOverSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.user; 

    const session = await ChatSession.findByIdAndUpdate(
      sessionId,
      { 
        handedOff: true, 
        handedOffAt: new Date(),
        handedOffBy: userId 
      },
      { new: true }
    );

    const io = req.app.get('io');
    io.to(sessionId).emit('session_handed_off', { sessionId });
    console.log(sessionId, 'session taken over from controller');

    res.status(200).json({ message: 'Session taken over', data: session });
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message });
  }
};

/**
 * Get the history of a session
 */
exports.getSessionHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: 'Invalid sessionId' });
    }

    const session = await ChatSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const messages = await ChatMessage.find({
      session: sessionId,
      role: { $ne: 'system' }
    })
      .sort({ createdAt: 1 })
      .select('role content mood timestamp metadata');

    res.status(200).json({
      message: 'Session history retrieved successfully',
      data: {
        session,
        messages
      }
    });

  } catch (error) {
    console.error('❌ Error getting session history:', error);
    res.status(500).json({
      message: 'Error retrieving session history',
      error: error.message
    });
  }
};

exports.generateSummaryConversation = async (req, res) => {
  try {
    console.log('Generating summary conversation...');
    const { sessionId } = req.params;
    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    const messages = await ChatMessage.find({ session: sessionId })
      .sort({ timestamp: 1 })
      .select('role content mood timestamp metadata');

    const summary = await summarizeConversation(messages);
    console.log('Summary:', summary);
    session.summary = {
      businessInsights: summary.businessInsights,
      recommendations: summary.recommendations,
      summary: summary.summary
    };
    await session.save();
    res.status(200).json({ message: 'Summary conversation generated successfully', data: session.summary });
  }
  catch (error) {
    console.error('❌ Error generating summary conversation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

/**
 * Email the summary of a conversation to a business team
 */
exports.emailConversationSummary = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email } = req.body;

    const session = await ChatSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.summary) {
      return res.status(200).json({ 
        message: 'Conversation summary retrieved successfully', 
        data: { session, messages: session.summary } 
      });
    }

    const messages = await ChatMessage.find({ session: sessionId }).sort({ createdAt: 1 });

    const summary = await summarizeConversation(messages);

    session.summary = {
      businessInsights: summary.businessInsights,
      recommendations: summary.recommendations,
      summary: summary.summary
    };

    await session.save();

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email || session.business.alertEmail,
      subject: `Chat Summary - ${session.business.name}`,
      text: summary
    });

    res.status(200).json({ message: 'Email summary sent successfully' });
  } catch (error) {
    console.error('❌ Error sending summary email:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}
/** get the summary of a conversation for a business team
 * - Business insights
 * - Recommendations
 * - Summary
 */

exports.getConversationSummary = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await ChatSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const hasSummaryContent = session.summary && Object.values(session.summary).some(
      v => v && v.trim && v.trim() !== ""
    );

    if (hasSummaryContent) {
      return res.status(200).json({
        message: "Conversation summary retrieved successfully",
        data: { session, messages: session.summary },
      });
    }
    else{
      return res.status(204).json({
        message: "No summary content found",
        data: { session, messages: [] },
      });
    }
    /*
    const messages = await ChatMessage.find({ session: sessionId })
      .sort({ timestamp: 1 })
      .select('role content mood timestamp metadata');

    const summary = await summarizeConversation(messages);

    console.log('Summary:', summary);
    
    session.summary = {
      businessInsights: summary.businessInsights,
      recommendations: summary.recommendations,
      summary: summary.summary
    };
    await session.save();

    res.status(200).json({ 
      message: 'Conversation summary retrieved successfully', 
      data: { session, messages: session.summary } 
    });
    */
  } catch (error) {
    console.error('❌ Error fetching conversation summary:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

/**
 * Get the conversations of a business
 */
exports.getBusinessConversations = async (req, res) => {
  try {
    const { businessId } = req.params;
    if (!businessId) return res.status(400).json({ message: 'businessId required' });

    const sessions = await ChatSession.find({ business: businessId })
      .populate('business', 'name')
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({ message: 'Conversations retrieved successfully', data: { count: sessions.length, sessions } });
  } catch (error) {
    console.error(' Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}


/**
 * Get business summary metrics
 * - Total sessions
 * - Total messages
 * - Average messages per session
 * - Session status distribution
 * - Mood distribution
 * - Action distribution
 * - Negative rate
 * - Recent sessions
 */
exports.getBusinessSummaryConversations = async (req, res) => {
  try {
    const { businessId } = req.params;

    const sessions = await ChatSession.find({ business: businessId });
    const sessionIds = sessions.map(s => s._id);

    const totalSessions = sessions.length;
    const totalMessages = await ChatMessage.countDocuments({ session: { $in: sessionIds } });

    const sessionStatus = await ChatSession.aggregate([
      { $match: { business: new mongoose.Types.ObjectId(businessId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Moods distribution
    const moodStats = await ChatMessage.aggregate([
      { $match: { session: { $in: sessionIds } } },
      { $group: { _id: "$mood", count: { $sum: 1 } } },
    ]);

    // Actions executed
    const actionStats = await ChatMessage.aggregate([
      { $match: { session: { $in: sessionIds } } },
      { $unwind: "$actions" },
      { $group: { _id: "$actions", count: { $sum: 1 } } },
    ]);

    // Negative message percentage
    const totalNegatives = moodStats.find(m => m._id === "negative" || m._id === "frustrated")?.count || 0;
    const negativeRate = totalMessages > 0 ? (totalNegatives / totalMessages) * 100 : 0;

    // Average messages per session
    const avgMessagesPerSession = totalSessions > 0 ? totalMessages / totalSessions : 0;

    // Recent sessions (last 7 days)
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const recentSessions = await ChatSession.countDocuments({
      business: businessId,
      updatedAt: { $gte: last7Days },
    });

    res.status(200).json({
      businessId,
      totalSessions,
      totalMessages,
      avgMessagesPerSession: avgMessagesPerSession.toFixed(2),
      sessionStatus,
      moodStats,
      actionStats,
      negativeRate: negativeRate.toFixed(2),
      recentSessions,
    });
  } catch (error) {
    console.error("❌ Error fetching summary:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Get the messages of a session
 */
exports.getConversationMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await ChatMessage.find({ session: sessionId , role: { $ne: 'system' } })
      .sort({ createdAt: 1 })
      .lean();
      
    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.status(200).json({ count: messages.length, messages, session });
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

/**
 * Delete a session
 */
exports.deleteSession = async (req, res) => {
  try {
  const { sessionId } = req.params;
  const session = await ChatSession.findById(sessionId);
  if (!session) {
    return res.status(404).json({ message: 'Session not found' });
  }
  await ChatMessage.deleteMany({ session: sessionId });
  await session.deleteOne();
  res.status(200).json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting session:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

/**
 * Clear the memory history of LangChain for a session
 * (Useful for testing or when you want to force a reload from the DB)
 */
exports.clearSessionMemory = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      clearMessageHistory(); // Limpia todo
      return res.status(200).json({
        message: 'All session memories cleared'
      });
    }

    clearMessageHistory(sessionId);

    res.status(200).json({
      message: 'Session memory cleared successfully',
      data: { sessionId }
    });

  } catch (error) {
    console.error('❌ Error clearing session memory:', error);
    res.status(500).json({
      message: 'Error clearing session memory',
      error: error.message
    });
  }
};

exports.endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await ChatSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    // generate and save summary
    const generatedSummary = await generateAndSaveSummary(session);
    console.log('Generated summary:', generatedSummary);

    session.status = 'ended';
    await session.save();

    if (!generatedSummary) {
      return res.status(500).json({ message: 'Error generating summary' });
    }

    res.status(200).json({ message: 'Session ended successfully' });
  } catch (error) {
    console.error('❌ Error ending session:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}