const express = require('express')
const router = express.Router();
const { generateChatResponse, 
        getSessionHistory, 
        emailConversationSummary,
        getBusinessConversations, 
        getConversationMessages, 
        getConversationSummary, 
        deleteSession, 
        takeOverSession,
        countMoodsBySession } = require('../controllers/chatController')

const auth = require('../middleware/auth');


router.post('/', generateChatResponse)

router.get('/:sessionId/history',auth,getSessionHistory)

router.post('/:sessionId/email',auth, emailConversationSummary)

router.get('/business/:businessId/conversations',auth, getBusinessConversations)

router.get('/:sessionId/messages',auth, getConversationMessages)

router.get('/:sessionId/summary',auth, getConversationSummary)

router.delete('/:sessionId/delete',auth, deleteSession)

router.post('/session/:sessionId/takeover', auth, takeOverSession)

router.get('/session/:sessionId/moods',auth, countMoodsBySession)

module.exports = router;
