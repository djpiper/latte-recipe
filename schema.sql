-- Shared shot log. Column names match the client's shot object keys exactly,
-- so a `SELECT *` row is already what public/index.html renders — no mapping layer.
--
-- Fields the form leaves blank depending on style (milkTemp and foam on iced,
-- milkPrep and espPrep on hot, dose when grinding by time) are NULL here and
-- come back as '' — except dose, which the client models as null. The Worker
-- does that conversion on the way out.
CREATE TABLE IF NOT EXISTS shots (
  id         TEXT PRIMARY KEY,
  brewer     TEXT    NOT NULL,
  ts         INTEGER NOT NULL,
  style      TEXT    NOT NULL,             -- 'hot' | 'iced'
  beans      TEXT    NOT NULL,
  roast      TEXT    NOT NULL,
  grind      TEXT    NOT NULL DEFAULT '',
  grindTime  REAL,
  dose       REAL,                         -- optional: grinding by time has no scale
  "yield"    REAL    NOT NULL,
  "time"     REAL    NOT NULL,
  milk       TEXT    NOT NULL,
  milkVol    REAL    NOT NULL,
  frothTime  REAL,
  milkTemp   REAL,                         -- hot only
  foam       REAL,                         -- hot only
  milkPrep   TEXT    NOT NULL DEFAULT '',  -- iced only
  espPrep    TEXT    NOT NULL DEFAULT '',  -- iced only
  addins     TEXT    NOT NULL DEFAULT '[]',-- JSON array of {name, amt, unit}
  rating     INTEGER NOT NULL,
  notes      TEXT    NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS shots_ts ON shots(ts DESC);
