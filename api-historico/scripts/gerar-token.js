// Gera um token de TESTE para usar no Postman sem depender da API de login.
// Uso: npm run token            (paciente 1)
//      npm run token -- 2       (paciente 2)
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { SEGREDO } = require('../src/auth');

const id = Number(process.argv[2] || 1);
console.log(jwt.sign({ sub: id, email: `paciente${id}@teste.com` }, SEGREDO, { expiresIn: '8h' }));
