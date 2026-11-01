// Tabelas deste módulo (PostgreSQL). É seguro rodar várias vezes: usa IF NOT EXISTS.
module.exports = `
  CREATE TABLE IF NOT EXISTS especialidades (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS medicos (
    id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome             TEXT NOT NULL,
    crm              TEXT NOT NULL UNIQUE,
    especialidade_id INTEGER NOT NULL REFERENCES especialidades(id)
  );

  CREATE TABLE IF NOT EXISTS horarios (
    id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    medico_id INTEGER NOT NULL REFERENCES medicos(id),
    data_hora TEXT NOT NULL                              -- formato: AAAA-MM-DD HH:MM
              CHECK (data_hora ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$'),
    UNIQUE (medico_id, data_hora)
  );

  -- paciente_id vem do token (campo "sub") e não tem FK de propósito:
  -- a API de agenda não depende da API de pacientes para funcionar.
  CREATE TABLE IF NOT EXISTS agendamentos (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    paciente_id INTEGER NOT NULL,
    horario_id  INTEGER NOT NULL REFERENCES horarios(id),
    status      TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'cancelada')),
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Garante no banco: um horário só pode ter UM agendamento ativo
  CREATE UNIQUE INDEX IF NOT EXISTS ux_horario_ativo
    ON agendamentos(horario_id) WHERE status = 'agendada';

  CREATE INDEX IF NOT EXISTS ix_horarios_medico      ON horarios(medico_id);
  CREATE INDEX IF NOT EXISTS ix_agendamentos_paciente ON agendamentos(paciente_id);
  CREATE INDEX IF NOT EXISTS ix_medicos_especialidade ON medicos(especialidade_id);
`;
