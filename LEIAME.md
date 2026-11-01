# Projeto Integrador – APIs + PostgreSQL (Render)

```
projeto-api/
  api-pacientes/   cadastro, login (JWT) e perfil          (porta 3000)
  api-agenda/      especialidades, médicos, horários e agendamentos (porta 3002)
  database/schema.sql   tabelas (referência; as APIs já criam sozinhas)
```

## 1. Rodar no seu computador
1. Crie o banco no Render (passo 2) e copie a **External Database URL**.
2. Em cada API: `cp .env.example .env`, preencha `DATABASE_URL` e use o **mesmo** `JWT_SECRET` nas duas.
3. `npm install` e `npm start`. Ao subir, as tabelas são criadas automaticamente.

## 2. Criar o banco no Render
Dashboard → **New → PostgreSQL** → escolha nome e região → aguarde o status *Available*.
Na página do banco, copie a **Internal Database URL** (para as APIs hospedadas no Render, mesma região) e a **External Database URL** (para o seu computador).

## 3. Publicar as APIs (uma vez para cada pasta)
Suba o projeto para o GitHub. No Render: **New → Web Service** → escolha o repositório e preencha:

| Campo | api-pacientes | api-agenda |
|---|---|---|
| Root Directory | `api-pacientes` | `api-agenda` |
| Build Command | `npm install` | `npm install` |
| Start Command | `npm start` | `npm start` |

Variáveis de ambiente (nas duas): `DATABASE_URL` (Internal URL), `JWT_SECRET` (idêntico nas duas) e, opcional, `TZ=America/Sao_Paulo`
(faz a validação "horário no futuro" usar o horário de Brasília).

## 4. Testar
1. `GET  https://SUA-API-PACIENTES.onrender.com/api/saude` → `{"status":"ok"}`
2. `POST /api/pacientes` → 201 · `POST /api/auth/login` → copie o `token`
3. Na agenda, envie `Authorization: Bearer <token>`:
   `POST /api/especialidades` → `POST /api/medicos` → `POST /api/medicos/1/horarios` → `GET /api/medicos/1/horarios` → `POST /api/agendamentos` `{"horario_id":1}` → `PUT /api/agendamentos/1/reagendar` ou `/cancelar`
