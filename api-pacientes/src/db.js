const { Pool } = require('pg');
const SCHEMA = require('./schema');

// Render: use a "Internal Database URL" quando a API e o banco estão na mesma região
// (mais rápido, não sai pela internet) e a "External Database URL" no seu computador.
const url = process.env.DATABASE_URL;

// SSL: a URL externa do Render exige SSL; a interna (host sem ponto, ex.: "dpg-abc123-a")
// e o localhost não precisam. Para forçar: DATABASE_SSL=true ou DATABASE_SSL=false.
function precisaSsl() {
  if (process.env.DATABASE_SSL) return process.env.DATABASE_SSL === 'true';
  try {
    const host = new URL(url).hostname;
    return host.includes('.') && host !== '127.0.0.1';
  } catch {
    return false;
  }
}

const pool = new Pool({
  connectionString: url,
  ssl: precisaSsl() ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10),
});

pool.on('error', (err) => console.error('Erro inesperado na conexão com o PostgreSQL:', err.message));

// Atalho: query('SELECT ... WHERE id = $1', [id]) -> { rows, rowCount }
const query = (texto, params) => pool.query(texto, params);

// Executa várias queries na mesma transação (COMMIT se tudo der certo, ROLLBACK se algo falhar).
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn((texto, params) => client.query(texto, params));
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Cria as tabelas (se ainda não existirem). Chamado uma vez ao iniciar o servidor.
async function iniciarBanco() {
  if (!url) throw new Error('DATABASE_URL não definida (copie a URL do banco no painel do Render)');
  await pool.query(SCHEMA);
}

module.exports = { pool, query, transaction, iniciarBanco };
