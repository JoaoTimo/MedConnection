// Tabela deste módulo (PostgreSQL). É seguro rodar várias vezes: usa IF NOT EXISTS.
module.exports = `
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
`;
