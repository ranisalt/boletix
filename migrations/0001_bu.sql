-- One verified BU per section and round. The signed original lives in R2 (original_key).
CREATE TABLE bu (
  id INTEGER PRIMARY KEY,
  election_id TEXT NOT NULL,
  plei INTEGER NOT NULL,
  turno INTEGER NOT NULL,
  fase TEXT NOT NULL,
  uf TEXT NOT NULL,
  municipio INTEGER NOT NULL,
  zona INTEGER NOT NULL,
  secao INTEGER NOT NULL,
  agregadas TEXT NOT NULL, -- JSON array of sections aggregated into this BU
  urna TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  algorithm TEXT NOT NULL,
  root TEXT NOT NULL,
  aptos INTEGER,
  comparecimento INTEGER,
  original_key TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  UNIQUE (plei, uf, municipio, zona, secao)
) STRICT;

CREATE TABLE bu_cargo (
  bu_id INTEGER NOT NULL REFERENCES bu (id),
  idel INTEGER NOT NULL,
  cargo INTEGER NOT NULL,
  tipo INTEGER NOT NULL,
  apta INTEGER NOT NULL,
  nominais INTEGER NOT NULL,
  legenda INTEGER NOT NULL,
  brancos INTEGER NOT NULL,
  nulos INTEGER NOT NULL,
  total INTEGER NOT NULL,
  PRIMARY KEY (bu_id, idel, cargo)
) STRICT, WITHOUT ROWID;

-- kind 'nominal': code is the candidate number; kind 'legenda': code is the party number.
CREATE TABLE bu_vote (
  bu_id INTEGER NOT NULL,
  idel INTEGER NOT NULL,
  cargo INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('nominal', 'legenda')),
  code TEXT NOT NULL,
  votes INTEGER NOT NULL,
  PRIMARY KEY (bu_id, idel, cargo, kind, code),
  FOREIGN KEY (bu_id, idel, cargo) REFERENCES bu_cargo (bu_id, idel, cargo)
) STRICT, WITHOUT ROWID;
