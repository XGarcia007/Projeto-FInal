const express = require('express');
const relayController = require('../controllers/relayController');
const { allowRoles, requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/manual', requireAuth, allowRoles('admin', 'operator'), relayController.setManualRelay);

module.exports = router;