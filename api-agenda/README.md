# API de Agenda e Agendamentos

Projeto Integrador SENAI/SC · Equipes 2 e 3 · Node.js + Express + PostgreSQL

## Rodar
```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env (preencha JWT_SECRET e DATABASE_URL)
npm start                 # http://localhost:3002
npm test                  # 31 testes automatizados
npm run token             # gera um token de teste para o Postman
```
`JWT_SECRET` deve ser **igual** ao da API de pacientes (o token do login vale aqui).

## Endpoints (todos exigem token, exceto /api/agenda/saude)

| Método | Rota | Função |
|---|---|---|
| GET | /api/agenda/saude | API no ar |
| GET/POST | /api/especialidades | Listar / criar |
| PUT/DELETE | /api/especialidades/:id | Editar / excluir |
| GET/POST | /api/medicos | Listar (`?especialidade_id=`) / criar |
| GET/PUT/DELETE | /api/medicos/:id | Buscar / editar / excluir |
| POST | /api/medicos/:id/horarios | Cadastrar horário |
| GET | /api/medicos/:id/horarios | Horários disponíveis |
| POST | /api/agendamentos | Solicitar consulta |
| GET | /api/agendamentos | Meus agendamentos |
| PUT | /api/agendamentos/:id/cancelar | Cancelar |
| PUT | /api/agendamentos/:id/reagendar | Trocar de horário |

## Corpos (JSON)
- Especialidade: `{"nome":"Cardiologia"}`
- Médico: `{"nome":"Dr. João Souza","crm":"SC12345","especialidade_id":1}`
- Horário: `{"data_hora":"2030-05-10 09:00"}` (formato AAAA-MM-DD HH:MM, no futuro)
- Agendar / reagendar: `{"horario_id":1}`

## Códigos
200 ok · 201 criado · 204 excluído · 400 dados inválidos · 401 sem token · 404 não encontrado · **409 conflito** (horário ocupado, CRM ou nome repetido)

## Regras
- Um horário só pode ter **um** agendamento ativo (regra no código **e** no banco).
- Cancelar libera o horário.
- Reagendar cancela o antigo e cria um agendamento **novo** (o `id` muda).
- Cada paciente só vê e altera os próprios agendamentos.
- Não exclui médico com agendamentos nem especialidade com médicos (409).

## Integração
- `src/routes.js` exporta o `Router`; `app.use(require('./agenda/routes'))`.
- Tabelas: `especialidades`, `medicos`, `horarios`, `agendamentos`.
- O id do paciente vem do campo `sub` do token.

## Banco de dados (PostgreSQL) e deploy no Render

- Variável obrigatória: `DATABASE_URL` (no Render: *Internal Database URL* no servidor, *External Database URL* no seu computador).
- As tabelas são criadas sozinhas ao iniciar a API (`src/schema.js`, comandos `CREATE TABLE IF NOT EXISTS`). Não precisa rodar SQL na mão.
- SSL é ligado automaticamente para URLs externas; para forçar, use `DATABASE_SSL=true` ou `false`.
- `npm test` exige `TEST_DATABASE_URL` apontando para um banco **só de testes** (as tabelas são esvaziadas a cada execução).
- Deploy no Render (Web Service): *Root Directory* `api-agenda`, *Build Command* `npm install`, *Start Command* `npm start`.
  Variáveis: `DATABASE_URL`, `JWT_SECRET` (o **mesmo** nas duas APIs) e, se quiser, `TZ=America/Sao_Paulo`.
