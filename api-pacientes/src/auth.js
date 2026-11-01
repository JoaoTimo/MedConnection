const jwt = require('jsonwebtoken');

const SEGREDO = process.env.JWT_SECRET || 'troque-este-segredo-em-producao';
const EXPIRA = process.env.JWT_EXPIRES || '2h';

const gerarToken = (paciente) =>
  jwt.sign({ sub: paciente.id, email: paciente.email }, SEGREDO, { expiresIn: EXPIRA });

// Middleware: exige "Authorization: Bearer <token>"
function exigirAutenticacao(req, res, next) {
  const cab = req.headers.authorization || '';
  const [tipo, token] = cab.split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token não informado' });
  }
  try {
    const dados = jwt.verify(token, SEGREDO);
    const id = Number(dados.sub);
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new Error('sub inválido'); // evita erro no PostgreSQL
    req.pacienteId = id;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

module.exports = { gerarToken, exigirAutenticacao };
