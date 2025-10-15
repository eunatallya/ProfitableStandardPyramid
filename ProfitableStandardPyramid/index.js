import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg';

// Configuração para carregar variáveis de ambiente (como DATABASE_URL)
dotenv.config();

// Configuração do PostgreSQL
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Necessário para conexões seguras com o Render Postgres
    rejectUnauthorized: false
  }
});

// Inicialização do Servidor Express
const app = express();
app.use(express.json());

// ROTA 1: Status Básico do Serviço
app.get('/', (req, res) => {
  res.status(200).send('Serviço Web 'fluxo mental' online e pronto!');
});

// ROTA 2: Teste de Conexão com o Banco de Dados
app.get('/db-status', async (req, res) => {
  try {
    const client = await pool.connect();
    // Consulta simples para provar que a conexão funciona
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

// Definição da Porta
// É crucial usar process.env.PORT, que é a porta fornecida pelo Render
const PORT = process.env.PORT || 3000;

// Inicia o Servidor
app.listen(PORT, () => {
  console.log(Servidor Express iniciado e ouvindo na porta ${PORT});
});
