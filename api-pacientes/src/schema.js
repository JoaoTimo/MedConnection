// Tabelas deste módulo (PostgreSQL). É seguro rodar várias vezes: usa IF NOT EXISTS.
module.exports = `
  CREATE TABLE IF NOT EXISTS pacientes (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    telefone   TEXT,
    cpf        TEXT NOT NULL UNIQUE,
    ativo      SMALLINT NOT NULL DEFAULT 1,           -- 1 = ativo, 0 = conta desativada
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;
