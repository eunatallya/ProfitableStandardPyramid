// ==========================================================
//  SERVIDOR MEGA-UNIFICADO (BD + CHAT + LOGIN + E-MAIL)
// ==========================================================

// --- Importações ---
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

// --- IMPORTAÇÕES ADICIONADAS PARA O CHAT ---
import http from 'http';
import { Server } from 'socket.io';

// --- Configuração do Ambiente ---
dotenv.config();
const { Pool } = pkg;

// --- Configuração de Caminhos (__dirname) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuração Principal do App ---
const app = express();
app.use(cors());
app.use(express.json());

// --- CRIAÇÃO DO SERVIDOR HTTP E SOCKET.IO ---
// O Socket.IO precisa ser "anexado" a um servidor http, que usa o 'app' do express
const server = http.createServer(app);
const io = new Server(server);

// --- Servir Arquivos Estáticos da pasta 'public' ---
// (Mantido o seu original, que serve a pasta 'public')
app.use(express.static(path.join(__dirname, "public")));

// --- Bloco de Content-Security-Policy ---
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' https://vlibras.gov.br https://fonts.googleapis.com https://fonts.gstatic.com; " +
    "script-src 'self' https://vlibras.gov.br 'unsafe-inline' http://localhost:3000; " + // Adicionado localhost para socket.io
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:;" +
    "connect-src 'self' ws://localhost:3000;" // Permite a conexão WebSocket
  );
  next();
});
// ----------------------------------------

// ==========================================================
//  CONFIGURAÇÃO DO BANCO DE DADOS (PostgreSQL)
// ==========================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// ==========================================================
//  CONFIGURAÇÃO DO CHATBOT GEMINI
// ==========================================================
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) console.warn("⚠️ AVISO: GEMINI_API_KEY não configurada.");
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;

async function chamarGemini(mensagem) {
  const prompt = `Você é um assistente de saúde mental empático e acolhedor. Ajude o usuário com apoio emocional e orientações leves. Usuário: ${mensagem}`;
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
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ A IA não respondeu.";
}

// ==========================================================
//  CONFIGURAÇÃO DO SERVIÇO DE E-MAIL (NODEMAILER)
// ==========================================================
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
});
app.use("/api/", limiter);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
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
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    client.release();
    res.status(200).json({ status: "Conexão com o PostgreSQL OK", hora_atual_db: result.rows[0].now });
  } catch (err) {
    console.error("ERRO AO CONECTAR AO BANCO DE DADOS:", err);
    res.status(500).json({ status: "ERRO: Falha na conexão com o Banco de Dados.", detalhe: err.message });
  }
});

// --- Rota de Registro de Usuário ---
app.post("/api/register", async (req, res) => {
  const { username, password, email, tipo } = req.body;

  if (!username || !password || !email || !tipo) {
    return res.status(400).json({ error: "Preencha todos os campos!" });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO users (username, email, password_hash, tipo) VALUES ($1, $2, $3, $4) RETURNING id, username, email, tipo",
      [username, email, password_hash, tipo]
    );

    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Usuário ou e-mail já existe." });
    }
    console.error("Erro no /api/register:", err);
    res.status(500).json({ error: "Erro interno ao registrar." });
  }
});

// --- Rota de Login ---
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Usuário e senha são obrigatórios." });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Usuário ou senha incorretos." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Usuário ou senha incorretos." });
    }

    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      tipo: user.tipo,
    });
  } catch (err) {
    console.error("Erro no /api/login:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// --- Rota do Chat (Gemini) ---
app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Mensagem vazia" });

  try {
    const respostaIA = await chamarGemini(message);
    res.json({ reply: respostaIA });
  } catch (err) {
    console.error("Erro no /chat:", err);
    res.status(500).json({ error: "Erro no servidor: " + err.message });
  }
});
server.listen(PORT, () => {
  console.log(`🚀 Servidor MEGA-UNIFICADO rodando em http://localhost:${PORT}`);
});