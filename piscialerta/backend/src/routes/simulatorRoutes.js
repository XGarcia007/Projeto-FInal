const express = require('express');
const simulatorController = require('../controllers/simulatorController');
const { allowRoles, requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const adminOnly = [requireAuth, allowRoles('admin')];

router.get('/status', ...adminOnly, simulatorController.status);
router.post('/start', ...adminOnly, simulatorController.start);
router.post('/stop', ...adminOnly, simulatorController.stop);
router.post('/scenario/low-oxygen', ...adminOnly, simulatorController.lowOxygen);
router.post('/scenario/high-ammonia', ...adminOnly, simulatorController.highAmmonia);
router.post('/scenario/low-battery', ...adminOnly, simulatorController.lowBattery);
router.post('/scenario/reset', ...adminOnly, simulatorController.reset);

module.exports = router;