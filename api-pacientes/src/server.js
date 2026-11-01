require('dotenv').config();
const app = require('./app');
const { iniciarBanco } = require('./db');

const PORTA = process.env.PORT || 3000;

iniciarBanco()
  .then(() => app.listen(PORTA, () => console.log(`API de pacientes rodando na porta ${PORTA}`)))
  .catch((err) => {
    console.error('Falha ao conectar ao banco de dados:', err.message);
    process.exit(1);
  });
