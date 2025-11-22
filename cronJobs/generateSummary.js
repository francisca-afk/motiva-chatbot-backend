const cron = require("node-cron");
const ChatSession = require("../models/ChatSession");
const { generateAndSaveSummary } = require("../services/chatService");

cron.schedule("*/1 * * * *", async () => {
  console.log("Checking inactive sessions...");

  
  try {
    const inactiveSessions = await ChatSession.find({
      status: "inactive"
    });

    if (inactiveSessions.length > 0) {
      console.log(`Found ${inactiveSessions.length} inactive sessions`);
    }

    for (const session of inactiveSessions) {
      try {
        await generateAndSaveSummary(session);
        console.log(`✅ Session ${session._id} summary generated`);
      } catch (err) {
        console.error(`Error processing session ${session._id}:`, err);
      }
    }
  } catch (err) {
    console.error("Error running summary cron:", err);
  }
});