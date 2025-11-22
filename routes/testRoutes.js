const express = require('express');
const router = express.Router();
const { sendLowMoodAlert } = require('../services/actionService');

router.post('/test-email', async (req, res) => {
  try {
    console.log('🔍 Test email request received:', req.body);
    const testData = {
      businessId: req.body?.businessId || '6903cc064231421322766698',
      sessionId: 'test-session-123',
      userMessage: 'This is a test message to verify email functionality',
      sentimentData: {
        score: -2.5,
        detectedMood: 'very-negative',
        isLowMood: true
      }
    };

    console.log('📧 Sending test email...');
    const result = await sendLowMoodAlert(
      testData.businessId,
      testData.sessionId,
      testData.userMessage,
      testData.sentimentData
    );

    res.status(200).json({
      message: result ? 'Test email sent successfully' : 'Failed to send email',
      success: result,
      testData
    });

  } catch (error) {
    console.error('❌ Test email error:', error);
    res.status(500).json({
      message: 'Error sending test email',
      error: error.message
    });
  }
});

module.exports = router;