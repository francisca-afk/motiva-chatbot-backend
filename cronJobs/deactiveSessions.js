const cron = require("node-cron");
const threshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
const ChatSession = require("../models/ChatSession");

cron.schedule("*/1 * * * *", async () => {
  const inactiveSessions = await ChatSession.find({
    status: "active",
    updatedAt: { $lt: threshold }
  });
  if (inactiveSessions.length > 0) {
    console.log(`Found ${inactiveSessions.length} inactive sessions`);
  }
  for (const session of inactiveSessions) {
    try {
      session.status = "ended";
      await session.save();
      console.log(`✅ Session ${session._id} ended`);
    } catch (err) {
      console.error(`Error processing session ${session._id}:`, err);
    }
  }
});