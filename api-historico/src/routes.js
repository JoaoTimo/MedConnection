const express = require('express');
const { query } = require('./db');
const { exigirAutenticacao } = require('./auth');

const router = express.Router();
router.use(exigirAutenticacao); // todas as rotas exigem token

const UNIQUE_VIOLATION = '23505'; // código do PostgreSQL para "valor duplicado"
const MAX_INT = 2147483647;       // limite da coluna INTEGER

const texto = (v, min) => typeof v === 'string' && v.trim().length >= min;
const inteiroPositivo = (v) => Number.isInteger(v) && v >= 1 && v <= MAX_INT;
const statusValidos = async () => (await query('SELECT nome FROM status_consulta ORDER BY nome')).rows.map((s) => s.nome);

function dataHoraValida(v) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(v))) return false;
  const [dia, hora] = v.split(' ');
  const [y, mo, da] = dia.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const d = new Date(y, mo - 1, da, h, mi);
  return d.getFullYear() === y && d.getMonth() === mo - 1 && d.getDate() === da && d.getHours() === h && d.getMinutes() === mi;
}
function dataValida(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// :agendamento_id que não seja um inteiro válido vira 404 (em vez de erro do banco)
router.param('agendamento_id', (_req, res, next, valor) => {
  if (/^[0-9]+$/.test(valor) && Number(valor) >= 1 && Number(valor) <= MAX_INT) return next();
  res.status(404).json({ erro: 'Agendamento não encontrado' });
});

// Status possíveis
router.get('/api/historico/status', async (_req, res) => res.json(await statusValidos()));

// Registrar uma consulta no histórico
router.post('/api/historico', async (req, res) => {
  const d = req.body || {};
  const validos = await statusValidos();
  const erros = [];
  if (!inteiroPositivo(d.agendamento_id)) erros.push('agendamento_id deve ser um número inteiro positivo');
  if (!texto(d.medico, 3)) erros.push('medico deve ter ao menos 3 caracteres');
  if (!texto(d.especialidade, 3)) erros.push('especialidade deve ter ao menos 3 caracteres');
  if (!dataHoraValida(d.data_hora)) erros.push('data_hora deve estar no formato AAAA-MM-DD HH:MM');
  const status = d.status === undefined ? 'agendada' : d.status;
  if (!validos.includes(status)) erros.push(`status deve ser um de: ${validos.join(', ')}`);
  if (erros.length) return res.status(400).json({ erros });

  try {
    const { rows } = await query(
      `INSERT INTO consultas (agendamento_id, paciente_id, medico, especialidade, data_hora, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [d.agendamento_id, req.pacienteId, d.medico.trim(), d.especialidade.trim(), d.data_hora, status]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ erro: 'Agendamento já registrado no histórico' });
    throw err;
  }
});

// Consultas agendadas do paciente logado
router.get('/api/historico/agendadas', async (req, res) => {
  const { rows } = await query(
    "SELECT * FROM consultas WHERE paciente_id = $1 AND status = 'agendada' ORDER BY data_hora ASC",
    [req.pacienteId]
  );
  res.json(rows);
});

// Histórico de atendimentos, com filtros ?status= &de=AAAA-MM-DD &ate=AAAA-MM-DD
// Sem filtro de status: mostra tudo que NÃO está agendada (realizada, cancelada, faltou)
router.get('/api/historico', async (req, res) => {
  const { status, de, ate } = req.query;
  const validos = await statusValidos();
  const erros = [];
  if (status !== undefined && !validos.includes(status)) erros.push(`status deve ser um de: ${validos.join(', ')}`);
  if (de !== undefined && !dataValida(de)) erros.push('de deve estar no formato AAAA-MM-DD');
  if (ate !== undefined && !dataValida(ate)) erros.push('ate deve estar no formato AAAA-MM-DD');
  if (erros.length) return res.status(400).json({ erros });

  const args = [req.pacienteId];
  let sql = 'SELECT * FROM consultas WHERE paciente_id = $1';
  if (status) { args.push(status); sql += ` AND status = $${args.length}`; } else { sql += " AND status <> 'agendada'"; }
  if (de)     { args.push(de);     sql += ` AND substr(data_hora, 1, 10) >= $${args.length}`; }
  if (ate)    { args.push(ate);    sql += ` AND substr(data_hora, 1, 10) <= $${args.length}`; }
  sql += ' ORDER BY data_hora DESC';
  res.json((await query(sql, args)).rows);
});

const minha = async (agId, pacienteId) =>
  (await query('SELECT * FROM consultas WHERE agendamento_id = $1 AND paciente_id = $2', [agId, pacienteId])).rows[0];

// Status de um agendamento
router.get('/api/historico/agendamentos/:agendamento_id/status', async (req, res) => {
  const c = await minha(req.params.agendamento_id, req.pacienteId);
  if (!c) return res.status(404).json({ erro: 'Agendamento não encontrado' });
  res.json({ agendamento_id: c.agendamento_id, status: c.status, atualizado_em: c.atualizado_em });
});

// Atualizar status (ex.: marcar como realizada)
router.put('/api/historico/agendamentos/:agendamento_id/status', async (req, res) => {
  const c = await minha(req.params.agendamento_id, req.pacienteId);
  if (!c) return res.status(404).json({ erro: 'Agendamento não encontrado' });
  const { status } = req.body || {};
  const validos = await statusValidos();
  if (!validos.includes(status)) return res.status(400).json({ erros: [`status deve ser um de: ${validos.join(', ')}`] });
  if (c.status !== 'agendada' && status === 'agendada')
    return res.status(409).json({ erro: `Consulta ${c.status} não pode voltar para agendada` });
  const { rows } = await query('UPDATE consultas SET status = $1, atualizado_em = now() WHERE id = $2 RETURNING *', [status, c.id]);
  res.json(rows[0]);
});

module.exports = router;
