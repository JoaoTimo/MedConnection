const jwt = require('jsonwebtoken');

// Deve ser o MESMO segredo da API de pacientes/login
const SEGREDO = process.env.JWT_SECRET || 'troque-este-segredo-em-producao';

function exigirAutenticacao(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) return res.status(401).json({ erro: 'Token não informado' });
  try {
    const id = Number(jwt.verify(token, SEGREDO).sub);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new Error('sub inválido'); // evita erro no PostgreSQL
    req.pacienteId = id;
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

module.exports = { exigirAutenticacao, SEGREDO };
