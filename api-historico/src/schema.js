// Tabelas deste módulo (PostgreSQL). É seguro rodar várias vezes: usa IF NOT EXISTS.
module.exports = `
  -- Status possíveis, salvos no banco
  CREATE TABLE IF NOT EXISTS status_consulta (
    nome TEXT PRIMARY KEY
  );
  INSERT INTO status_consulta (nome) VALUES
    ('agendada'), ('realizada'), ('cancelada'), ('faltou')
  ON CONFLICT (nome) DO NOTHING;

  CREATE TABLE IF NOT EXISTS consultas (
    id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agendamento_id INTEGER NOT NULL UNIQUE,          -- id do agendamento na API de agenda
    paciente_id    INTEGER NOT NULL,                 -- vem do token (campo "sub")
    medico         TEXT NOT NULL,
    especialidade  TEXT NOT NULL,
    data_hora      TEXT NOT NULL                     -- formato: AAAA-MM-DD HH:MM
                   CHECK (data_hora ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$'),
    status         TEXT NOT NULL DEFAULT 'agendada' REFERENCES status_consulta(nome),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS ix_consultas_paciente ON consultas(paciente_id, data_hora);
`;
