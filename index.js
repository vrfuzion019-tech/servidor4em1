require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const WIINPAY_API = "https://api-v2.wiinpay.com.br";

function getPublicUrl() {
  const url = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
  return String(url).replace(/\/$/, '');
}

app.get('/', (req, res) => {
  res.send('🟢 Super Servidor ONLINE!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// Funções Utilitárias Wiinpay
function extrairQrCode(payload) {
  const obj = payload.data || payload.payment || payload;
  return obj.qr_code || obj.qrCode || obj.copia_cola || obj.brCode || obj.pix_code || obj.code || null;
}
function extrairPaymentId(payload) {
  const obj = payload.data || payload.payment || payload;
  return obj.paymentId || obj.payment_id || obj.id || obj.txid || null;
}
function pagamentoAprovado(payload) {
  const obj = payload.data || payload.payment || payload;
  const s = String(obj.status || obj.payment_status || '').toLowerCase();
  return ['paid', 'pago', 'approved', 'aprovado', 'completed', 'success', 'liquidado'].includes(s);
}

// ==========================================
// 1. ACERVO BRASIL
// ==========================================
if (process.env.TOKEN_ACERVO) {
  const bot = new TelegramBot(process.env.TOKEN_ACERVO, { polling: true });
  const CHANNEL_ID = process.env.CHANNEL_ACERVO;
  const WIINPAY_TOKEN = process.env.WIINPAY_TOKEN_ACERVO || process.env.WIINPAY_TOKEN;

  const botoes = {
    inline_keyboard: [
      [{ text: "🌍 Copy PayPal e-mail ($15)", url: "mailto:acervobr55@outlook.com?subject=VIP%20Access%20PayPal" }],
      [{ text: "😈 PLANO MENSAL (R$ 14,90)", callback_data: "plano_mensal" }],
      [{ text: "🔥 VITALÍCIO - R$ 29,90", callback_data: "plano_vitalicio" }]
    ]
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const txt = "🇧🇷 <b>ACERVO BRASIL +18</b> 🇧🇷\n\n🌍 <b>International payment via PayPal ($15 USD)</b>\n👉🏻 <code>acervobr55@outlook.com</code>\n\n⚠️ Send proof to: @hiagokff\n\n---------------------------\nAqui você encontra os melhores conteúdos!\n\nEscolha seu acesso:";
    bot.sendMessage(chatId, txt, { parse_mode: "HTML", reply_markup: botoes }).catch(() => {});
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    bot.answerCallbackQuery(query.id).catch(() => {});
    const plano = query.data === "plano_mensal" ? "mensal" : "vitalicio";
    const valor = plano === "mensal" ? 14.90 : 29.90;
    
    try {
      const res = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: WIINPAY_TOKEN, value: valor, name: "Cliente Acervo", email: "vip@acervo.com", description: `VIP ${plano}`, metadata: { chatId: String(chatId), plano }, webhook_url: `${getPublicUrl()}/webhook/acervo` })
      });
      const json = await res.json();
      const qr = extrairQrCode(json);
      if (!qr) throw new Error();
      bot.sendMessage(chatId, `💳 <b>PIX GERADO</b>\n\nValor: R$ ${valor.toFixed(2)}\n\n<code>${qr}</code>`, { parse_mode: "HTML" });
    } catch (e) {
      bot.sendMessage(chatId, "⚠️ Erro ao gerar Pix. Tente novamente.");
    }
  });

  app.post('/webhook/acervo', async (req, res) => {
    res.send('ok');
    if (pagamentoAprovado(req.body)) {
      const meta = req.body?.data?.metadata || req.body?.metadata || {};
      if (meta.chatId) {
        try {
          const invite = await bot.createChatInviteLink(CHANNEL_ID, { member_limit: 1 });
          bot.sendMessage(meta.chatId, `🎉 <b>PAGAMENTO APROVADO!</b>\n\nLink VIP: ${invite.invite_link}`, { parse_mode: 'HTML' });
        } catch (e) {}
      }
    }
  });
}

// ==========================================
// 2. MLK BRASILEIRO
// ==========================================
if (process.env.TOKEN_TRIBO) {
  const bot = new TelegramBot(process.env.TOKEN_TRIBO, { polling: true });
  const CHANNEL_ID = process.env.CHANNEL_TRIBO;
  const WIINPAY_TOKEN = process.env.WIINPAY_TOKEN_TRIBO || process.env.WIINPAY_TOKEN;
  const FOTO_START = 'AgACAgEAAxkBAAMKauyYIIuALKzh6EyonG1XDDHExk8AArYMaxtC6mhHNVO84I4U0FIBAAMCAAN5AAM9BA';

  const botoes = {
    inline_keyboard: [
      [{ text: "🌍 Copy PayPal e-mail ($15)", url: "mailto:acervobr55@outlook.com?subject=VIP%20Access%20PayPal" }],
      [{ text: "🥉 MENSAL (R$ 14,90)", callback_data: "plano_mensal" }],
      [{ text: "💎 VITALÍCIO - R$ 29,90 🔥", callback_data: "plano_vitalicio" }]
    ]
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const txt = "<b>🔥 MLK BRASILEIRO 🔥</b>\n\n🌍 <b>International payment via PayPal ($15 USD)</b>\n👉🏻 <code>acervobr55@outlook.com</code>\n\n⚠️ Send proof to: @hiagokff\n\n---------------------------\nConteúdos exclusivos e diários!\n\nEscolha seu plano:";
    try {
      await bot.sendPhoto(chatId, FOTO_START, { caption: txt, parse_mode: "HTML", reply_markup: botoes });
    } catch (e) {
      bot.sendMessage(chatId, txt, { parse_mode: "HTML", reply_markup: botoes }).catch(() => {});
    }
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    bot.answerCallbackQuery(query.id).catch(() => {});
    const plano = query.data === "plano_mensal" ? "mensal" : "vitalicio";
    const valor = plano === "mensal" ? 14.90 : 29.90;

    try {
      const res = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: WIINPAY_TOKEN, value: valor, name: "Cliente Mlk", email: "vip@mlk.com", description: `VIP ${plano}`, metadata: { chatId: String(chatId), plano }, webhook_url: `${getPublicUrl()}/webhook/mlk` })
      });
      const json = await res.json();
      const qr = extrairQrCode(json);
      if (!qr) throw new Error();
      bot.sendMessage(chatId, `💳 <b>PIX GERADO</b>\n\nValor: R$ ${valor.toFixed(2)}\n\n<code>${qr}</code>`, { parse_mode: "HTML" });
    } catch (e) {
      bot.sendMessage(chatId, "⚠️ Erro ao gerar Pix. Tente novamente.");
    }
  });

  app.post('/webhook/mlk', async (req, res) => {
    res.send('ok');
    if (pagamentoAprovado(req.body)) {
      const meta = req.body?.data?.metadata || req.body?.metadata || {};
      if (meta.chatId) {
        try {
          const invite = await bot.createChatInviteLink(CHANNEL_ID, { member_limit: 1 });
          bot.sendMessage(meta.chatId, `🎉 <b>PAGAMENTO APROVADO!</b>\n\nLink VIP: ${invite.invite_link}`, { parse_mode: 'HTML' });
        } catch (e) {}
      }
    }
  });
}

// ==========================================
// 3. BIEL SALLES
// ==========================================
if (process.env.TOKEN_BIEL) {
  const bot = new TelegramBot(process.env.TOKEN_BIEL, { polling: true });
  const CHANNEL_ID = process.env.CHANNEL_BIEL;
  const WIINPAY_TOKEN = process.env.WIINPAY_TOKEN_BIEL || process.env.WIINPAY_TOKEN;

  const botoes = {
    inline_keyboard: [
      [{ text: "R$ 16,90 - 7 Dias", callback_data: "plano_7" }],
      [{ text: "R$ 34,90 - 30 Dias", callback_data: "plano_30" }],
      [{ text: "R$ 69,90 - Vitalício", callback_data: "plano_vitalicio" }]
    ]
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const txt = "Oi, delícia 😈\n\nEscolha seu plano VIP do Biel Salles:";
    bot.sendMessage(chatId, txt, { parse_mode: "HTML", reply_markup: botoes }).catch(() => {});
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    bot.answerCallbackQuery(query.id).catch(() => {});
    
    let valor = 0, tipo = "";
    if (query.data === "plano_7") { valor = 16.90; tipo = "7_dias"; }
    else if (query.data === "plano_30") { valor = 34.90; tipo = "30_dias"; }
    else if (query.data === "plano_vitalicio") { valor = 69.90; tipo = "vitalicio"; }

    if (valor <= 0) return;

    try {
      const res = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: WIINPAY_TOKEN, value: valor, name: "Cliente Biel", email: "vip@biel.com", description: `VIP ${tipo}`, metadata: { chatId: String(chatId), plano: tipo }, webhook_url: `${getPublicUrl()}/webhook/biel` })
      });
      const json = await res.json();
      const qr = extrairQrCode(json);
      if (!qr) throw new Error();
      bot.sendMessage(chatId, `💳 <b>PIX GERADO</b>\n\nValor: R$ ${valor.toFixed(2)}\n\n<code>${qr}</code>`, { parse_mode: "HTML" });
    } catch (e) {
      bot.sendMessage(chatId, "⚠️ Erro ao gerar Pix.");
    }
  });

  app.post('/webhook/biel', async (req, res) => {
    res.send('ok');
    if (pagamentoAprovado(req.body)) {
      const meta = req.body?.data?.metadata || req.body?.metadata || {};
      if (meta.chatId) {
        try {
          const invite = await bot.createChatInviteLink(CHANNEL_ID, { member_limit: 1 });
          bot.sendMessage(meta.chatId, `🎉 <b>PAGAMENTO APROVADO!</b>\n\nLink VIP: ${invite.invite_link}`, { parse_mode: 'HTML' });
        } catch (e) {}
      }
    }
  });
}

// ==========================================
// 4. ARYAN ALMEIDA
// ==========================================
if (process.env.TOKEN_ARYAN) {
  const bot = new TelegramBot(process.env.TOKEN_ARYAN, { polling: true });
  const CHANNEL_ID = process.env.CHANNEL_ARYAN;
  const WIINPAY_TOKEN = process.env.WIINPAY_TOKEN_ARYAN || process.env.WIINPAY_TOKEN;

  const botoes = {
    inline_keyboard: [
      [{ text: "R$ 16,90 - 7 Dias", callback_data: "plano_7" }],
      [{ text: "R$ 34,90 - 30 Dias", callback_data: "plano_30" }],
      [{ text: "R$ 69,90 - Vitalício", callback_data: "plano_vitalicio" }]
    ]
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const txt = "E aí, curtindo a visão? 😈\n\nEscolha seu plano VIP do Aryan Almeida:";
    bot.sendMessage(chatId, txt, { parse_mode: "HTML", reply_markup: botoes }).catch(() => {});
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    bot.answerCallbackQuery(query.id).catch(() => {});
    
    let valor = 0, tipo = "";
    if (query.data === "plano_7") { valor = 16.90; tipo = "7_dias"; }
    else if (query.data === "plano_30") { valor = 34.90; tipo = "30_dias"; }
    else if (query.data === "plano_vitalicio") { valor = 69.90; tipo = "vitalicio"; }

    if (valor <= 0) return;

    try {
      const res = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: WIINPAY_TOKEN, value: valor, name: "Cliente Aryan", email: "vip@aryan.com", description: `VIP ${tipo}`, metadata: { chatId: String(chatId), plano: tipo }, webhook_url: `${getPublicUrl()}/webhook/aryan` })
      });
      const json = await res.json();
      const qr = extrairQrCode(json);
      if (!qr) throw new Error();
      bot.sendMessage(chatId, `💳 <b>PIX GERADO</b>\n\nValor: R$ ${valor.toFixed(2)}\n\n<code>${qr}</code>`, { parse_mode: "HTML" });
    } catch (e) {
      bot.sendMessage(chatId, "⚠️ Erro ao gerar Pix.");
    }
  });

  app.post('/webhook/aryan', async (req, res) => {
    res.send('ok');
    if (pagamentoAprovado(req.body)) {
      const meta = req.body?.data?.metadata || req.body?.metadata || {};
      if (meta.chatId) {
        try {
          const invite = await bot.createChatInviteLink(CHANNEL_ID, { member_limit: 1 });
          bot.sendMessage(meta.chatId, `🎉 <b>PAGAMENTO APROVADO!</b>\n\nLink VIP: ${invite.invite_link}`, { parse_mode: 'HTML' });
        } catch (e) {}
      }
    }
  });
}
