const core = require("./database-runtime-base");

function setSettings(values) {
  const statement = core.db.prepare(`
    INSERT INTO settings (key,value,updated_at) VALUES (?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at
  `);
  core.db.exec("BEGIN");
  try {
    Object.entries(values).forEach(([key,value]) => statement.run(key,String(value ?? ""),core.now()));
    core.db.exec("COMMIT");
  } catch (error) {
    core.db.exec("ROLLBACK");
    throw error;
  }
  return core.getSettings();
}

module.exports = { ...core, setSettings };
