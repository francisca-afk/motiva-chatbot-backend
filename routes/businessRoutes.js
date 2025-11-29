const express = require('express');
const router = express.Router();
const { createBusiness, getBusinessById, getBusinessByUserId, updateBusiness, getBusinessChatbotSettings, updateBusinessTheme, getBusinessTheme } = require('../controllers/businessController');
const auth = require('../middleware/auth');

router.post('/', auth, createBusiness);

router.get('/:businessId', auth, getBusinessById);

router.get('/user/:userId', auth, getBusinessByUserId);

router.put('/:businessId', auth, updateBusiness);

router.get('/:businessId/chatbot-settings', getBusinessChatbotSettings);

router.patch('/:businessId/theme', auth, updateBusinessTheme);

router.get('/:businessId/theme', getBusinessTheme)

module.exports = router;
