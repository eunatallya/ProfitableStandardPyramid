import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send("Serviço Web 'fluxo mental' online e pronto!");
});

app.get('/db-status', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    res.status(200).json({
      status: 'Conexão com o PostgreSQL OK',
      hora_atual_db: result.rows[0].now
    });
  } catch (err) {
    console.error('ERRO AO CONECTAR AO BANCO DE DADOS:', err);
    res.status(500).json({
      status: 'ERRO: Falha na conexão com o Banco de Dados. Verifique a DATABASE_URL.',
      detalhe: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.get('/adicionar-senha-hash', async (req, res) => {
    try {
        const client = await pool.connect(); 
        
        const sql = `
        ALTER TABLE users ADD COLUMN nome VARCHAR(100);
ALTER TABLE users ADD COLUMN sobrenome VARCHAR(100);
ALTER TABLE users ADD COLUMN idade INT;
ALTER TABLE users ADD COLUMN sexo VARCHAR(50);
ALTER TABLE users ADD COLUMN area_atuacao VARCHAR(255);
ALTER TABLE users ADD COLUMN contato VARCHAR(255);
ALTER TABLE users ADD COLUMN sobre_mim TEXT;
            ALTER TABLE "profissional" 
            ADD COLUMN senha_hash VARCHAR(255);
        `;

        await client.query(sql);
        client.release();
        
        res.status(200).json({ status: "OK", message: "Column 'senha_hash' adicionada com sucesso. REMOVA ESTA ROTA IMEDIATAMENTE!" });
    } catch (error) {
        res.status(500).json({ status: "ERRO", detail: error.message });
    }
});
app.listen(PORT, () => {

  console.log('Servidor Express iniciado e ouvindo na porta ${PORT}');
});
