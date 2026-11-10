# Projeto Integrador – 4 APIs + PostgreSQL (Render)

```
projeto-api/
  api-pacientes/      cadastro, login (JWT) e perfil                 (porta 3000)
  api-agenda/         especialidades, médicos, horários, agendamentos (porta 3002)
  api-historico/      consultas agendadas, histórico e status         (porta 3003)
  api-notificacoes/   notificações e registro de envios               (porta 3004)
  database/schema.sql tabelas das 4 APIs (referência; as APIs criam sozinhas)
```
Todas usam o **mesmo banco PostgreSQL** e o **mesmo JWT_SECRET**. O token gerado no login (api-pacientes) vale nas outras três.

## 1. Rodar no seu computador
1. Crie o banco no Render e copie a **External Database URL**.
2. Em cada API: `cp .env.example .env` (Windows: `copy .env.example .env`), preencha `DATABASE_URL` e use o **mesmo** `JWT_SECRET`.
3. `npm install` e `npm start`. Ao subir, as tabelas são criadas automaticamente.

## 2. Publicar no Render (uma vez para cada pasta)
Suba o projeto para o GitHub. No Render: **New → Web Service** → escolha o repositório.

| Campo | Valor |
|---|---|
| Root Directory | `api-pacientes`, `api-agenda`, `api-historico` ou `api-notificacoes` |
| Build Command | `npm install` |
| Start Command | `npm start` |

Variáveis de ambiente (nas 4): `DATABASE_URL` (Internal Database URL), `JWT_SECRET` (idêntico nas 4) e, opcional, `TZ=America/Sao_Paulo`.

## 3. Testar
Endereços de saúde (sem token):
- `/api/saude` (pacientes) · `/api/agenda/saude` · `/api/historico/saude` · `/api/notificacoes/saude`

Para a bateria completa, importe `MedConnection-testes.postman_collection.json` no Postman, preencha as 4 variáveis de URL e rode a coleção (Run).
