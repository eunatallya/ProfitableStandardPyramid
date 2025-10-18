import express from "express";
import dotenv from "dotenv";
import pkg from "pg";
import path from "path"; // <--- 1. Importe o 'path'
import { fileURLToPath } from "url"; // <--- 2. Importe 'fileURLToPath'

dotenv.config();

// --- 3. Configuração para obter o __dirname com ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// -----------------------------------------------------------

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
// -------------------------------------------------

// Suas outras rotas (como a de status do DB) continuam funcionando
app.get("/db-status", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    client.release();
    res.status(200).json({
      status: "Conexão com o PostgreSQL OK",
      hora_atual_db: result.rows[0].now,
    });
  } catch (err) {
    console.error("ERRO AO CONECTAR AO BANCO DE DADOS:", err);
    res.status(500).json({
      status:
        "ERRO: Falha na conexão com o Banco de Dados. Verifique a DATABASE_URL.",
      detalhe: err.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  // (Pequena correção: Use crase ` para a variável ${PORT} funcionar)
  console.log(`Servidor Express iniciado e ouvindo na porta ${PORT}`);
});
