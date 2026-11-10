// Os testes APAGAM as tabelas do banco usado. Use um banco SÓ de testes (nunca o de produção).
// Ex.: TEST_DATABASE_URL=postgresql://usuario:senha@localhost:5432/agendamento_teste npm test
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Defina TEST_DATABASE_URL com a URL de um banco PostgreSQL SÓ para testes.');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { pool, query, iniciarBanco } = require('../src/db');
const { SEGREDO } = require('../src/auth');

let servidor, base;
const tokenA = jwt.sign({ sub: 1 }, SEGREDO, { expiresIn: '1h' });
const tokenB = jwt.sign({ sub: 2 }, SEGREDO, { expiresIn: '1h' });

before(async () => {
  await iniciarBanco();
  await query('TRUNCATE consultas RESTART IDENTITY');
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}`;
});
after(async () => {
  servidor.close();
  await pool.end();
});

const req = (m, rota, corpo, tk = tokenA) =>
  fetch(base + rota, {
    method: m,
    headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
const consulta = (id, data, status) => ({ agendamento_id: id, medico: 'Dr. João Souza', especialidade: 'Cardiologia', data_hora: data, status });

test('sem token (401) e token inválido (401)', async () => {
  assert.equal((await req('GET', '/api/historico', null, null)).status, 401);
  assert.equal((await req('GET', '/api/historico', null, 'a.b.c')).status, 401);
});

test('lista os status possíveis salvos no banco', async () => {
  const j = await (await req('GET', '/api/historico/status')).json();
  assert.deepEqual(j.sort(), ['agendada', 'cancelada', 'faltou', 'realizada']);
});

test('registra consultas (201), status padrão agendada', async () => {
  const r = await req('POST', '/api/historico', consulta(1, '2030-05-10 09:00'));
  assert.equal(r.status, 201);
  assert.equal((await r.json()).status, 'agendada');
  await req('POST', '/api/historico', consulta(2, '2030-06-01 10:00'));
  await req('POST', '/api/historico', consulta(3, '2026-03-15 10:00', 'realizada'));
  await req('POST', '/api/historico', consulta(4, '2026-04-20 08:30', 'cancelada'));
  await req('POST', '/api/historico', consulta(5, '2026-05-05 16:00', 'faltou'));
  await req('POST', '/api/historico', consulta(6, '2030-05-12 11:00'), tokenB);
});

test('agendamento repetido (409)', async () => {
  assert.equal((await req('POST', '/api/historico', consulta(1, '2030-05-10 09:00'))).status, 409);
});

test('dados inválidos (400)', async () => {
  const r = await req('POST', '/api/historico', { agendamento_id: 'x', medico: 'A', especialidade: '', data_hora: '10/05/2030', status: 'inventado' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).erros.length, 5);
});

test('lista agendadas só do próprio paciente, em ordem de data', async () => {
  const j = await (await req('GET', '/api/historico/agendadas')).json();
  assert.equal(j.length, 2);
  assert.ok(j[0].data_hora < j[1].data_hora);
  assert.ok(j.every((c) => c.paciente_id === 1 && c.status === 'agendada'));
});

test('histórico sem filtro mostra só o que não está agendada', async () => {
  const j = await (await req('GET', '/api/historico')).json();
  assert.equal(j.length, 3);
  assert.ok(j.every((c) => c.status !== 'agendada'));
});

test('filtra por status', async () => {
  const j = await (await req('GET', '/api/historico?status=realizada')).json();
  assert.equal(j.length, 1);
  assert.equal(j[0].agendamento_id, 3);
});

test('filtra por período', async () => {
  const j = await (await req('GET', '/api/historico?de=2026-04-01&ate=2026-04-30')).json();
  assert.equal(j.length, 1);
  assert.equal(j[0].status, 'cancelada');
});

test('filtros inválidos (400)', async () => {
  assert.equal((await req('GET', '/api/historico?status=xyz')).status, 400);
  assert.equal((await req('GET', '/api/historico?de=2026-13-45')).status, 400);
  assert.equal((await req('GET', '/api/historico?ate=amanha')).status, 400);
});

test('consulta o status de um agendamento', async () => {
  const j = await (await req('GET', '/api/historico/agendamentos/3/status')).json();
  assert.equal(j.status, 'realizada');
});

test('paciente não vê status de agendamento de outro (404)', async () => {
  assert.equal((await req('GET', '/api/historico/agendamentos/6/status')).status, 404);
  assert.equal((await req('GET', '/api/historico/agendamentos/999/status')).status, 404);
});

test('atualiza o status para realizada (200)', async () => {
  const r = await req('PUT', '/api/historico/agendamentos/1/status', { status: 'realizada' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'realizada');
  assert.equal((await (await req('GET', '/api/historico/agendadas')).json()).length, 1);
});

test('status inválido (400)', async () => {
  assert.equal((await req('PUT', '/api/historico/agendamentos/2/status', { status: 'xyz' })).status, 400);
});

test('consulta finalizada não volta para agendada (409)', async () => {
  assert.equal((await req('PUT', '/api/historico/agendamentos/1/status', { status: 'agendada' })).status, 409);
});

test('outro paciente não altera o status (404)', async () => {
  assert.equal((await req('PUT', '/api/historico/agendamentos/2/status', { status: 'cancelada' }, tokenB)).status, 404);
});

test('JSON malformado (400)', async () => {
  const r = await fetch(base + '/api/historico', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` }, body: '{quebrado' });
  assert.equal(r.status, 400);
});
