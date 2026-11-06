const express = require('express');
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/authController');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' },
});

router.post('/login', loginLimiter, authController.login);

module.exports = router;