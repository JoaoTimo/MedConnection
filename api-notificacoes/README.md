# API de Notificações

Projeto Integrador SENAI/SC · Equipe 5 · Node.js + Express + PostgreSQL

## Rodar
```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env (preencha JWT_SECRET e DATABASE_URL)
npm start                 # http://localhost:3004
npm test                  # testes (exige TEST_DATABASE_URL, veja abaixo)
npm run token             # token de teste (npm run token -- 2 para o paciente 2)
```
`JWT_SECRET` deve ser **igual** ao da API de pacientes.

## Endpoints (todos exigem token, exceto /api/notificacoes/saude)

| Método | Rota | Função |
|---|---|---|
| GET | /api/notificacoes/saude | API no ar |
| POST | /api/notificacoes | Cria notificação |
| GET | /api/notificacoes | Lista as do paciente (`?lida=0` ou `?lida=1`) |
| PUT | /api/notificacoes/:id/lida | Marca como lida |
| DELETE | /api/notificacoes/:id | Exclui |

## Corpos (JSON)
`{"tipo":"lembrete","mensagem":"Consulta amanhã às 09:00"}`
`paciente_id` é opcional (se omitido, usa o paciente do token).
Tipos: `lembrete` · `cancelamento` · `alteracao` · `confirmacao`

## Códigos
200 ok · 201 criado · 204 excluído · 400 dados inválidos · 401 sem token · 404 não encontrado

## Regras
- Toda notificação é salva com a data de envio (`enviada_em`): é o **registro das notificações enviadas**.
- Excluir só **esconde** a notificação do paciente; o registro continua no banco.
- Cada paciente só vê, marca e exclui as próprias notificações.
- Sem perfil de administrador: qualquer usuário logado pode criar notificação para outro `paciente_id` (limitação da prova de conceito).

## Integração
`src/routes.js` exporta o `Router`: `app.use(require('./notificacoes/routes'))`.
Tabela: `notificacoes`.

## Banco de dados (PostgreSQL) e deploy no Render

- Variável obrigatória: `DATABASE_URL` (no Render: *Internal Database URL* no servidor, *External Database URL* no seu computador). O banco é o **mesmo** das outras APIs.
- As tabelas são criadas sozinhas ao iniciar a API (`src/schema.js`). Não precisa rodar SQL na mão.
- SSL é ligado automaticamente para URLs externas; para forçar, use `DATABASE_SSL=true` ou `false`.
- `npm test` exige `TEST_DATABASE_URL` apontando para um banco **só de testes** (a tabela deste módulo é esvaziada a cada execução).
- Deploy no Render (Web Service): *Root Directory* `api-notificacoes`, *Build Command* `npm install`, *Start Command* `npm start`.
  Variáveis: `DATABASE_URL` e `JWT_SECRET` (o **mesmo** das outras APIs).
