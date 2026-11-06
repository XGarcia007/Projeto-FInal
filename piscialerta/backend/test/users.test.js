const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';
const app = require('../src/app');

let server;
let apiBaseUrl;
let adminHeaders;
let operatorHeaders;

async function login(email, password) {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { response, body: await response.json() };
}

async function createUser(body) {
  return fetch(`${apiBaseUrl}/users`, {
    method: 'POST',
    headers: { ...adminHeaders, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  apiBaseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const admin = await login('admin@piscialerta.com', 'senha123');
  const operator = await login('operador@piscialerta.com', 'senha123');
  assert.equal(admin.response.status, 200);
  assert.equal(operator.response.status, 200);
  adminHeaders = { authorization: `Bearer ${admin.body.token}` };
  operatorHeaders = { authorization: `Bearer ${operator.body.token}` };
});

after(async () => {
  require('../src/simulator').stopSimulator();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('protege gestão de usuários e não expõe hashes de senha', async () => {
  let response = await fetch(`${apiBaseUrl}/users`);
  assert.equal(response.status, 401);

  response = await fetch(`${apiBaseUrl}/users`, { headers: operatorHeaders });
  assert.equal(response.status, 403);

  response = await fetch(`${apiBaseUrl}/users`, { headers: adminHeaders });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.data.length >= 2);
  assert.ok(result.data.every((user) => !('passwordHash' in user) && !('password' in user)));

  response = await fetch(`${apiBaseUrl}/users`, {
    method: 'POST',
    headers: { ...operatorHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ nome: 'Acesso indevido', email: 'blocked@example.com', senha: 'senha123', role: 'ADMIN' }),
  });
  assert.equal(response.status, 403);
});

test('cadastra, valida duplicidade e revoga a conta removida', async () => {
  let response = await createUser({
    nome: 'Operador de Teste',
    email: 'novo.operador@example.com',
    senha: 'senha-segura-123',
    role: 'OPERADOR',
  });
  assert.equal(response.status, 201);
  const { data: user } = await response.json();
  assert.equal(user.role, 'OPERADOR');
  assert.equal(user.email, 'novo.operador@example.com');
  assert.ok(!('passwordHash' in user));

  response = await createUser({
    nome: 'Duplicado',
    email: 'NOVO.OPERADOR@example.com',
    senha: 'senha-segura-123',
    role: 'OPERADOR',
  });
  assert.equal(response.status, 409);

  const createdLogin = await login(user.email, 'senha-segura-123');
  assert.equal(createdLogin.response.status, 200);
  const createdHeaders = { authorization: `Bearer ${createdLogin.body.token}` };
  response = await fetch(`${apiBaseUrl}/relays/manual`, {
    method: 'POST',
    headers: { ...createdHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ relayPin: 26, state: true }),
  });
  assert.equal(response.status, 503);

  response = await fetch(`${apiBaseUrl}/users/${user.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(response.status, 204);

  response = await fetch(`${apiBaseUrl}/users`, { headers: createdHeaders });
  assert.equal(response.status, 401);
  const removedLogin = await login(user.email, 'senha-segura-123');
  assert.equal(removedLogin.response.status, 401);
});

test('impede remover o próprio administrador e rejeita dados inválidos', async () => {
  const listing = await fetch(`${apiBaseUrl}/users`, { headers: adminHeaders });
  const result = await listing.json();
  const admin = result.data.find((user) => user.id === 'user-admin');
  const response = await fetch(`${apiBaseUrl}/users/${admin.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(response.status, 400);

  const invalidResponse = await createUser({ nome: '', email: 'inválido', senha: '123', role: 'ROOT' });
  assert.equal(invalidResponse.status, 400);
});