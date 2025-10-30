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

aplicativo.pegar('/adicionar-senha-hash', async (req, res) => {
    try {
        const cliente = await piscina.connect();
        
        const sql = `
            ALTER TABLE profissional
            ADD COLUMN senha_hash VARCHAR(255);
        `;

        await cliente.query(sql);
        cliente.release();
        
        res.status(200).json({ status: "OK", mensagem: "Coluna 'senha_hash' adicionada com sucesso. REMOVA ESTA ROTA IMEDIATAMENTE!" });
    } catch (erro) {
        res.status(500).json({ status: "ERRO", detalhe: erro.message });
    }
});
app.listen(PORT, () => {

  console.log('Servidor Express iniciado e ouvindo na porta ${PORT}');
});
