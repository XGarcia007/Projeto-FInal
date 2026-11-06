const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const { users } = require('./authController');

function safeUser(user) {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

function listUsers(_req, res) {
  return res.json({ data: users.map(safeUser) });
}

async function createUser(req, res) {
  const name = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.senha === 'string' ? req.body.senha : '';
  const requestedRole = typeof req.body?.role === 'string' ? req.body.role.trim().toUpperCase() : '';
  const role = ['ADMIN', 'OPERADOR'].includes(requestedRole) ? requestedRole : null;

  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || !role) {
    return res.status(400).json({ error: 'Informe nome, e-mail válido, senha com pelo menos 8 caracteres e perfil válido.' });
  }
  if (users.some((user) => user.email === email)) {
    return res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  if (users.some((user) => user.email === email)) {
    return res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
  }
  const user = {
    id: `user-${randomUUID()}`,
    name,
    email,
    passwordHash,
    role,
    roleLabel: role === 'ADMIN' ? 'Administrador' : 'Operador',
    avatar: role === 'ADMIN' ? '/assets/avatar-owner.svg' : '/assets/avatar-operator.svg',
    permissions: role === 'ADMIN' ? ['monitor', 'control', 'manage', 'simulate'] : ['monitor', 'control'],
  };
  users.push(user);
  return res.status(201).json({ data: safeUser(user) });
}

function deleteUser(req, res) {
  const userIndex = users.findIndex((user) => user.id === req.params.id);
  if (userIndex === -1) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (users[userIndex].id === req.user.id) {
    return res.status(400).json({ error: 'Não é permitido remover o próprio usuário.' });
  }
  users.splice(userIndex, 1);
  return res.status(204).end();
}

module.exports = { listUsers, createUser, deleteUser };