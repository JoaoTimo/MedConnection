const somenteDigitos = (v) => String(v || '').replace(/\D/g, '');

function cpfValido(valor) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(cpf[i]) * (t + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(cpf[t])) return false;
  }
  return true;
}

const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

// Retorna lista de erros (vazia = ok). parcial=true no PUT (campos opcionais)
function validarPaciente(d, { parcial = false } = {}) {
  const erros = [];
  const tem = (c) => d[c] !== undefined;

  if (!parcial || tem('nome')) {
    if (!d.nome || String(d.nome).trim().length < 3) erros.push('nome deve ter ao menos 3 caracteres');
  }
  if (!parcial || tem('email')) {
    if (!emailValido(d.email)) erros.push('e-mail inválido');
  }
  if (!parcial || tem('senha')) {
    if (!d.senha || String(d.senha).length < 6) erros.push('senha deve ter ao menos 6 caracteres');
  }
  if (!parcial || tem('cpf')) {
    if (!cpfValido(d.cpf)) erros.push('CPF inválido');
  }
  if (tem('telefone') && d.telefone !== null && d.telefone !== '') {
    const n = somenteDigitos(d.telefone).length;
    if (n < 10 || n > 11) erros.push('telefone deve ter 10 ou 11 dígitos');
  }
  return erros;
}

module.exports = { validarPaciente, cpfValido, somenteDigitos };
