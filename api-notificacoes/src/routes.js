const express = require('express');
const { query } = require('./db');
const { exigirAutenticacao } = require('./auth');

const router = express.Router();
router.use(exigirAutenticacao); // todas as rotas exigem token

const TIPOS = ['lembrete', 'cancelamento', 'alteracao', 'confirmacao'];
const MAX_INT = 2147483647; // limite da coluna INTEGER

// Remove o campo interno "excluida" (lida já é booleano no PostgreSQL)
const publico = ({ excluida, ...n }) => n;

// :id que não seja um inteiro válido vira 404 (em vez de erro do banco)
router.param('id', (_req, res, next, valor) => {
  if (/^[0-9]+$/.test(valor) && Number(valor) >= 1 && Number(valor) <= MAX_INT) return next();
  res.status(404).json({ erro: 'Notificação não encontrada' });
});

// Criar notificação (fica registrada com a data de envio)
// paciente_id é opcional: se omitido, usa o paciente do token
router.post('/api/notificacoes', async (req, res) => {
  const d = req.body || {};
  const erros = [];
  if (!TIPOS.includes(d.tipo)) erros.push(`tipo deve ser um de: ${TIPOS.join(', ')}`);
  if (typeof d.mensagem !== 'string' || d.mensagem.trim().length < 3 || d.mensagem.length > 300)
    erros.push('mensagem deve ter entre 3 e 300 caracteres');
  if (d.paciente_id !== undefined && (!Number.isInteger(d.paciente_id) || d.paciente_id < 1 || d.paciente_id > MAX_INT))
    erros.push('paciente_id deve ser um número inteiro positivo');
  if (erros.length) return res.status(400).json({ erros });

  const alvo = d.paciente_id ?? req.pacienteId;
  const { rows } = await query(
    'INSERT INTO notificacoes (paciente_id, tipo, mensagem) VALUES ($1, $2, $3) RETURNING *',
    [alvo, d.tipo, d.mensagem.trim()]
  );
  res.status(201).json(publico(rows[0]));
});

// Listar as notificações do paciente logado (?lida=0 ou ?lida=1 para filtrar)
router.get('/api/notificacoes', async (req, res) => {
  const { lida } = req.query;
  if (lida !== undefined && !['0', '1'].includes(lida))
    return res.status(400).json({ erros: ['lida deve ser 0 ou 1'] });

  const args = [req.pacienteId];
  let sql = 'SELECT * FROM notificacoes WHERE paciente_id = $1 AND excluida = FALSE';
  if (lida !== undefined) { args.push(lida === '1'); sql += ` AND lida = $${args.length}`; }
  sql += ' ORDER BY enviada_em DESC, id DESC';
  res.json((await query(sql, args)).rows.map(publico));
});

// Marcar como lida
router.put('/api/notificacoes/:id/lida', async (req, res) => {
  const { rows } = await query(
    'UPDATE notificacoes SET lida = TRUE WHERE id = $1 AND paciente_id = $2 AND excluida = FALSE RETURNING *',
    [req.params.id, req.pacienteId]
  );
  if (!rows[0]) return res.status(404).json({ erro: 'Notificação não encontrada' });
  res.json(publico(rows[0]));
});

// Excluir (some para o paciente, mas o registro de envio continua no banco)
router.delete('/api/notificacoes/:id', async (req, res) => {
  const info = await query(
    'UPDATE notificacoes SET excluida = TRUE WHERE id = $1 AND paciente_id = $2 AND excluida = FALSE',
    [req.params.id, req.pacienteId]
  );
  if (!info.rowCount) return res.status(404).json({ erro: 'Notificação não encontrada' });
  res.status(204).end();
});

module.exports = router;
