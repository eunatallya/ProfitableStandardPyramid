import express from "express";
import dotenv from "dotenv";
import pkg from "pg"; 
import fetch from "node-fetch"; 
import cors from "cors";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

// --- Configuração do Ambiente ---
dotenv.config();
const { Pool } = pkg; 
const PORT = process.env.PORT || 3000; 

// --- Configuração de Caminhos (__dirname) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuração Principal do App ---
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Bloco de Content-Security-Policy ---
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' https://vlibras.gov.br https://fonts.googleapis.com https://fonts.gstatic.com; " +
    "script-src 'self' https://vlibras.gov.br 'unsafe-inline'; " + 
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:;" +
    "connect-src 'self' ws://localhost:3000;" 
  );
  next();
});

// ==========================================================
//  CONFIGURAÇÃO DO BANCO DE DADOS (PostgreSQL - NEON)
// ==========================================================
let pool;
try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não está definida no arquivo .env");
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false 
    }
  });
  console.log("PostgreSQL Pool (Neon) conectado com sucesso.");
} catch (err) {
  console.error("ERRO CRÍTICO AO CONECTAR AO POSTGRESQL:", err.message);
  process.exit(1); 
}

// ==========================================================
//  CONFIGURAÇÃO DO CHATBOT GEMINI
// ==========================================================
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) console.warn("⚠️ AVISO: GEMINI_API_KEY não configurada.");
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;

async function chamarGemini(prompt) {
  const resposta = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
    }),
  });
  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Erro Gemini: ${texto}`);
  }
  const data = await resposta.json();
  const textoIA = data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ A IA não respondeu.";
  return textoIA.replace(/(\r\n|\n|\r|#|\*)/gm, "").trim(); 
}

// ==========================================================
//  CONFIGURAÇÃO DO SERVIÇO DE E-MAIL (NODEMAILER)
// ==========================================================
const limiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use("/api/", limiter);
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ==========================================================
//  ROTAS DA APLICAÇÃO (API)
// ==========================================================

// --- Rota de Status do BD ---
app.get("/db-status", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()"); 
    res.status(200).json({ status: "Conexão com o PostgreSQL (Neon) OK", hora_atual_db: result.rows[0].now });
  } catch (err) {
    console.error("ERRO AO CONECTAR AO POSTGRESQL:", err);
    res.status(500).json({ status: "ERRO: Falha na conexão.", detalhe: err.message });
  }
});

// --- Rota de Registro de Usuário ---
app.post("/api/register", async (req, res) => {
  // ... (código existente, está correto)
  const { 
    username, password, email, tipo, 
    nome_completo, crm 
  } = req.body; 

  if (!tipo) return res.status(400).json({ error: "O 'tipo' é obrigatório." });

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    
    let sql = "";
    let values = [];

    if (tipo === 'paciente') {
      if (!username || !password || !email) return res.status(400).json({ error: "Campos incompletos para paciente." });
      sql = "INSERT INTO users (username, email, password_hash, tipo) VALUES ($1, $2, $3, 'paciente') RETURNING id"; 
      values = [username, email, password_hash];
    } else if (tipo === 'profissional') {
      if (!nome_completo || !crm || !email || !password) return res.status(400).json({ error: "Campos incompletos para profissional." });
      sql = "INSERT INTO users (email, password_hash, tipo, nome_completo, crm) VALUES ($1, $2, 'profissional', $3, $4) RETURNING id";
      values = [email, password_hash, nome_completo, crm];
    } else {
      return res.status(400).json({ error: "Tipo de usuário inválido." });
    }
    
    const result = await pool.query(sql, values);
    res.status(201).json({ id: result.rows[0].id, message: `Usuário ${tipo} registrado!` });

  } catch (err) {
    if (err.code === "23505") { 
      if (err.constraint.includes("crm")) return res.status(400).json({ error: "Este CRM já está cadastrado." });
      if (err.constraint.includes("email")) return res.status(400).json({ error: "Este e-mail já está em uso." });
      if (err.constraint.includes("username")) return res.status(400).json({ error: "Este nome de usuário já está em uso." });
    }
    console.error("Erro no /api/register:", err);
    res.status(500).json({ error: "Erro interno ao registrar." });
  }
});

// --- Rota de Login ---
app.post("/api/login", async (req, res) => {
  // ... (código existente, está correto)
  const { login, password } = req.body; 
  if (!login || !password) return res.status(400).json({ error: "Login e senha são obrigatórios." });

  try {
    const sql = "SELECT * FROM users WHERE username = $1 OR email = $1";
    const result = await pool.query(sql, [login]);
    const user = result.rows[0]; 

    if (!user) return res.status(401).json({ error: "Usuário ou senha incorretos." });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: "Usuário ou senha incorretos." });

    res.status(200).json({
      id: user.id,
      username: user.tipo === 'paciente' ? user.username : user.nome_completo, 
      tipo: user.tipo,
      pre_diagnostico: user.pre_diagnostico
    });
  } catch (err) {
    console.error("Erro no /api/login:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// --- Rota do Chat (Gemini) ---
app.post("/chat", async (req, res) => {
  // ... (código existente, está correto)
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Mensagem vazia" });
  try {
    const prompt = `
      Você é um assistente de saúde mental empático e acolhedor da plataforma MindFlow. 
      Ajude o usuário com apoio emocional e orientações leves. 
      Sempre que for apropriado e o usuário parecer precisar de mais ajuda, 
      recomende gentilmente que ele procure um dos especialistas 
      listados na seção "Nossos Profissionais" da plataforma.
      
      Usuário: ${message}
    `;
    const respostaIA = await chamarGemini(prompt); 
    res.json({ reply: respostaIA });
  } catch (err) {
    console.error("Erro no /chat:", err);
    res.status(500).json({ error: "Erro no servidor: " + err.message });
  }
});

// --- Rota de Questionário (COM IA) (CORRIGIDA) ---
app.post("/api/questionario", async (req, res) => {
  const { userId, respostas } = req.body; 
  if (!userId || !respostas) return res.status(400).json({ error: "ID e respostas são obrigatórios." });

  try {
    
    // === ESTE É O PROMPT CORRETO ===
    const prompt = `
      Você é um assistente de saúde mental da plataforma MindFlow. 
      Analise as seguintes respostas do questionário de triagem:

      PERGUNTAS DE DEPRESSÃO:
      1. Sentiu-se para baixo/deprimido: ${respostas.q1_texto}
      2. Pouco interesse/prazer: ${respostas.q2_texto}

      PERGUNTAS DE ANSIEDADE:
      3. Sentiu-se nervoso/ansioso: ${respostas.q3_texto}
      4. Incapaz de parar preocupações: ${respostas.q4_texto}
      5. Dificuldade para relaxar: ${respostas.q5_texto}

      Gere uma resposta em duas partes:
      1. Um pré-diagnóstico curto (ex: "Indicativos de ansiedade moderada").
      2. Uma recomendação gentil para que o usuário visite a página "Nossos Profissionais" da plataforma para encontrar ajuda.

      Formate a resposta em uma única linha, como:
      "[Diagnóstico]. Recomendamos que você procure apoio na nossa página 'Nossos Profissionais'."
    `;
    // === FIM DO PROMPT CORRETO ===

    const pre_diagnostico_ia = await chamarGemini(prompt);
    
    const sql = "UPDATE users SET pre_diagnostico = $1 WHERE id = $2";
    const result = await pool.query(sql, [pre_diagnostico_ia, userId]);

    if (result.rowCount === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    res.status(200).json({ message: "Questionário salvo com sucesso!" });

  } catch (err) {
    console.error("Erro no /api/questionario:", err);
    res.status(500).json({ error: "Erro interno ao salvar questionário." });
  }
});

// ==========================================================
//  ROTAS DE PERFIL DO PROFISSIONAL
// ==========================================================

// --- ROTA PÚBLICA PARA LISTAR PROFISSIONAIS (CORRIGIDA) ---
app.get("/api/profissionais", async (req, res) => {
  try {
    const sql = `
      SELECT id, nome_completo, crm, idade, sexo, 
             area_atuacao, contato, sobre_mim 
      FROM users 
      WHERE tipo = 'profissional'
    `;
    const result = await pool.query(sql);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Erro no /api/profissionais:", err);
    res.status(500).json({ error: "Erro interno ao buscar profissionais." });
  }
});

// --- ROTA PARA PROFISSIONAL ATUALIZAR O PRÓPRIO PERFIL (CORRIGIDA) ---
app.put("/api/perfil-profissional", async (req, res) => {
  const { 
    userId, idade, sexo, area_atuacao, 
    contato, sobre_mim, nome_completo 
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "ID do usuário não fornecido." });
  }

  try {
    const sql = `
      UPDATE users SET 
        nome_completo = $1,
        idade = $2,
        sexo = $3,
        area_atuacao = $4,
        contato = $5,
        sobre_mim = $6
      WHERE id = $7 AND tipo = 'profissional'
      RETURNING *; 
    `;
    const values = [
      nome_completo, idade, sexo, area_atuacao, 
      contato, sobre_mim, userId
    ];
    const result = await pool.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Profissional não encontrado." });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Erro no /api/perfil-profissional:", err);
    res.status(500).json({ error: "Erro interno ao atualizar perfil." });
  }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});