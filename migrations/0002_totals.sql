-- Running totals per UF, kept up to date in the same batch that stores each BU, so the totals
-- page reads a few rows instead of summing every stored section. The country sums its UFs.
CREATE TABLE totals_cargo (
  election_id TEXT NOT NULL,
  turno INTEGER NOT NULL,
  cargo INTEGER NOT NULL,
  uf TEXT NOT NULL,
  secoes INTEGER NOT NULL,
  brancos INTEGER NOT NULL,
  nulos INTEGER NOT NULL,
  PRIMARY KEY (election_id, turno, cargo, uf)
) STRICT, WITHOUT ROWID;

-- Nominal votes only, as on the page.
CREATE TABLE totals_vote (
  election_id TEXT NOT NULL,
  turno INTEGER NOT NULL,
  cargo INTEGER NOT NULL,
  uf TEXT NOT NULL,
  idel INTEGER NOT NULL,
  numero TEXT NOT NULL,
  votos INTEGER NOT NULL,
  PRIMARY KEY (election_id, turno, cargo, uf, idel, numero)
) STRICT, WITHOUT ROWID;

-- BUs stored before this migration.
INSERT INTO totals_cargo (election_id, turno, cargo, uf, secoes, brancos, nulos)
SELECT b.election_id, b.turno, c.cargo, b.uf, COUNT(DISTINCT b.id), SUM(c.brancos), SUM(c.nulos)
  FROM bu b JOIN bu_cargo c ON c.bu_id = b.id
 GROUP BY b.election_id, b.turno, c.cargo, b.uf;

INSERT INTO totals_vote (election_id, turno, cargo, uf, idel, numero, votos)
SELECT b.election_id, b.turno, v.cargo, b.uf, v.idel, v.code, SUM(v.votes)
  FROM bu b JOIN bu_vote v ON v.bu_id = b.id
 WHERE v.kind = 'nominal'
 GROUP BY b.election_id, b.turno, v.cargo, b.uf, v.idel, v.code;
