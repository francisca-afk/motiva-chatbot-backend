// services/alertService.js

const Alert = require("../models/Alert");
const { SEVERITY } = require("./decisionEngine");
const escalatedCaseService = require("./escalatedCaseService");

/**
 * Save alert in DB and emit by WS
 */
const sendAlert = async (io, { businessId, sessionId, messageId, type, title, details }) => {
  try {
    const alert = new Alert({
      business: businessId,
      session: sessionId,
      message: messageId || null,
      type,
      title,
      details: details || null
    });

    await alert.save();

    console.log(`Alert saved (${type}): ${title}`);

    if (io) {
      const room = `business_${businessId}_alerts`;
      io.to(room).emit("new_alert", {
        id: alert._id,
        type: alert.type,
        title: alert.title,
        details: alert.details,
        sessionId: alert.session,
        createdAt: alert.createdAt
      });
      console.log(`Alert emitted to room: ${room}`);
    }

    return alert;
  } catch (error) {
    console.error("❌ Error al guardar alerta:", error);
  }
};

function formatAlertTitle(severity) {
  switch (severity) {
    case SEVERITY.CRITICAL:
      return "🚨 Critical: Low Mood + Unresolved";
    case SEVERITY.UNRESOLVED:
      return "AI Cannot Resolve";
    case SEVERITY.LOW_MOOD:
      return "Low Mood Detected";
    default:
      return "Alert";
  }
}

/**
 * Handles secondary effects of an alert decision
 */
exports.handleAlerts = async ({
  req,
  session,
  decision,
  sentimentData,
  userMood,
  businessId,
  chatHistory,
  message,
  result
}) => {
  const io = req.app.get("io");
  const { severity, shouldSendAlert, shouldSendEmail, shouldCreateCase } = decision;

  //Alert visual in dashboard
  if (shouldSendAlert && severity !== "none") {
    await sendAlert(io, {
      businessId,
      sessionId: session._id,
      type: severity,
      title: formatAlertTitle(severity),
      details: {
        userMood,
        sentiment: sentimentData || null,
        ai: {
          confidence: result.confidence,
          agentCanContinue: result.agentCanContinue,
          issueResolved: result.issueResolved,
          hasContext: result.hasContext,
          reasoning: result.reasoning
        }
      }
    });
  }

  //  Escalated case (CRITICAL)
  if (shouldCreateCase) {
    const caseDoc = await escalatedCaseService.createCase({
      businessId,
      sessionId: session._id,
      message,
      sentimentData,
      userMood,
      result
    });

    // Enrich with engagement + send email 
    const enriched = await escalatedCaseService.enrichCaseWithEngagement(
      caseDoc,
      chatHistory,
      message,
      sentimentData,
      userMood,
      result
    );

    if (shouldSendEmail) {
      await escalatedCaseService.notifyCaseByEmail(
        enriched,
        result,
        userMood,
        sentimentData,
        message
      );
    }
  }

  // Update alertState in session
  session.alertState = {
    lastAlertType: severity,
    lastAlertTimestamp: new Date(),
    emailSent: shouldSendEmail ? true : session.alertState?.emailSent
  };

  await session.save();
};

module.exports.sendAlert = sendAlert;
module.exports.formatAlertTitle = formatAlertTitle;

