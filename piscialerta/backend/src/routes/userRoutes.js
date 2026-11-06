const express = require('express');
const userController = require('../controllers/userController');
const { requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAdmin, userController.listUsers);
router.post('/', requireAdmin, userController.createUser);
router.delete('/:id', requireAdmin, userController.deleteUser);

module.exports = router;