const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';
const app = require('../src/app');

let server;
let baseUrl;
let apiBaseUrl;
let authHeaders;
let operatorHeaders;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  apiBaseUrl = `http://127.0.0.1:${server.address().port}/api`;
  baseUrl = `${apiBaseUrl}/telemetry`;
  const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@piscialerta.com', password: 'senha123' }),
  });
  assert.equal(loginResponse.status, 200);
  const loginResult = await loginResponse.json();
  const { token } = loginResult;
  authHeaders = { authorization: `Bearer ${token}` };
  assert.equal(loginResult.user.role, 'admin');

  const operatorResponse = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'operador@piscialerta.com', password: 'senha123' }),
  });
  assert.equal(operatorResponse.status, 200);
  const { token: operatorToken } = await operatorResponse.json();
  operatorHeaders = { authorization: `Bearer ${operatorToken}` };
});

after(async () => {
  require('../src/simulator').stopSimulator();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('recebe telemetria, consulta latest/historico e rejeita payload invalido', async () => {
  let response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@piscialerta.com', password: 'incorreta' }),
  });
  assert.equal(response.status, 401);

  response = await fetch(`${baseUrl}/latest`);
  assert.equal(response.status, 401);

  response = await fetch(`${baseUrl}/latest`, { headers: authHeaders });
  assert.equal(response.status, 404);

  response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      O2: 5.2,
      pH: 7.4,
      ammonia: 0.02,
      battery: 12.6,
      relays: { mainAerator: false, backupAerator: false, siren: false },
    }),
  });
  assert.equal(response.status, 201);
  const normalResult = await response.json();
  assert.equal(normalResult.critical, false);
  assert.equal(normalResult.data.relays.backupAerator, false);
  assert.equal(normalResult.data.relays.siren, false);

  response = await fetch(`${baseUrl}/latest`, { headers: authHeaders });
  assert.equal((await response.json()).data.oxygenMgL, 5.2);

  response = await fetch(`${baseUrl}/history?period=24h&limit=10`, { headers: authHeaders });
  assert.equal((await response.json()).count, 1);

  response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ oxygenMgL: 3.2, ph: 7, ammonia: 0.01, batteryVoltage: 12 }),
  });
  assert.equal((await response.json()).critical, true);

  response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ O2: 'baixo', ph: 7, ammonia: 0.01, battery: 12 }),
  });
  assert.equal(response.status, 400);
});

test('aplica cenários críticos somente para admin e mantém comando manual subordinado à segurança', async () => {
  let response = await fetch(`${apiBaseUrl}/simulator/start`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert.equal(response.status, 200);

  response = await fetch(`${apiBaseUrl}/simulator/scenario/low-oxygen`, {
    method: 'POST',
    headers: authHeaders,
  });
  const oxygenScenario = await response.json();
  assert.equal(response.status, 201);
  assert.equal(oxygenScenario.data.oxygenMgL, 2.1);
  assert.equal(oxygenScenario.data.relays.backupAerator, true);
  assert.equal(oxygenScenario.data.relays.siren, true);

  response = await fetch(`${apiBaseUrl}/simulator/scenario/low-battery`, {
    method: 'POST',
    headers: authHeaders,
  });
  const batteryScenario = await response.json();
  assert.equal(batteryScenario.data.batteryVoltage, 10.5);
  assert.equal(batteryScenario.data.batteryPercent, 15);

  response = await fetch(`${apiBaseUrl}/simulator/scenario/high-ammonia`, {
    method: 'POST',
    headers: operatorHeaders,
  });
  assert.equal(response.status, 403);

  response = await fetch(`${apiBaseUrl}/simulator/scenario/reset`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert.equal(response.status, 201);
  const resetResult = await response.json();
  assert.equal(resetResult.critical, false);
  assert.equal(resetResult.data.relays.backupAerator, false);
  assert.equal(resetResult.data.relays.siren, false);

  response = await fetch(`${apiBaseUrl}/relays/manual`, {
    method: 'POST',
    headers: { ...operatorHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ relayPin: 26, state: false }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.relays.mainAerator, false);

  response = await fetch(`${apiBaseUrl}/simulator/stop`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert.equal(response.status, 200);
});