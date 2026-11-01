const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { query } = require('./db');
const { validarPaciente, somenteDigitos } = require('./validacao');
const { gerarToken, exigirAutenticacao } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const UNIQUE_VIOLATION = '23505'; // código do PostgreSQL para "valor duplicado"

// Nunca devolver o hash da senha
const publico = ({ senha_hash, ...resto }) => resto;

async function buscarAtivo(id) {
  const { rows } = await query('SELECT * FROM pacientes WHERE id = $1 AND ativo = 1', [id]);
  return rows[0];
}

const existe = async (sql, params) => (await query(sql, params)).rowCount > 0;

app.get('/api/saude', (_req, res) => res.json({ status: 'ok' }));

// ---------- CADASTRO ----------
app.post('/api/pacientes', async (req, res) => {
  const erros = validarPaciente(req.body || {});
  if (erros.length) return res.status(400).json({ erros });

  const { nome, email, senha, telefone } = req.body;
  const cpf = somenteDigitos(req.body.cpf);
  const emailNorm = String(email).trim().toLowerCase();

  if (await existe('SELECT 1 FROM pacientes WHERE email = $1', [emailNorm])) {
    return res.status(409).json({ erro: 'E-mail já cadastrado' });
  }
  if (await existe('SELECT 1 FROM pacientes WHERE cpf = $1', [cpf])) {
    return res.status(409).json({ erro: 'CPF já cadastrado' });
  }

  const hash = await bcrypt.hash(String(senha), 10);
  try {
    const { rows } = await query(
      `INSERT INTO pacientes (nome, email, senha_hash, telefone, cpf)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [String(nome).trim(), emailNorm, hash, telefone ? somenteDigitos(telefone) : null, cpf]
    );
    res.status(201).json(publico(rows[0]));
  } catch (err) {
    // Dois cadastros iguais ao mesmo tempo: o índice único do banco barra o segundo
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ erro: 'E-mail ou CPF já cadastrado' });
    throw err;
  }
});

// ---------- LOGIN ----------
app.post('/api/auth/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha' });

  const { rows } = await query('SELECT * FROM pacientes WHERE email = $1 AND ativo = 1', [
    String(email).trim().toLowerCase(),
  ]);
  const p = rows[0];

  // Mesma mensagem para e-mail inexistente e senha errada (não revela qual falhou)
  if (!p || !(await bcrypt.compare(String(senha), p.senha_hash))) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
  }
  res.json({ token: gerarToken(p), paciente: publico(p) });
});

// ---------- PERFIL (rotas protegidas, só o próprio paciente) ----------
app.get('/api/pacientes/me', exigirAutenticacao, async (req, res) => {
  const p = await buscarAtivo(req.pacienteId);
  if (!p) return res.status(404).json({ erro: 'Paciente não encontrado' });
  res.json(publico(p));
});

app.put('/api/pacientes/me', exigirAutenticacao, async (req, res) => {
  const atual = await buscarAtivo(req.pacienteId);
  if (!atual) return res.status(404).json({ erro: 'Paciente não encontrado' });

  const d = req.body || {};
  const erros = validarPaciente(d, { parcial: true });
  if (erros.length) return res.status(400).json({ erros });

  const novo = {
    nome: d.nome !== undefined ? String(d.nome).trim() : atual.nome,
    email: d.email !== undefined ? String(d.email).trim().toLowerCase() : atual.email,
    cpf: d.cpf !== undefined ? somenteDigitos(d.cpf) : atual.cpf,
    telefone: d.telefone !== undefined ? (d.telefone ? somenteDigitos(d.telefone) : null) : atual.telefone,
    senha_hash: d.senha ? await bcrypt.hash(String(d.senha), 10) : atual.senha_hash,
  };

  if (await existe('SELECT 1 FROM pacientes WHERE email = $1 AND id != $2', [novo.email, atual.id])) {
    return res.status(409).json({ erro: 'E-mail já cadastrado' });
  }
  if (await existe('SELECT 1 FROM pacientes WHERE cpf = $1 AND id != $2', [novo.cpf, atual.id])) {
    return res.status(409).json({ erro: 'CPF já cadastrado' });
  }

  try {
    await query(
      'UPDATE pacientes SET nome = $1, email = $2, cpf = $3, telefone = $4, senha_hash = $5 WHERE id = $6',
      [novo.nome, novo.email, novo.cpf, novo.telefone, novo.senha_hash, atual.id]
    );
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return res.status(409).json({ erro: 'E-mail ou CPF já cadastrado' });
    throw err;
  }

  res.json(publico(await buscarAtivo(atual.id)));
});

// Desativa a conta (exclusão lógica: o histórico de consultas continua íntegro)
app.delete('/api/pacientes/me', exigirAutenticacao, async (req, res) => {
  const info = await query('UPDATE pacientes SET ativo = 0 WHERE id = $1 AND ativo = 1', [req.pacienteId]);
  if (!info.rowCount) return res.status(404).json({ erro: 'Paciente não encontrado' });
  res.status(204).end();
});

// ---------- ERROS ----------
app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;
