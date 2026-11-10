-- Banco de dados do projeto (PostgreSQL), gerado a partir do src/schema.js de cada API.
-- As APIs já criam estas tabelas sozinhas ao iniciar. Use este arquivo só para consulta
-- ou para criar tudo manualmente: psql "SUA_URL_DO_BANCO" -f schema.sql

-- ===== api-pacientes =====
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

-- ===== api-agenda =====
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

-- ===== api-historico =====
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

-- ===== api-notificacoes =====
CREATE TABLE IF NOT EXISTS notificacoes (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paciente_id INTEGER NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('lembrete', 'cancelamento', 'alteracao', 'confirmacao')),
  mensagem    TEXT NOT NULL,
  enviada_em  TIMESTAMPTZ NOT NULL DEFAULT now(),   -- registro de envio
  lida        BOOLEAN NOT NULL DEFAULT FALSE,
  excluida    BOOLEAN NOT NULL DEFAULT FALSE        -- exclusão lógica: o registro de envio é mantido
);
CREATE INDEX IF NOT EXISTS ix_notif_paciente ON notificacoes(paciente_id);
