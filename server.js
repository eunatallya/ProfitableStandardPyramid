// ==========================================================
//  SERVIDOR UNIFICADO (E-MAIL + CHATBOT GEMINI)
// ==========================================================

// --- Importações (CommonJS) ---
require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch"); // Usando node-fetch@2 (compatível com require)
const cors = require("cors");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const { isEmail } = require("validator");
const path = require("path");

// --- Configuração Principal do App ---
const app = express();
app.use(cors()); // Habilita o CORS para todas as rotas
app.use(express.json()); // Habilita o parsing de JSON
app.use(express.static(path.join(__dirname, 'public'))); // Serve arquivos estáticos (como seu sos.html)


// ==========================================================
//  CONFIGURAÇÃO DO CHATBOT GEMINI
// ==========================================================
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) console.warn("⚠️ AVISO: GEMINI_API_KEY não configurada.");
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;

// Função auxiliar para chamar a API Gemini
async function chamarGemini(mensagem) {
  const prompt = `Você é um assistente de saúde mental empático e acolhedor. 
Ajude o usuário com apoio emocional e orientações leves.
Usuário: ${mensagem}`;

  const resposta = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0.7,
      },
    }),
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Erro Gemini: ${texto}`);
  }

  const data = await resposta.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ A IA não respondeu."
  );
}

// ==========================================================
//  CONFIGURAÇÃO DO SERVIÇO DE E-MAIL (NODEMAILER)
// ==========================================================
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
});
app.use("/api/", limiter); // Aplica o limitador de requisições apenas a rotas /api/

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter
  .verify()
  .then(() => {
    console.log("SMTP conectado com sucesso");
  })
  .catch((err) => {
    console.error("Erro na conexão SMTP:", err.message);
  });

// ==========================================================
//  ROTAS DA APLICAÇÃO
// ==========================================================

// --- Rota do Chat ---
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

// --- Rota de Registro de E-mail ---
app.post("/api/register", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isEmail(email)) {
      return res.status(400).json({ error: "E-mail inválido" });
    }

    const mailOptions = {
      from: `"Equipe ParapimPim" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Registro confirmado — ParapimPim",
      text: `Olá!\n\nSeu e-mail ${email} foi registrado com sucesso no site ParapimPim.\n\nSe não foi você, ignore este e-mail.\n\nAbraços,\nEquipe ParapimPim`,
      html: `<p>Olá!</p>
               <p>Seu e-mail <strong>${email}</strong> foi registrado com sucesso no site <strong>ParapimPim</strong>.</p>
               <p>Se não foi você, ignore este e-mail.</p>
               <p>Abraços,<br/>Equipe ParapimPim</p>`,
    };

    await transporter.sendMail(mailOptions);
    return res.json({ ok: true, message: "E-mail de boas-vindas enviado" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno ao enviar e-mail" });
  }
});

// ==========================================================
//  INICIALIZAÇÃO DO SERVIDOR (APENAS UMA VEZ)
// ==========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor UNIFICADO rodando em http://localhost:${PORT}`);
});
