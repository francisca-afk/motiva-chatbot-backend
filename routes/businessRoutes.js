const express = require('express');
const router = express.Router();
const { createBusiness, getBusinessById, getBusinessByUserId, updateBusiness } = require('../controllers/businessController');
const auth = require('../middleware/auth');

router.post('/', auth, createBusiness);

router.get('/:businessId', auth, getBusinessById);
router.get('/user/:userId', auth, getBusinessByUserId);
router.put('/:businessId', auth, updateBusiness);

module.exports = router;
