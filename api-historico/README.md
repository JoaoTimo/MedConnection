# API de Histórico

Projeto Integrador SENAI/SC · Equipe 4 · Node.js + Express + PostgreSQL

## Rodar
```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env (preencha JWT_SECRET e DATABASE_URL)
npm start                 # http://localhost:3003
npm run seed              # popula dados de teste (pacientes 1 e 2)
npm test                  # testes (exige TEST_DATABASE_URL, veja abaixo)
npm run token             # token de teste (npm run token -- 2 para o paciente 2)
```
`JWT_SECRET` deve ser **igual** ao da API de pacientes.

## Status possíveis (salvos na tabela status_consulta)
`agendada` · `realizada` · `cancelada` · `faltou`

## Endpoints (todos exigem token, exceto /api/historico/saude)

| Método | Rota | Função |
|---|---|---|
| GET | /api/historico/saude | API no ar |
| GET | /api/historico/status | Lista os status possíveis |
| POST | /api/historico | Registra uma consulta no histórico |
| GET | /api/historico/agendadas | Consultas agendadas do paciente |
| GET | /api/historico | Histórico de atendimentos (filtros abaixo) |
| GET | /api/historico/agendamentos/:agendamento_id/status | Status de um agendamento |
| PUT | /api/historico/agendamentos/:agendamento_id/status | Atualiza o status |

**Filtros do GET /api/historico:** `?status=realizada&de=2026-01-01&ate=2026-12-31`
Sem `status`, mostra tudo que não está agendada (realizada, cancelada, faltou).

## Corpos (JSON)
- Registrar: `{"agendamento_id":101,"medico":"Dr. João Souza","especialidade":"Cardiologia","data_hora":"2030-05-10 09:00","status":"agendada"}` (status é opcional)
- Atualizar status: `{"status":"realizada"}`

## Códigos
200 ok · 201 criado · 400 dados inválidos · 401 sem token · 404 não encontrado · 409 conflito (agendamento já registrado, ou consulta finalizada voltando para agendada)

## Regras
- Cada paciente só vê e altera as próprias consultas (id vem do campo `sub` do token).
- `agendamento_id` é o id do agendamento na API de agenda.
- Não há perfil de administrador: qualquer paciente logado pode atualizar o status das próprias consultas (limitação da prova de conceito).

## Integração
`src/routes.js` exporta o `Router`: `app.use(require('./historico/routes'))`.
Tabelas: `status_consulta`, `consultas`.

## Banco de dados (PostgreSQL) e deploy no Render

- Variável obrigatória: `DATABASE_URL` (no Render: *Internal Database URL* no servidor, *External Database URL* no seu computador). O banco é o **mesmo** das outras APIs.
- As tabelas são criadas sozinhas ao iniciar a API (`src/schema.js`). Não precisa rodar SQL na mão.
- SSL é ligado automaticamente para URLs externas; para forçar, use `DATABASE_SSL=true` ou `false`.
- `npm test` exige `TEST_DATABASE_URL` apontando para um banco **só de testes** (a tabela deste módulo é esvaziada a cada execução).
- Deploy no Render (Web Service): *Root Directory* `api-historico`, *Build Command* `npm install`, *Start Command* `npm start`.
  Variáveis: `DATABASE_URL` e `JWT_SECRET` (o **mesmo** das outras APIs).
