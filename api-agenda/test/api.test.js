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
const tokenA = jwt.sign({ sub: 1 }, SEGREDO, { expiresIn: '1h' }); // paciente 1
const tokenB = jwt.sign({ sub: 2 }, SEGREDO, { expiresIn: '1h' }); // paciente 2
let espId, medId, h1, h2, h3, agId;

before(async () => {
  await iniciarBanco();
  await query('TRUNCATE agendamentos, horarios, medicos, especialidades RESTART IDENTITY CASCADE');
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

test('sem token retorna 401', async () => {
  assert.equal((await req('GET', '/api/medicos', null, null)).status, 401);
});

test('token inválido retorna 401', async () => {
  assert.equal((await req('GET', '/api/medicos', null, 'abc.def.ghi')).status, 401);
});

// ---- Especialidades ----
test('cria especialidade (201)', async () => {
  const r = await req('POST', '/api/especialidades', { nome: 'Cardiologia' });
  assert.equal(r.status, 201);
  espId = (await r.json()).id;
});
test('especialidade repetida (409)', async () => {
  assert.equal((await req('POST', '/api/especialidades', { nome: 'Cardiologia' })).status, 409);
});
test('especialidade inválida (400)', async () => {
  assert.equal((await req('POST', '/api/especialidades', { nome: 'A' })).status, 400);
});
test('lista e edita especialidade', async () => {
  const lista = await (await req('GET', '/api/especialidades')).json();
  assert.equal(lista.length, 1);
  const r = await req('PUT', `/api/especialidades/${espId}`, { nome: 'Cardiologia Geral' });
  assert.equal((await r.json()).nome, 'Cardiologia Geral');
});

// ---- Médicos ----
test('cria médico (201)', async () => {
  const r = await req('POST', '/api/medicos', { nome: 'Dr. João Souza', crm: 'SC12345', especialidade_id: espId });
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.equal(j.especialidade, 'Cardiologia Geral');
  medId = j.id;
});
test('médico com especialidade inexistente (400)', async () => {
  assert.equal((await req('POST', '/api/medicos', { nome: 'Dra. Ana', crm: 'SC999', especialidade_id: 999 })).status, 400);
});
test('CRM repetido (409)', async () => {
  assert.equal((await req('POST', '/api/medicos', { nome: 'Outro Nome', crm: 'SC12345', especialidade_id: espId })).status, 409);
});
test('busca, filtra e edita médico', async () => {
  assert.equal((await (await req('GET', `/api/medicos/${medId}`)).json()).crm, 'SC12345');
  assert.equal((await (await req('GET', `/api/medicos?especialidade_id=${espId}`)).json()).length, 1);
  const r = await req('PUT', `/api/medicos/${medId}`, { nome: 'Dr. João S. Souza' });
  assert.equal((await r.json()).nome, 'Dr. João S. Souza');
});
test('médico inexistente (404)', async () => {
  assert.equal((await req('GET', '/api/medicos/999')).status, 404);
});
test('não exclui especialidade que tem médicos (409)', async () => {
  assert.equal((await req('DELETE', `/api/especialidades/${espId}`)).status, 409);
});

// ---- Horários ----
test('cadastra horários (201)', async () => {
  const a = await req('POST', `/api/medicos/${medId}/horarios`, { data_hora: '2030-05-10 09:00' });
  assert.equal(a.status, 201); h1 = (await a.json()).id;
  h2 = (await (await req('POST', `/api/medicos/${medId}/horarios`, { data_hora: '2030-05-10 10:00' })).json()).id;
  h3 = (await (await req('POST', `/api/medicos/${medId}/horarios`, { data_hora: '2030-05-10 11:00' })).json()).id;
});
test('horário repetido (409)', async () => {
  assert.equal((await req('POST', `/api/medicos/${medId}/horarios`, { data_hora: '2030-05-10 09:00' })).status, 409);
});
test('horário com formato errado, data falsa ou no passado (400)', async () => {
  for (const d of ['10/05/2030 09:00', '2030-02-31 09:00', '2020-01-01 09:00']) {
    assert.equal((await req('POST', `/api/medicos/${medId}/horarios`, { data_hora: d })).status, 400, d);
  }
});
test('lista horários disponíveis', async () => {
  assert.equal((await (await req('GET', `/api/medicos/${medId}/horarios`)).json()).length, 3);
});

// ---- Agendamentos ----
test('solicita consulta (201)', async () => {
  const r = await req('POST', '/api/agendamentos', { horario_id: h1 });
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.equal(j.status, 'agendada');
  assert.equal(j.paciente_id, 1);
  agId = j.id;
});
test('horário ocupado some da lista de disponíveis', async () => {
  assert.equal((await (await req('GET', `/api/medicos/${medId}/horarios`)).json()).length, 2);
});
test('mesmo horário para outro paciente retorna 409', async () => {
  assert.equal((await req('POST', '/api/agendamentos', { horario_id: h1 }, tokenB)).status, 409);
});
test('mesmo horário para o mesmo paciente também retorna 409', async () => {
  assert.equal((await req('POST', '/api/agendamentos', { horario_id: h1 })).status, 409);
});
test('horário inexistente (404)', async () => {
  assert.equal((await req('POST', '/api/agendamentos', { horario_id: 999 })).status, 404);
});
test('lista só os agendamentos do próprio paciente', async () => {
  assert.equal((await (await req('GET', '/api/agendamentos')).json()).length, 1);
  assert.equal((await (await req('GET', '/api/agendamentos', null, tokenB)).json()).length, 0);
});
test('outro paciente não pode cancelar (404)', async () => {
  assert.equal((await req('PUT', `/api/agendamentos/${agId}/cancelar`, null, tokenB)).status, 404);
});
test('reagenda para horário livre', async () => {
  const r = await req('PUT', `/api/agendamentos/${agId}/reagendar`, { horario_id: h2 });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.horario_id, h2);
  assert.equal(j.status, 'agendada');
  agId = j.id; // reagendar cria um novo agendamento
});
test('horário antigo ficou livre e o novo ocupado', async () => {
  const ids = (await (await req('GET', `/api/medicos/${medId}/horarios`)).json()).map((h) => h.id);
  assert.ok(ids.includes(h1)); assert.ok(!ids.includes(h2));
});
test('reagendar para horário ocupado (409) mantém o atual', async () => {
  await req('POST', '/api/agendamentos', { horario_id: h3 }, tokenB);
  assert.equal((await req('PUT', `/api/agendamentos/${agId}/reagendar`, { horario_id: h3 })).status, 409);
  const meus = await (await req('GET', '/api/agendamentos')).json();
  assert.equal(meus.filter((a) => a.status === 'agendada').length, 1);
});
test('cancela (200) e cancelar de novo (409)', async () => {
  const r = await req('PUT', `/api/agendamentos/${agId}/cancelar`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'cancelada');
  assert.equal((await req('PUT', `/api/agendamentos/${agId}/cancelar`)).status, 409);
});
test('após cancelar, outro paciente consegue o horário', async () => {
  assert.equal((await req('POST', '/api/agendamentos', { horario_id: h2 }, tokenB)).status, 201);
});
test('não exclui médico com agendamentos (409)', async () => {
  assert.equal((await req('DELETE', `/api/medicos/${medId}`)).status, 409);
});
test('exclui médico e especialidade sem agendamentos', async () => {
  const e = (await (await req('POST', '/api/especialidades', { nome: 'Dermatologia' })).json()).id;
  const m = (await (await req('POST', '/api/medicos', { nome: 'Dra. Paula Lima', crm: 'SC77777', especialidade_id: e })).json()).id;
  await req('POST', `/api/medicos/${m}/horarios`, { data_hora: '2030-06-01 08:00' });
  assert.equal((await req('DELETE', `/api/medicos/${m}`)).status, 204);
  assert.equal((await req('DELETE', `/api/especialidades/${e}`)).status, 204);
  assert.equal((await req('DELETE', `/api/especialidades/${e}`)).status, 404);
});
test('JSON malformado (400)', async () => {
  const r = await fetch(base + '/api/especialidades', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` }, body: '{quebrado',
  });
  assert.equal(r.status, 400);
});
