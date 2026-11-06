const express = require('express');
const telemetryController = require('../controllers/telemetryController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', telemetryController.receiveTelemetry);
router.get('/latest', requireAuth, telemetryController.getLatestTelemetry);
router.get('/history', requireAuth, telemetryController.getTelemetryHistory);

module.exports = router;