const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Caminho onde o ficheiro .sqlite será guardado automaticamente
const dbPath = path.resolve(__dirname, '../../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao SQLite:', err.message);
  } else {
    console.log('✅ Banco de dados SQLite criado/conectado com sucesso!');
  }
});

db.serialize(() => {
  // Tabela de Utilizadores
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'OPERADOR',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de Telemetria
  db.run(`
    CREATE TABLE IF NOT EXISTS telemetria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanque_id TEXT DEFAULT 'Tanque 01',
      o2 REAL NOT NULL,
      ph REAL NOT NULL,
      ammonia REAL NOT NULL,
      bateria_v REAL NOT NULL,
      rele_principal BOOLEAN DEFAULT 0,
      rele_reserva BOOLEAN DEFAULT 0,
      sirene BOOLEAN DEFAULT 0,
      data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de Logs de Alertas
  db.run(`
    CREATE TABLE IF NOT EXISTS alertas_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanque_id TEXT NOT NULL,
      parametro_violado TEXT NOT NULL,
      valor_registrado REAL NOT NULL,
      atendido_por TEXT DEFAULT 'Sistema Automático',
      data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Criar Admin Padrão
  db.get("SELECT COUNT(*) AS count FROM usuarios", (err, row) => {
    if (row && row.count === 0) {
      const senhaCriptografada = bcrypt.hashSync('senha123', 10);
      db.run(
        `INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)`,
        ['Administrador', 'admin@piscialerta.com', senhaCriptografada, 'ADMIN']
      );
      console.log('👤 Utilizador Admin padrão criado: admin@piscialerta.com / senha123');
    }
  });
});

module.exports = db;