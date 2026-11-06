const jwt = require('jsonwebtoken');
const { users } = require('../controllers/authController');

function normalizeRole(role) {
  const normalized = String(role || '').toUpperCase();
  return normalized === 'OPERADOR' ? 'OPERATOR' : normalized;
}

function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'gere_uma_chave_aleatoria_com_pelo_menos_32_bytes') {
    return res.status(503).json({ error: 'Autenticacao indisponivel: JWT_SECRET nao configurado.' });
  }

  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Token de acesso necessario.' });
  }

  try {
    req.user = jwt.verify(match[1], secret, { issuer: 'piscialerta-api' });
    if (!users.some((user) => user.id === req.user.id)) {
      return res.status(401).json({ error: 'Conta removida ou acesso revogado.' });
    }
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Token invalido ou expirado.' });
  }
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    const role = normalizeRole(req.user?.role);
    if (role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta operacao.' });
    }
    return next();
  });
}

function allowRoles(...roles) {
  return (req, res, next) => {
    const allowedRoles = roles.map(normalizeRole);
    if (!req.user || !allowedRoles.includes(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: 'Seu perfil nao permite esta operacao.' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireAdmin, allowRoles };