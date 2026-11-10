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

let servidor, base, id1, id2;
const tokenA = jwt.sign({ sub: 1 }, SEGREDO, { expiresIn: '1h' });
const tokenB = jwt.sign({ sub: 2 }, SEGREDO, { expiresIn: '1h' });

before(async () => {
  await iniciarBanco();
  await query('TRUNCATE notificacoes RESTART IDENTITY');
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

test('sem token (401) e token inválido (401)', async () => {
  assert.equal((await req('GET', '/api/notificacoes', null, null)).status, 401);
  assert.equal((await req('GET', '/api/notificacoes', null, 'a.b.c')).status, 401);
});

test('cria notificação (201) para o paciente do token', async () => {
  const r = await req('POST', '/api/notificacoes', { tipo: 'lembrete', mensagem: 'Consulta amanhã às 09:00' });
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.equal(j.paciente_id, 1);
  assert.equal(j.lida, false);
  assert.ok(j.enviada_em);
  assert.equal(j.excluida, undefined);
  id1 = j.id;
});

test('cria notificação para outro paciente informando paciente_id', async () => {
  const r = await req('POST', '/api/notificacoes', { tipo: 'cancelamento', mensagem: 'Sua consulta foi cancelada', paciente_id: 2 });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).paciente_id, 2);
});

test('segunda notificação do paciente 1', async () => {
  const r = await req('POST', '/api/notificacoes', { tipo: 'alteracao', mensagem: 'Horário alterado para 10:00' });
  id2 = (await r.json()).id;
  assert.equal(r.status, 201);
});

test('dados inválidos (400)', async () => {
  const r = await req('POST', '/api/notificacoes', { tipo: 'spam', mensagem: 'a', paciente_id: 'x' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).erros.length, 3);
});

test('lista só as notificações do próprio paciente', async () => {
  assert.equal((await (await req('GET', '/api/notificacoes')).json()).length, 2);
  assert.equal((await (await req('GET', '/api/notificacoes', null, tokenB)).json()).length, 1);
});

test('marca como lida (200) e filtra por lida', async () => {
  const r = await req('PUT', `/api/notificacoes/${id1}/lida`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).lida, true);
  assert.equal((await (await req('GET', '/api/notificacoes?lida=0')).json()).length, 1);
  assert.equal((await (await req('GET', '/api/notificacoes?lida=1')).json()).length, 1);
});

test('filtro lida inválido (400)', async () => {
  assert.equal((await req('GET', '/api/notificacoes?lida=talvez')).status, 400);
});

test('outro paciente não marca nem exclui (404)', async () => {
  assert.equal((await req('PUT', `/api/notificacoes/${id1}/lida`, null, tokenB)).status, 404);
  assert.equal((await req('DELETE', `/api/notificacoes/${id1}`, null, tokenB)).status, 404);
});

test('notificação inexistente (404)', async () => {
  assert.equal((await req('PUT', '/api/notificacoes/999/lida')).status, 404);
});

test('exclui (204), some da lista, mas o registro de envio continua no banco', async () => {
  assert.equal((await req('DELETE', `/api/notificacoes/${id2}`)).status, 204);
  assert.equal((await (await req('GET', '/api/notificacoes')).json()).length, 1);
  assert.equal((await req('DELETE', `/api/notificacoes/${id2}`)).status, 404);
  assert.equal((await query('SELECT COUNT(*)::int AS n FROM notificacoes')).rows[0].n, 3);
});

test('JSON malformado (400)', async () => {
  const r = await fetch(base + '/api/notificacoes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` }, body: '{quebrado' });
  assert.equal(r.status, 400);
});
