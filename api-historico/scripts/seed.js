// Popula o banco com dados de teste (pacientes 1 e 2). Pode rodar várias vezes: não duplica.
// Uso: npm run seed   (precisa do DATABASE_URL no .env)
require('dotenv').config();
const { pool, query, iniciarBanco } = require('../src/db');

const dados = [
  [101, 1, 'Dr. João Souza', 'Cardiologia', '2030-05-10 09:00', 'agendada'],
  [102, 1, 'Dra. Paula Lima', 'Dermatologia', '2030-06-02 14:30', 'agendada'],
  [103, 1, 'Dr. João Souza', 'Cardiologia', '2026-03-15 10:00', 'realizada'],
  [104, 1, 'Dra. Ana Costa', 'Pediatria', '2026-04-20 08:30', 'cancelada'],
  [105, 1, 'Dr. Carlos Reis', 'Ortopedia', '2026-05-05 16:00', 'faltou'],
  [201, 2, 'Dra. Ana Costa', 'Pediatria', '2030-05-12 11:00', 'agendada'],
];

(async () => {
  await iniciarBanco();
  for (const d of dados) {
    await query(
      `INSERT INTO consultas (agendamento_id, paciente_id, medico, especialidade, data_hora, status)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (agendamento_id) DO NOTHING`,
      d
    );
  }
  console.log(`${dados.length} consultas de teste (pacientes 1 e 2) garantidas no banco.`);
  await pool.end();
})().catch((err) => {
  console.error('Falha no seed:', err.message);
  process.exit(1);
});
