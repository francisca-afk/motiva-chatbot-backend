const nodemailer = require('nodemailer');
const Business = require('../models/Business');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,     
      pass: process.env.SMTP_PASS      
    }
  })
  
exports.sendEscalationEmail = async (
    businessId,
    sessionId,
    userMessage,
    sentimentData,
    engagementAnalysis,
    userMood = 'none',
    result
  ) => {
    try {
      const business = await Business.findById(businessId);
      if (!business) return false;
  
      const recipientEmail = business.email || process.env.ALERT_EMAIL;
  
     
      const analysis = engagementAnalysis || {
        detectedMood: 'unknown',
        engagementLevel: 0,
        conversationType: 'unknown',
        needsIntervention: true,
        reasoning: 'No analysis available',
        summary: 'User needs assistance'
      };
  
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: recipientEmail,
        subject: `🚨 URGENT: Escalation Required - ${business.name}`,
        html: `
          <h2>🚨 Critical Case Escalation</h2>
          <p><strong>Business:</strong> ${business.name}</p>
          <p><strong>Session:</strong> <a href="${process.env.ADMIN_URL}/sessions/${sessionId}">${sessionId}</a></p>
          
          <h3>📊 Mood Analysis</h3>
          <p><strong>User Selected Mood:</strong> ${userMood || 'Not specified'}</p>
          <p><strong>AI Detected Mood:</strong> ${analysis.detectedMood}</p>
          <p><strong>Sentiment Score:</strong> ${sentimentData?.score ?? 'N/A'}</p>
          <p><strong>Engagement Level:</strong> ${analysis.engagementLevel}/10</p>
          <p><strong>Conversation Type:</strong> ${analysis.conversationType}</p>
          
          <h3>🤖 AI Response Status</h3>
          <p><strong>Agent Can Continue:</strong> ${result.agentCanContinue ? '✅ Yes' : '❌ No'}</p>
          <p><strong>Issue Resolved:</strong> ${result.issueResolved ? '✅ Yes' : '❌ No'}</p>
          <p><strong>Confidence:</strong> ${(result.confidence * 100).toFixed(0)}%</p>
          <p><strong>Has Context:</strong> ${result.hasContext ? 'Yes' : 'No'}</p>
          
          <h3>💡 AI Analysis</h3>
          <p>${analysis.summary}</p>
          <blockquote><em>${analysis.reasoning}</em></blockquote>
          
          <h3>💬 Last User Message</h3>
          <blockquote>${userMessage}</blockquote>
          
          <p><strong>Action Required:</strong> ${analysis.needsIntervention ? '🚨 Immediate follow-up needed' : 'Monitor situation'}</p>
        `
      });
  
      logAction(sessionId, 'escalatedCase', {
        email: recipientEmail,
        subject: `Escalation - ${business.name}`,
        analysis: JSON.stringify(analysis),
        triggers: JSON.stringify({
          lowMood: sentimentData?.isLowMood,
          agentCanContinue: result.agentCanContinue,
          issueResolved: result.issueResolved,
          needsHumanIntervention: result.needsHumanIntervention,
          lowConfidence: result.confidence < 0.4
        })
      });
  
      console.log('✅ Escalation email sent with full analysis');
      return true;
    } catch (error) {
      console.error('❌ Error sending escalation email:', error);
      return false;
  }
};


/**
 * Log action in the database
 */
const logAction = async (sessionId, actionType, details = {}) => {
  try {
    const ChatMessage = require('../models/ChatMessage');

    await new ChatMessage({
      session: sessionId,
      role: 'system',                
      action: actionType,       
      content: `Action triggered: ${actionType}`,
      metadata: details || {}       
    }).save();

    console.log(`📝 Action logged: ${actionType}`);
  } catch (error) {
    console.error("❌ Error logging action:", error);
  }
};