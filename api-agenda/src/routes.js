const express = require('express');
const { query, transaction } = require('./db');
const { exigirAutenticacao } = require('./auth');

const router = express.Router();
router.use(exigirAutenticacao); // todas as rotas deste módulo exigem token

// Códigos de erro do PostgreSQL
const UNIQUE_VIOLATION = '23505'; // valor duplicado (índice único)
const FK_VIOLATION = '23503';     // registro ainda referenciado por outra tabela

const texto = (v, min) => typeof v === 'string' && v.trim().length >= min;

// Converte para id inteiro válido (coluna INTEGER do PostgreSQL) ou devolve null.
function paraId(v) {
  if (typeof v !== 'number' && !(typeof v === 'string' && v.trim() !== '')) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

// Atalhos para consultas
const primeira = async (sql, params) => (await query(sql, params)).rows[0];
const existe = async (sql, params) => (await query(sql, params)).rowCount > 0;

// Qualquer :id que não seja um número inteiro vira 404 (em vez de erro do banco)
router.param('id', (_req, res, next, valor) => {
  if (paraId(valor) === null) return res.status(404).json({ erro: 'Recurso não encontrado' });
  next();
});

// Valida "AAAA-MM-DD HH:MM": formato, data real e no futuro. Retorna mensagem de erro ou null.
function dataHoraValida(v) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(v)))
    return 'data_hora deve estar no formato AAAA-MM-DD HH:MM';
  const [dia, hora] = v.split(' ');
  const [y, mo, da] = dia.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const d = new Date(y, mo - 1, da, h, mi);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da || d.getHours() !== h || d.getMinutes() !== mi)
    return 'data_hora inválida';
  if (d.getTime() <= Date.now()) return 'data_hora deve estar no futuro';
  return null;
}

// =====================  ESPECIALIDADES  =====================
router.get('/api/especialidades', async (_req, res) => {
  res.json((await query('SELECT * FROM especialidades ORDER BY nome')).rows);
});

router.post('/api/especialidades', async (req, res) => {
  const { nome } = req.body || {};
  if (!texto(nome, 3)) return res.status(400).json({ erros: ['nome deve ter ao menos 3 caracteres'] });
  try {
    const nova = await primeira('INSERT INTO especialidades (nome) VALUES ($1) RETURNING *', [nome.trim()]);
    res.status(201).json(nova);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ erro: 'Especialidade já cadastrada' });
    throw err;
  }
});

router.put('/api/especialidades/:id', async (req, res) => {
  const { nome } = req.body || {};
  if (!texto(nome, 3)) return res.status(400).json({ erros: ['nome deve ter ao menos 3 caracteres'] });
  try {
    const e = await primeira('UPDATE especialidades SET nome = $1 WHERE id = $2 RETURNING *', [nome.trim(), req.params.id]);
    if (!e) return res.status(404).json({ erro: 'Especialidade não encontrada' });
    res.json(e);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ erro: 'Especialidade já cadastrada' });
    throw err;
  }
});

router.delete('/api/especialidades/:id', async (req, res) => {
  if (await existe('SELECT 1 FROM medicos WHERE especialidade_id = $1', [req.params.id]))
    return res.status(409).json({ erro: 'Existem médicos nesta especialidade' });
  try {
    const info = await query('DELETE FROM especialidades WHERE id = $1', [req.params.id]);
    if (!info.rowCount) return res.status(404).json({ erro: 'Especialidade não encontrada' });
    res.status(204).end();
  } catch (err) {
    if (err.code === FK_VIOLATION) return res.status(409).json({ erro: 'Existem médicos nesta especialidade' });
    throw err;
  }
});

// =====================  MÉDICOS  =====================
const SQL_MEDICO = `
  SELECT m.id, m.nome, m.crm, m.especialidade_id, e.nome AS especialidade
  FROM medicos m JOIN especialidades e ON e.id = m.especialidade_id`;

router.get('/api/medicos', async (req, res) => {
  const { especialidade_id } = req.query;
  if (especialidade_id === undefined) {
    return res.json((await query(SQL_MEDICO + ' ORDER BY m.nome')).rows);
  }
  const eid = paraId(especialidade_id);
  if (eid === null) return res.json([]);
  res.json((await query(SQL_MEDICO + ' WHERE m.especialidade_id = $1 ORDER BY m.nome', [eid])).rows);
});

router.get('/api/medicos/:id', async (req, res) => {
  const m = await primeira(SQL_MEDICO + ' WHERE m.id = $1', [req.params.id]);
  if (!m) return res.status(404).json({ erro: 'Médico não encontrado' });
  res.json(m);
});

async function validarMedico(d, parcial = false) {
  const erros = [];
  if (!parcial || d.nome !== undefined) if (!texto(d.nome, 3)) erros.push('nome deve ter ao menos 3 caracteres');
  if (!parcial || d.crm !== undefined) if (!texto(String(d.crm ?? ''), 4)) erros.push('crm deve ter ao menos 4 caracteres');
  if (!parcial || d.especialidade_id !== undefined) {
    const eid = paraId(d.especialidade_id);
    if (eid === null || !(await existe('SELECT 1 FROM especialidades WHERE id = $1', [eid])))
      erros.push('especialidade_id não existe');
  }
  return erros;
}

router.post('/api/medicos', async (req, res) => {
  const d = req.body || {};
  const erros = await validarMedico(d);
  if (erros.length) return res.status(400).json({ erros });
  try {
    const novo = await primeira(
      'INSERT INTO medicos (nome, crm, especialidade_id) VALUES ($1, $2, $3) RETURNING id',
      [d.nome.trim(), String(d.crm).trim(), paraId(d.especialidade_id)]
    );
    res.status(201).json(await primeira(SQL_MEDICO + ' WHERE m.id = $1', [novo.id]));
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ erro: 'CRM já cadastrado' });
    throw err;
  }
});

router.put('/api/medicos/:id', async (req, res) => {
  const atual = await primeira('SELECT * FROM medicos WHERE id = $1', [req.params.id]);
  if (!atual) return res.status(404).json({ erro: 'Médico não encontrado' });
  const d = req.body || {};
  const erros = await validarMedico(d, true);
  if (erros.length) return res.status(400).json({ erros });
  try {
    await query('UPDATE medicos SET nome = $1, crm = $2, especialidade_id = $3 WHERE id = $4', [
      d.nome !== undefined ? d.nome.trim() : atual.nome,
      d.crm !== undefined ? String(d.crm).trim() : atual.crm,
      d.especialidade_id !== undefined ? paraId(d.especialidade_id) : atual.especialidade_id,
      atual.id,
    ]);
    res.json(await primeira(SQL_MEDICO + ' WHERE m.id = $1', [atual.id]));
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ erro: 'CRM já cadastrado' });
    throw err;
  }
});

router.delete('/api/medicos/:id', async (req, res) => {
  if (!(await existe('SELECT 1 FROM medicos WHERE id = $1', [req.params.id])))
    return res.status(404).json({ erro: 'Médico não encontrado' });
  const comAgend = await existe(
    'SELECT 1 FROM agendamentos a JOIN horarios h ON h.id = a.horario_id WHERE h.medico_id = $1 LIMIT 1',
    [req.params.id]
  );
  if (comAgend) return res.status(409).json({ erro: 'Médico possui agendamentos e não pode ser excluído' });
  try {
    // Os dois DELETE na mesma transação: ou apaga tudo, ou nada
    await transaction(async (q) => {
      await q('DELETE FROM horarios WHERE medico_id = $1', [req.params.id]);
      await q('DELETE FROM medicos WHERE id = $1', [req.params.id]);
    });
    res.status(204).end();
  } catch (err) {
    if (err.code === FK_VIOLATION) return res.status(409).json({ erro: 'Médico possui agendamentos e não pode ser excluído' });
    throw err;
  }
});

// =====================  HORÁRIOS  =====================
router.post('/api/medicos/:id/horarios', async (req, res) => {
  if (!(await existe('SELECT 1 FROM medicos WHERE id = $1', [req.params.id])))
    return res.status(404).json({ erro: 'Médico não encontrado' });
  const { data_hora } = req.body || {};
  const erro = dataHoraValida(data_hora);
  if (erro) return res.status(400).json({ erros: [erro] });
  try {
    const h = await primeira('INSERT INTO horarios (medico_id, data_hora) VALUES ($1, $2) RETURNING *', [req.params.id, data_hora]);
    res.status(201).json(h);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ erro: 'Horário já cadastrado para este médico' });
    throw err;
  }
});

// Lista só os horários DISPONÍVEIS (sem agendamento ativo)
router.get('/api/medicos/:id/horarios', async (req, res) => {
  if (!(await existe('SELECT 1 FROM medicos WHERE id = $1', [req.params.id])))
    return res.status(404).json({ erro: 'Médico não encontrado' });
  const { rows } = await query(
    `SELECT h.id, h.medico_id, h.data_hora FROM horarios h
     WHERE h.medico_id = $1
       AND NOT EXISTS (SELECT 1 FROM agendamentos a WHERE a.horario_id = h.id AND a.status = 'agendada')
     ORDER BY h.data_hora`,
    [req.params.id]
  );
  res.json(rows);
});

// =====================  AGENDAMENTOS  =====================
const SQL_AGEND = `
  SELECT a.id, a.paciente_id, a.status, a.criado_em, h.id AS horario_id, h.data_hora,
         m.id AS medico_id, m.nome AS medico, e.nome AS especialidade
  FROM agendamentos a
  JOIN horarios h ON h.id = a.horario_id
  JOIN medicos m ON m.id = h.medico_id
  JOIN especialidades e ON e.id = m.especialidade_id`;

const horarioOcupado = (id) =>
  existe("SELECT 1 FROM agendamentos WHERE horario_id = $1 AND status = 'agendada'", [id]);

const horarioExiste = (id) => existe('SELECT 1 FROM horarios WHERE id = $1', [id]);

// Solicitar consulta
router.post('/api/agendamentos', async (req, res) => {
  const horarioId = paraId((req.body || {}).horario_id);
  if (horarioId === null) return res.status(400).json({ erros: ['horario_id deve ser um número inteiro'] });
  if (!(await horarioExiste(horarioId))) return res.status(404).json({ erro: 'Horário não encontrado' });
  if (await horarioOcupado(horarioId)) return res.status(409).json({ erro: 'Horário já ocupado' });
  try {
    const novo = await primeira(
      'INSERT INTO agendamentos (paciente_id, horario_id) VALUES ($1, $2) RETURNING id',
      [req.pacienteId, horarioId]
    );
    res.status(201).json(await primeira(SQL_AGEND + ' WHERE a.id = $1', [novo.id]));
  } catch (err) {
    // índice único (corrida entre dois pedidos para o mesmo horário)
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ erro: 'Horário já ocupado' });
    throw err;
  }
});

// Listar os agendamentos do paciente logado
router.get('/api/agendamentos', async (req, res) => {
  res.json((await query(SQL_AGEND + ' WHERE a.paciente_id = $1 ORDER BY h.data_hora', [req.pacienteId])).rows);
});

const meuAgendamento = (id, pacienteId) =>
  primeira('SELECT * FROM agendamentos WHERE id = $1 AND paciente_id = $2', [id, pacienteId]);

// Cancelar
router.put('/api/agendamentos/:id/cancelar', async (req, res) => {
  const a = await meuAgendamento(req.params.id, req.pacienteId);
  if (!a) return res.status(404).json({ erro: 'Agendamento não encontrado' });
  if (a.status === 'cancelada') return res.status(409).json({ erro: 'Agendamento já cancelado' });
  await query("UPDATE agendamentos SET status = 'cancelada' WHERE id = $1", [a.id]);
  res.json(await primeira(SQL_AGEND + ' WHERE a.id = $1', [a.id]));
});

// Reagendar para outro horário (cancela o antigo e cria o novo, de uma vez)
router.put('/api/agendamentos/:id/reagendar', async (req, res) => {
  const a = await meuAgendamento(req.params.id, req.pacienteId);
  if (!a) return res.status(404).json({ erro: 'Agendamento não encontrado' });
  if (a.status === 'cancelada') return res.status(409).json({ erro: 'Agendamento cancelado não pode ser reagendado' });

  const horarioId = paraId((req.body || {}).horario_id);
  if (horarioId === null) return res.status(400).json({ erros: ['horario_id deve ser um número inteiro'] });
  if (!(await horarioExiste(horarioId))) return res.status(404).json({ erro: 'Novo horário não encontrado' });
  if (horarioId === a.horario_id) return res.status(400).json({ erros: ['escolha um horário diferente do atual'] });
  if (await horarioOcupado(horarioId)) return res.status(409).json({ erro: 'Horário já ocupado' });

  try {
    // Transação: se o novo horário falhar, o agendamento antigo NÃO é cancelado
    const novoId = await transaction(async (q) => {
      await q("UPDATE agendamentos SET status = 'cancelada' WHERE id = $1", [a.id]);
      const { rows } = await q(
        'INSERT INTO agendamentos (paciente_id, horario_id) VALUES ($1, $2) RETURNING id',
        [req.pacienteId, horarioId]
      );
      return rows[0].id;
    });
    res.json(await primeira(SQL_AGEND + ' WHERE a.id = $1', [novoId]));
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ erro: 'Horário já ocupado' });
    throw err;
  }
});

module.exports = router;
