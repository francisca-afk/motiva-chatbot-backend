const express = require('express');
const router = express.Router();
const { getAlerts, getAlertsBySession, markAlertAsRead, markAlertAsResolved, getAlertById } = require('../controllers/alertController');
const auth = require('../middleware/auth');

router.get('/business/:businessId', auth, getAlerts);

router.get('/business/:businessId/session/:sessionId', auth, getAlertsBySession);

router.put('/:alertId/mark-as-read', auth, markAlertAsRead);

router.put('/:alertId/mark-as-resolved', auth, markAlertAsResolved);

router.get('/:alertId', auth, getAlertById);

module.exports = router;