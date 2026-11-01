# API de Autenticação e Pacientes

Projeto Integrador SENAI/SC · Módulo da Equipe 1 · Node.js + Express + PostgreSQL (JavaScript)

## Como rodar

```bash
npm install
cp .env.example .env     # (no Windows: copy .env.example .env) e preencha JWT_SECRET e DATABASE_URL
npm start                # http://localhost:3000
npm test                 # 16 testes (exige TEST_DATABASE_URL, veja abaixo)
```

## Endpoints

| Método | Rota | Protegida | O que faz |
|---|---|---|---|
| GET | /api/saude | não | Verifica se a API está no ar |
| POST | /api/pacientes | não | Cadastra paciente |
| POST | /api/auth/login | não | Retorna o token JWT |
| GET | /api/pacientes/me | sim | Dados do paciente logado |
| PUT | /api/pacientes/me | sim | Atualiza dados (só os campos enviados) |
| DELETE | /api/pacientes/me | sim | Desativa a conta (exclusão lógica) |

Rotas protegidas exigem o cabeçalho `Authorization: Bearer <token>`.

### Exemplos de corpo (JSON)

Cadastro:
```json
{ "nome": "Maria Silva", "email": "maria@teste.com", "senha": "segredo123",
  "telefone": "(47) 99999-1234", "cpf": "529.982.247-25" }
```
Login:
```json
{ "email": "maria@teste.com", "senha": "segredo123" }
```
Atualização (qualquer subconjunto): `{ "nome": "Maria S. Souza", "telefone": "47988887777" }`

### Códigos de resposta

200 ok · 201 criado · 204 sem conteúdo · 400 dados inválidos (lista `erros`) · 401 sem token, token inválido ou login errado · 404 não encontrado · 409 e-mail ou CPF já cadastrado

## Testando no Postman / Insomnia

1. **GET** `/api/saude` deve retornar `{"status":"ok"}`.
2. **POST** `/api/pacientes` com o JSON de cadastro, esperado **201**.
3. Repita o mesmo POST, esperado **409** (e-mail duplicado).
4. **POST** `/api/pacientes` com `"cpf": "111.111.111-11"`, esperado **400**.
5. **POST** `/api/auth/login`, esperado **200**; copie o `token`.
6. **GET** `/api/pacientes/me` sem token, esperado **401**.
7. Na aba *Authorization*, escolha *Bearer Token* e cole o token. Repita o GET, esperado **200**.
8. **PUT** `/api/pacientes/me` com `{"nome":"Novo Nome"}`, esperado **200**.
9. Pare e suba o servidor de novo (`Ctrl+C`, `npm start`) e repita o GET: os dados continuam lá (persistência).
10. **DELETE** `/api/pacientes/me`, esperado **204**. Depois o login deve dar **401**.

Dica: no Postman, guarde a URL em uma variável `{{base}}` = `http://localhost:3000`.

## Testando com curl

```bash
curl -X POST localhost:3000/api/pacientes -H "Content-Type: application/json" \
  -d '{"nome":"Maria Silva","email":"maria@teste.com","senha":"segredo123","cpf":"529.982.247-25"}'

curl -X POST localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"maria@teste.com","senha":"segredo123"}'

curl localhost:3000/api/pacientes/me -H "Authorization: Bearer COLE_O_TOKEN"
```

## Estrutura

```
src/app.js         rotas e regras
src/auth.js        geração e verificação do JWT
src/validacao.js   validação de campos e CPF
src/db.js          conexão com o PostgreSQL (pool) e criação das tabelas
src/schema.js      SQL das tabelas
src/server.js      inicia o servidor
test/api.test.js   testes automatizados
```

## Para os outros módulos usarem o login

Os demais serviços (agenda, agendamentos, histórico, notificações) validam o token com o **mesmo `JWT_SECRET`**. O id do paciente vem no campo `sub` do token.

## Banco de dados (PostgreSQL) e deploy no Render

- Variável obrigatória: `DATABASE_URL` (no Render: *Internal Database URL* no servidor, *External Database URL* no seu computador).
- As tabelas são criadas sozinhas ao iniciar a API (`src/schema.js`, comandos `CREATE TABLE IF NOT EXISTS`). Não precisa rodar SQL na mão.
- SSL é ligado automaticamente para URLs externas; para forçar, use `DATABASE_SSL=true` ou `false`.
- `npm test` exige `TEST_DATABASE_URL` apontando para um banco **só de testes** (as tabelas são esvaziadas a cada execução).
- Deploy no Render (Web Service): *Root Directory* `api-pacientes`, *Build Command* `npm install`, *Start Command* `npm start`.
  Variáveis: `DATABASE_URL`, `JWT_SECRET` (o **mesmo** nas duas APIs) e, se quiser, `TZ=America/Sao_Paulo`.
