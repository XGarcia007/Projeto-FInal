const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const passwordHash = '$2a$10$tfcRsHoopsx9JdMJTiVPIeuRgEXY/3MoaeBKcFosxmeczG8BfJ.ri';
const users = [
  {
    id: 'user-admin',
    name: 'Marina Costa',
    email: 'admin@piscialerta.com',
    passwordHash,
    role: 'admin',
    roleLabel: 'Proprietária',
    avatar: '/assets/avatar-owner.svg',
    permissions: ['monitor', 'control', 'manage', 'simulate'],
  },
  {
    id: 'user-operator',
    name: 'Rafael Mendes',
    email: 'operador@piscialerta.com',
    passwordHash,
    role: 'operator',
    roleLabel: 'Operador',
    avatar: '/assets/avatar-operator.svg',
    permissions: ['monitor', 'control'],
  },
];

async function login(req, res) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'gere_uma_chave_aleatoria_com_pelo_menos_32_bytes') {
    return res.status(503).json({ error: 'Autenticacao indisponivel: configure JWT_SECRET com pelo menos 32 caracteres.' });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = users.find((candidate) => candidate.email === email);
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!passwordMatches) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const profile = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: user.roleLabel,
    avatar: user.avatar,
    permissions: user.permissions,
  };
  const token = jwt.sign(profile, secret, { expiresIn: '8h', issuer: 'piscialerta-api' });
  return res.json({ token, expiresIn: 28800, user: profile });
}

module.exports = { login, users };