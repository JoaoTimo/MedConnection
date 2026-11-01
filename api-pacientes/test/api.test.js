// Os testes APAGAM as tabelas do banco usado. Use um banco SÓ de testes (nunca o de produção).
// Ex.: TEST_DATABASE_URL=postgresql://usuario:senha@localhost:5432/agendamento_teste npm test
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Defina TEST_DATABASE_URL com a URL de um banco PostgreSQL SÓ para testes.');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { pool, query, iniciarBanco } = require('../src/db');

let servidor, base, token;
const CPF1 = '529.982.247-25';
const CPF2 = '111.444.777-35';
const paciente = { nome: 'Maria Silva', email: 'Maria@Teste.com', senha: 'segredo123', telefone: '(47) 99999-1234', cpf: CPF1 };

before(async () => {
  await iniciarBanco();
  await query('TRUNCATE pacientes RESTART IDENTITY');
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}`;
});
after(async () => {
  servidor.close();
  await pool.end();
});

const req = (metodo, rota, corpo, tk) =>
  fetch(base + rota, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

test('cadastro válido retorna 201 sem expor a senha', async () => {
  const r = await req('POST', '/api/pacientes', paciente);
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.equal(j.email, 'maria@teste.com');
  assert.equal(j.cpf, '52998224725');
  assert.equal(j.senha_hash, undefined);
  assert.equal(j.senha, undefined);
});

test('e-mail duplicado retorna 409', async () => {
  const r = await req('POST', '/api/pacientes', { ...paciente, cpf: CPF2 });
  assert.equal(r.status, 409);
});

test('CPF duplicado retorna 409', async () => {
  const r = await req('POST', '/api/pacientes', { ...paciente, email: 'outro@teste.com' });
  assert.equal(r.status, 409);
});

test('campos inválidos retornam 400 com lista de erros', async () => {
  const r = await req('POST', '/api/pacientes', { nome: 'A', email: 'x', senha: '123', cpf: '111.111.111-11' });
  assert.equal(r.status, 400);
  const j = await r.json();
  assert.equal(j.erros.length, 4);
});

test('JSON malformado retorna 400', async () => {
  const r = await fetch(base + '/api/pacientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{quebrado' });
  assert.equal(r.status, 400);
});

test('login com senha errada retorna 401', async () => {
  const r = await req('POST', '/api/auth/login', { email: 'maria@teste.com', senha: 'errada' });
  assert.equal(r.status, 401);
});

test('login correto retorna token', async () => {
  const r = await req('POST', '/api/auth/login', { email: 'MARIA@teste.com', senha: 'segredo123' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.token);
  token = j.token;
});

test('perfil sem token retorna 401', async () => {
  assert.equal((await req('GET', '/api/pacientes/me')).status, 401);
});

test('perfil com token inválido retorna 401', async () => {
  assert.equal((await req('GET', '/api/pacientes/me', null, 'abc.def.ghi')).status, 401);
});

test('GET perfil com token retorna os dados', async () => {
  const r = await req('GET', '/api/pacientes/me', null, token);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).nome, 'Maria Silva');
});

test('PUT atualiza só os campos enviados', async () => {
  const r = await req('PUT', '/api/pacientes/me', { nome: 'Maria S. Souza', telefone: '47988887777' }, token);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.nome, 'Maria S. Souza');
  assert.equal(j.telefone, '47988887777');
  assert.equal(j.email, 'maria@teste.com');
});

test('PUT com CPF de outro paciente retorna 409', async () => {
  await req('POST', '/api/pacientes', { ...paciente, email: 'joao@teste.com', cpf: CPF2, nome: 'João Lima' });
  const r = await req('PUT', '/api/pacientes/me', { cpf: CPF2 }, token);
  assert.equal(r.status, 409);
});

test('PUT com e-mail inválido retorna 400', async () => {
  assert.equal((await req('PUT', '/api/pacientes/me', { email: 'invalido' }, token)).status, 400);
});

test('troca de senha: a nova funciona e a antiga não', async () => {
  assert.equal((await req('PUT', '/api/pacientes/me', { senha: 'novaSenha456' }, token)).status, 200);
  assert.equal((await req('POST', '/api/auth/login', { email: 'maria@teste.com', senha: 'segredo123' })).status, 401);
  assert.equal((await req('POST', '/api/auth/login', { email: 'maria@teste.com', senha: 'novaSenha456' })).status, 200);
});

test('DELETE desativa a conta e bloqueia o login', async () => {
  assert.equal((await req('DELETE', '/api/pacientes/me', null, token)).status, 204);
  assert.equal((await req('GET', '/api/pacientes/me', null, token)).status, 404);
  assert.equal((await req('POST', '/api/auth/login', { email: 'maria@teste.com', senha: 'novaSenha456' })).status, 401);
});

test('rota inexistente retorna 404', async () => {
  assert.equal((await req('GET', '/api/nada')).status, 404);
});
