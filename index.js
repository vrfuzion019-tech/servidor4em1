require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// ==========================================
// 1. O SUPER SERVIDOR EXPRESS (O "Condomínio")
// ==========================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 3000;
const WIINPAY_API = "https://api-v2.wiinpay.com.br";

function getPublicUrl() {
  const url = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
  return String(url).replace(/\/\$/, '');
}

app.get('/', (req, res) => {
  res.send(`🟢 Super Servidor ONLINE! Rodando 4 Bots simultaneamente.`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Central de Bots aberta na porta ${PORT}`);
});

// ==========================================
// 2. FUNÇÕES GLOBAIS DA WIINPAY (Economiza código)
// ==========================================
function objetoPagamento(payload) {
  if (!payload || typeof payload !== 'object') return {};
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data) && payload.data[0]) return payload.data[0];
  if (payload.payment && typeof payload.payment === 'object') return payload.payment;
  return payload;
}
function extrairStatus(payload) {
  const obj = objetoPagamento(payload);
  const bruto = obj.status ?? obj.payment_status ?? obj.state ?? obj.situation ?? '';
  return String(bruto).toLowerCase().trim();
}
function pagamentoAprovado(payload) {
  const s = extrairStatus(payload);
  return ['paid', 'pago', 'approved', 'aprovado', 'completed', 'success', 'liquidado'].includes(s);
}
function extrairPaymentId(payload) {
  const obj = objetoPagamento(payload);
  return obj.paymentId || obj.payment_id || obj.id || obj.txid || payload.paymentId || payload.id || null;
}
function extrairQrCode(payload) {
  const obj = objetoPagamento(payload);
  return obj.qr_code || obj.qrCode || obj.copia_cola || obj.brCode || obj.pix_code || obj.code || null;
}
function extrairMetadata(payload) {
  const obj = objetoPagamento(payload);
  const meta = obj.metadata || payload.metadata || {};
  if (typeof meta === 'string') { try { return JSON.parse(meta); } catch (e) { return {}; } }
  return meta || {};
}
function getDataAmanha() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const dia = String(amanha.getDate()).padStart(2, '0');
  const mes = String(amanha.getMonth() + 1).padStart(2, '0');
  const ano = amanha.getFullYear();
  return dia + '/' + mes + '/' + ano;
}

// ==========================================
// 3. MÓDULO 1: ACERVO BRASIL
// ==========================================
function iniciarAcervoBrasil() {
  if (!process.env.TOKEN_ACERVO) return console.log("⚠️ TOKEN_ACERVO ausente.");
  
  const bot = new TelegramBot(process.env.TOKEN_ACERVO, { polling: true });
  const CHANNEL_ID = process.env.CHANNEL_ACERVO;
  const WIINPAY_TOKEN = process.env.WIINPAY_TOKEN_ACERVO || process.env.WIINPAY_TOKEN;
  const pagamentosPendentes = new Map();

  const VIDEO_START = 'BAACAgEAAxkBAAMDasfXsVxDTJuo2F6Dz6BUJaPu6XAAAs0JAAJkbzlGBVE4HlctfSA9BA'; 
  const botoesPlanos = {
    inline_keyboard: [
      [{ text: "😈 PLANO MENSAL (R\$ 14,90)", callback_data: "plano_mensal" }],
      [{ text: "🔥 VITALÍCIO - R\$ 29,90", callback_data: "plano_vitalicio" }]
    ]
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const textoLegenda = "🇧🇷 <b>ACERVO BRASIL</b> 🇧🇷\n\nAqui você encontra as melhores chamadinhas, lives e vazados com atualização todo dia.\n\nNada de enrolação, o link é gerado automaticamente após o pagamento.\n\nEscolhe seu acesso:\n\n😈 <b>PLANO MENSAL</b>\n👉 30 dias de acesso — R\$ 14,90\n\n🔥 <b>Pagamento único. Acesso pra sempre.</b>\n👉 De <s>R\$ 60,00</s> por apenas R\$ 29,90\n\n⚠️ O acesso Vitalício está disponível até <b>" + getDataAmanha() + "</b>, são poucas vagas.\n\n🔒 Garante seu acesso agora 👇";
    try { await bot.sendVideo(chatId, VIDEO_START, { caption: textoLegenda, parse_mode: "HTML", reply_markup: botoesPlanos }); } 
    catch (e) { await bot.sendMessage(chatId, textoLegenda, { parse_mode: "HTML", reply_markup: botoesPlanos }); }
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    bot.answerCallbackQuery(query.id).catch(() => {});
    const plano = query.data === "plano_mensal" ? "mensal" : "vitalicio";
    const valor = plano === "mensal" ? 14.90 : 29.90;
    const msgL = await bot.sendMessage(chatId, "⏳ Segura aí, gerando seu PIX...");

    try {
      const URL_WEBHOOK = `${getPublicUrl()}/webhook/acervo`;
      const res = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: WIINPAY_TOKEN, value: valor, name: "Cliente Acervo Brasil", email: "vip@acervobrasil.com", description: `Plano VIP ${plano}`, metadata: { chatId: String(chatId), plano: plano }, webhook_url: URL_WEBHOOK })
      });
      const json = await res.json();
      bot.deleteMessage(chatId, msgL.message_id).catch(() => {});
      const qr = json.data?.qr_code || json.qr_code;
      if (!qr) throw new Error("Erro PIX");

      await bot.sendMessage(chatId, `💳 <b>PIX GERADO COM SUCESSO</b>\n\n💰 Valor: R$ ${valor.toFixed(2).replace('.', ',')}\n\n<code>${qr}</code>\n\n📌 Toca no código aí em cima pra copiar.\n\n✅ O link do grupo sai na hora!`, { parse_mode: "HTML" });
      pagamentosPendentes.set(String(chatId), { timestamp: Date.now(), etapa: 0 });
    } catch (e) { bot.sendMessage(chatId, "⚠️ Instabilidade. Tenta de novo."); }
  });

  app.post('/webhook/acervo', async (req, res) => {
    res.send('ok');
    const data = req.body?.data || req.body;
    if (['paid', 'pago', 'approved', 'aprovado', 'liquidado'].includes(String(data.status || data.payment_status).toLowerCase())) {
      const meta = data.metadata || {};
      if (meta.chatId) {
        pagamentosPendentes.delete(String(meta.chatId)); 
        try {
          const invite = await bot.createChatInviteLink(CHANNEL_ID, { member_limit: 1 });
          let texto = meta.plano === 'vitalicio' ? "🎉 <b>PAGAMENTO APROVADO!</b>\n\nLink do Grupo VIP: " + invite.invite_link + "\n\n⚠️ <b>Aviso:</b> Você é Vitalício! Acesso garantido pra sempre." : "🎉 <b>PAGAMENTO APROVADO!</b>\n\nLink do Grupo VIP (30 dias): " + invite.invite_link;
          await bot.sendMessage(meta.chatId, texto, { parse_mode: 'HTML' });
        } catch (e) {}
      }
    }
  });

  setInterval(() => {
    const agora = Date.now();
    for (const [chatId, dados] of pagamentosPendentes.entries()) {
      const min = (agora - dados.timestamp) / 60000;
      if (min >= 5 && dados.etapa === 0) { dados.etapa = 1; bot.sendMessage(chatId, `⏳ Mano, vi que você gerou o PIX mas não finalizou.\n\nO acesso é imediato, só falta o pagamento pra entrar! 🔥 Clica aí e garante antes que perca a vaga.`, { parse_mode: "HTML", reply_markup: botoesPlanos }).catch(()=>{}); } 
      else if (min >= 15 && dados.etapa === 1) { dados.etapa = 2; bot.sendMessage(chatId, `👀 E aí, vai ficar moscando?\n\nO grupo tá bombando agora mesmo! Copia o PIX ali em cima ou gera de novo. O bagulho é louco e sai na hora. 😈`, { parse_mode: "HTML", reply_markup: botoesPlanos }).catch(()=>{}); }
      else if (min >= 30 && dados.etapa === 2) { dados.etapa = 3; bot.sendMessage(chatId, `⚠️ SE LIGA: Seu código PIX vai expirar, parceiro!\n\nAinda dá tempo de colar com a gente. Finaliza o pagamento agora ou gera um novo código:`, { parse_mode: "HTML", reply_markup: botoesPlanos }).catch(()=>{}); }
      else if (min >= 60 && dados.etapa === 3) { bot.sendMessage(chatId, `🚨 ÚLTIMA CHAMADA!\n\nSeu pedido foi cancelado. Se ainda quiser colar com a gente, gera um novo pagamento aí embaixo 👇`, { parse_mode: "HTML", reply_markup: botoesPlanos }).catch(()=>{}); pagamentosPendentes.delete(chatId); }
    }
  }, 60000); 
}

// ==========================================
// 4. MÓDULO 2: TRIBO DOS NOVINHOS
// ==========================================
function iniciarTriboDosNovinhos() {
  if (!process.env.TOKEN_TRIBO) return console.log("⚠️ TOKEN_TRIBO ausente.");
  
  const bot = new TelegramBot(process.env.TOKEN_TRIBO, { polling: true });
  const CHANNEL_ID = process.env.CHANNEL_TRIBO;
  const WIINPAY_TOKEN = process.env.WIINPAY_TOKEN_TRIBO || process.env.WIINPAY_TOKEN;
  const vitalicios = []; 
  const pagamentosPendentes = new Map();

  const VIDEO_START = 'BAACAgEAAxkBAAIBMmq7LZR5l-cOPweRnG1opIa527oQAALuCAACrkLhRfLxICCwqAVBPQQ'; 
  const botoesPlanos = {
    inline_keyboard: [
      [{ text: "🥉 MENSAL (R\$ 14,90)", callback_data: "plano_mensal" }],
      [{ text: "💎 VITALÍCIO - R\$ 29,90 🔥", callback_data: "plano_vitalicio" }]
    ]
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const textoLegenda = `<b>🔥 TRIBO DOS NOVINHOS 🔥</b>\n\nPapo reto, os conteúdos mais brabos, CHAMADINHAS, LIVES, VAZADINHOS que tu não acha em lugar nenhum, com atualizações diarias.\n\nEscolhe teu plano aí embaixo:\n\n🥉 <b>PLANO MENSAL</b>\n👉 Acesso por 30 dias - R$ 14,90\n\n💎 <b>PLANO VITALÍCIO</b> (OFERTA RELÂMPAGO)\n👉 DE <s>R$ 60,00</s> POR APENAS R$ 29,90 <b>(50% OFF 🔥)</b>\nPagamento único. O bagulho é teu pra sempre!\n\n🔥 GARANTE LOGO O TEU ACESSO 🔥`;
    try { await bot.sendVideo(chatId, VIDEO_START, { caption: textoLegenda, parse_mode: "HTML", reply_markup: botoesPlanos }); } 
    catch (e) { await bot.sendMessage(chatId, textoLegenda, { parse_mode: "HTML", reply_markup: botoesPlanos }); }
    setTimeout(async () => { await bot.sendMessage(chatId, `⚠️ <b>Papo reto:</b> Assinantes tem um comando exclusivo (/resgatar) pra pegar o link de novo caso dê caô e o grupo caia.`, { parse_mode: 'HTML' }); }, 1000);
  });

  bot.onText(/\/resgatar/, async (msg) => {
    const chatId = String(msg.chat.id);
    if (!vitalicios.includes(chatId)) return bot.sendMessage(chatId, "❌ Tu não tem assinatura vitalícia ativa, cria.");
    try {
      const invite = await bot.createChatInviteLink(CHANNEL_ID, { member_limit: 1 });
      await bot.sendMessage(chatId, `✅ <b>Assinante Vitalício na base!</b>\n\nPega teu novo link de acesso aí:\n\n${invite.invite_link}\n\n<i>(Papo reto: esse link é de uso único, não passa pra ninguém)</i>`, { parse_mode: 'HTML' });
    } catch (e) { bot.sendMessage(chatId, "⚠️ Deu caô ao gerar o link."); }
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    bot.answerCallbackQuery(query.id).catch(() => {});
    const plano = query.data === "plano_mensal" ? "mensal" : "vitalicio";
    const valor = plano === "mensal" ? 14.90 : 29.90;
    const msgL = await bot.sendMessage(chatId, "⏳ Segura a onda, gerando teu PIX...");

    try {
      const URL_WEBHOOK = `${getPublicUrl()}/webhook/tribo`;
      const res = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: WIINPAY_TOKEN, value: valor, name: "Cliente Tribo", email: "vip@tribonovinhos.com", description: `Plano VIP ${plano}`, metadata: { chatId: String(chatId), plano: plano }, webhook_url: URL_WEBHOOK })
      });
      const json = await res.json();
      bot.deleteMessage(chatId, msgL.message_id).catch(() => {});
      const qr = json.data?.qr_code || json.qr_code;
      if (!qr) throw new Error("Erro PIX");

      await bot.sendMessage(chatId, `💳 <b>PIX GERADO NO ESQUEMA</b>\n\n💰 Valor: R$ ${valor.toFixed(2).replace('.', ',')}\n\n<code>${qr}</code>\n\n📌 Toca no código aí em cima pra copiar.\n\n✅ O acesso cai na hora!`, { parse_mode: "HTML" });
      pagamentosPendentes.set(String(chatId), { timestamp: Date.now(), etapa: 0 });
    } catch (e) { bot.sendMessage(chatId, "⚠️ Instabilidade. Tenta de novo rapidinho."); }
  });

  app.post('/webhook/tribo', async (req, res) => {
    res.send('ok');
    const data = req.body?.data || req.body;
    if (['paid', 'pago', 'approved', 'aprovado', 'liquidado'].includes(String(data.status || data.payment_status).toLowerCase())) {
      const meta = data.metadata || {};
      if (meta.chatId) {
        pagamentosPendentes.delete(String(meta.chatId)); 
        try {
          const invite = await bot.createChatInviteLink(CHANNEL_ID, { member_limit: 1 });
          const texto = meta.plano === 'vitalicio' ? `🎉 <b>PAGAMENTO APROVADO, CRIA!</b>\n\nLink do Grupo VIP: ${invite.invite_link}\n\n⚠️ <b>VISÃO:</b> Tu é Vitalício! Se der caô no grupo, digita /resgatar aqui no bot!` : `🎉 <b>PAGAMENTO APROVADO, CRIA!</b>\n\nLink do Grupo VIP (30 dias): ${invite.invite_link}`;
          await bot.sendMessage(meta.chatId, texto, { parse_mode: 'HTML' });
          if (meta.plano === 'vitalicio' && !vitalicios.includes(String(meta.chatId))) vitalicios.push(String(meta.chatId));
        } catch (e) {}
      }
    }
  });

  setInterval(() => {
    const agora = Date.now();
    for (const [chatId, dados] of pagamentosPendentes.entries()) {
      const min = (agora - dados.timestamp) / 60000;
      if (min >= 5 && dados.etapa === 0) { dados.etapa = 1; bot.sendMessage(chatId, `⏳ Coé! Vi que tu gerou o PIX mas não finalizou.\n\nO acesso é imediato, só falta o pagamento pra entrar na resenha! 🔥 Clica aí e garante antes que tu perca a vaga.`, { parse_mode: "HTML", reply_markup: botoesPlanos }).catch(()=>{}); } 
      else if (min >= 15 && dados.etapa === 1) { dados.etapa = 2; bot.sendMessage(chatId, `👀 Tá moscando?\n\nO grupo tá pegando fogo agora mermo! Copia o PIX ali em cima ou gera de novo. O bagulho é louco e sai na hora. 😈`, { parse_mode: "HTML", reply_markup: botoesPlanos }).catch(()=>{}); }
      else if (min >= 30 && dados.etapa === 2) { dados.etapa = 3; bot.sendMessage(chatId, `⚠️ VISÃO: Teu código PIX vai expirar, parceiro!\n\nAinda dá tempo de garantir teu acesso. Finaliza o pagamento agora ou gera um novo código:`, { parse_mode: "HTML", reply_markup: botoesPlanos }).catch(()=>{}); }
      else if (min >= 60 && dados.etapa === 3) { bot.sendMessage(chatId, `🚨 ÚLTIMA CHANCE!\n\nTeu pedido rodou e a vaga vai pro próximo cria da fila 👇`, { parse_mode: "HTML", reply_markup: botoesPlanos }).catch(()=>{}); pagamentosPendentes.delete(chatId); }
    }
  }, 60000); 
}

// ==========================================
// 5. MÓDULO 3: BIEL SALLES
// ==========================================
function iniciarBielSalles() {
  if (!process.env.TOKEN_BIEL) return console.log("⚠️ TOKEN_BIEL ausente.");
  
  const bot = new TelegramBot(process.env.TOKEN_BIEL, { polling: true });
  const CHANNEL_ID = process.env.CHANNEL_BIEL;
  const WIINPAY_KEY = process.env.WIINPAY_TOKEN_BIEL || process.env.WIINPAY_TOKEN;
  
  const pagamentos = []; const assinantes = []; const processados = new Set();

  const botoesPlanos = {
    inline_keyboard: [
      [{ text: "R\$ 16,90 / Acesso VIP (24h) - 7 Dias", callback_data: "plano_7" }],
      [{ text: "R\$ 34,90 / Acesso VIP 25% OFF - 30 Dias", callback_data: "plano_30" }],
      [{ text: "R\$ 69,90 / Acesso VIP (24h) - Vitalício", callback_data: "plano_vitalicio" }]
    ]
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const MIDIA_BIEL = 'AgACAgEAAxkBAAMnaqLwihzilERlQhawn8_vLIOrBsoAAugMaxtaAxlFCQJwBIqWKe0BAAMCAAN5AAM9BA';
    const texto1 = `Oi, delícia 😈\nQue bom que você apertou em Iniciar… Aqui não tem enrolação.\n\nSó conteúdo quente, sem censura e feito pra te deixar molhado de tesão 🔥\n\n🍑 Fotos exclusivas\n🎥 Vídeos bem safados\n💦 Conteúdos do meu Privacy que não saem em lugar nenhum\n\nPra entrar no meu grupo VIP é só escolher o plano e pagar o PIX:`;
    const texto2 = `Assim que o PIX cair, o bot te libera na hora ⚡\nAcesso imediato, sem enrolação.\nTô te esperando 😈`;

    try {
      try { await bot.sendVideo(chatId, MIDIA_BIEL); } catch (e) { await bot.sendPhoto(chatId, MIDIA_BIEL); }
      await new Promise(r => setTimeout(r, 300));
      await bot.sendMessage(chatId, texto1, { parse_mode: "HTML", reply_markup: botoesPlanos });
      await new Promise(r => setTimeout(r, 300));
      await bot.sendMessage(chatId, texto2, { parse_mode: "HTML" });
    } catch (e) {}
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    bot.answerCallbackQuery(query.id).catch(() => {});

    let valor = 0; let tipoPlano = ""; let nomePlano = "";
    if (query.data === "plano_7") { valor = 16.90; tipoPlano = "7_dias"; nomePlano = "Acesso VIP 7 Dias"; }
    else if (query.data === "plano_30") { valor = 34.90; tipoPlano = "30_dias"; nomePlano = "Acesso VIP 30 Dias"; }
    else if (query.data === "plano_vitalicio") { valor = 69.90; tipoPlano = "vitalicio"; nomePlano = "Acesso VIP Vitalicio"; }

    if (valor <= 0) return;
    const msgLoading = await bot.sendMessage(chatId, `⏳ Aguarde, gerando seu PIX seguro e anônimo...`);

    try {
      const URL_WEBHOOK = `${getPublicUrl()}/webhook/biel`;
      const response = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: WIINPAY_KEY, value: valor, name: "Cliente VIP Biel", email: "vip@bielsalles.com", description: nomePlano, metadata: { chatId: String(chatId), plano: tipoPlano }, webhook_url: URL_WEBHOOK })
      });
      const json = await response.json();
      bot.deleteMessage(chatId, msgLoading.message_id).catch(() => {});
      const qrcode = extrairQrCode(json); const txid = extrairPaymentId(json);
      if (!qrcode || !txid) throw new Error("Sem QR Code");

      const texto = `💳 PIX GERADO COM SUCESSO\n\n💰 Valor: R$ ${valor.toFixed(2).replace('.', ',')}\n\n📋 Código PIX (Copia e Cola):\n\n\`\${qrcode}\`\n\n📌 Toque no código acima para copiar.\n\n⏳ O acesso é liberado automaticamente após o pagamento.`;
      const mensagemPix = await bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });
      pagamentos.push({ txid: String(txid), chatId: String(chatId), mensagemId: String(mensagemPix.message_id), status: "pending", createdAt: Date.now(), etapaFunil: 0, plano: tipoPlano });
    } catch (e) { bot.sendMessage(chatId, "⚠️ Sistema indisponível."); }
  });

  app.post('/webhook/biel', async (req, res) => {
    res.status(200).json({ ok: true });
    try {
      const payload = req.body || {};
      if (!pagamentoAprovado(payload)) return;
      const txid = extrairPaymentId(payload); const meta = extrairMetadata(payload);
      const pendente = pagamentos.find(p => String(p.txid) === String(txid));
      const chatId = meta.chatId || pendente?.chatId; const plano = meta.plano || pendente?.plano; const mensagemId = pendente?.mensagemId;

      if (!chatId) return;
      const chave = String(txid || `${chatId}-${plano}`);
      if (processados.has(chave)) return;
      processados.add(chave);

      const invite = await bot.createChatInviteLink(CHANNEL_ID, { member_limit: 1 });
      if (mensagemId) try { await bot.deleteMessage(String(chatId), mensagemId); } catch (e) {}
      await bot.sendMessage(chatId, `🎉 PAGAMENTO APROVADO!\n\nSeu pagamento foi confirmado ✅\n\n🔒 Acesso liberado:\n\n${invite.invite_link}\n\n⚠️ Link único com limite de 1 uso.`);
      
      const agora = Date.now(); let validade = null;
      if (plano === '7_dias') validade = agora + (7 * 24 * 60 * 60 * 1000);
      else if (plano === '30_dias') validade = agora + (30 * 24 * 60 * 60 * 1000);
      if (validade) assinantes.push({ chatId: String(chatId), validade });
    } catch (e) {}
  });

  setInterval(async () => {
    const pendentes = pagamentos.filter(p => p.status === 'pending');
    for (const cliente of pendentes) {
      const min = (Date.now() - cliente.createdAt) / 60000;
      if (min >= 5 && cliente.etapaFunil === 0) {
        bot.sendMessage(cliente.chatId, `Ei… 👀 Você gerou o PIX e sumiu.\n\nTá com medo de ver o quanto eu fico gostoso quando tô gozando? 😈 O acesso é na hora.\n\nFinaliza agora e vem me ver de verdade 🤤💦`, { parse_mode: "HTML", reply_markup: botoesPlanos }).catch(() => {});
        cliente.etapaFunil = 1;
      }
    }
  }, 15000);

  setInterval(async () => {
    const agora = Date.now();
    for (let i = assinantes.length - 1; i >= 0; i--) {
      const a = assinantes[i];
      if (agora > a.validade) {
        try { await bot.banChatMember(CHANNEL_ID, a.chatId); await bot.unbanChatMember(CHANNEL_ID, a.chatId); await bot.sendMessage(a.chatId, `⚠️ <b>Seu tempo de acesso expirou!</b>\n\nEspero que tenha gozado bastante! 😈 Para renovar, digite /start e escolha um novo plano.`, { parse_mode: 'HTML' }); assinantes.splice(i, 1); } catch (e) {}
      }
    }
  }, 3600000);
}

// ==========================================
// 6. MÓDULO 4: ARYAN ALMEIDA
// ==========================================
function iniciarAryanAlmeida() {
  if (!process.env.TOKEN_ARYAN) return console.log("⚠️ TOKEN_ARYAN ausente.");
  
  const bot = new TelegramBot(process.env.TOKEN_ARYAN, { polling: true });
  const CHANNEL_ID = process.env.CHANNEL_ARYAN;
  const WIINPAY_KEY = process.env.WIINPAY_TOKEN_ARYAN || process.env.WIINPAY_TOKEN;
  
  const pagamentos = []; const assinantes = []; const processados = new Set();

  const botoesPlanos = {
    inline_keyboard: [
      [{ text: "R\$ 16,90 / Acesso VIP (24h) - 7 Dias", callback_data: "plano_7" }],
      [{ text: "R\$ 34,90 / Acesso VIP 25% OFF - 30 Dias", callback_data: "plano_30" }],
      [{ text: "R\$ 69,90 / Acesso VIP (24h) - Vitalício", callback_data: "plano_vitalicio" }]
    ]
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    // Substitua a mídia abaixo quando tiver o vídeo do Aryan
    const MIDIA_ARYAN = 'BAACAgEAAxkBAAMFapIc9eVh_YzY9LXtb2LhovAJ89MAAqwIAAK7u5FEiAYu93eD9Kk9BA'; 
    const texto1 = `E aí, curtindo a visão? 😈\nQue bom que você apertou em Iniciar… Aqui não tem enrolação.\n\nSó conteúdo quente, sem censura e feito pra te deixar no grau 🔥\n\n🍑 Fotos exclusivas\n🎥 Vídeos sem corte\n💦 Conteúdos que não saem em lugar nenhum\n\nPra entrar no meu grupo VIP é só escolher o plano e pagar o PIX:`;
    const texto2 = `Assim que o PIX cair, o bot te libera na hora ⚡\nAcesso imediato, sem enrolação.\nTô te esperando 😈`;

    try {
      try { await bot.sendVideo(chatId, MIDIA_ARYAN); } catch (e) { await bot.sendPhoto(chatId, MIDIA_ARYAN); }
      await new Promise(r => setTimeout(r, 300));
      await bot.sendMessage(chatId, texto1, { parse_mode: "HTML", reply_markup: botoesPlanos });
      await new Promise(r => setTimeout(r, 300));
      await bot.sendMessage(chatId, texto2, { parse_mode: "HTML" });
    } catch (e) {}
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    bot.answerCallbackQuery(query.id).catch(() => {});

    let valor = 0; let tipoPlano = ""; let nomePlano = "";
    if (query.data === "plano_7") { valor = 16.90; tipoPlano = "7_dias"; nomePlano = "Acesso VIP 7 Dias"; }
    else if (query.data === "plano_30") { valor = 34.90; tipoPlano = "30_dias"; nomePlano = "Acesso VIP 30 Dias"; }
    else if (query.data === "plano_vitalicio") { valor = 69.90; tipoPlano = "vitalicio"; nomePlano = "Acesso VIP Vitalicio"; }

    if (valor <= 0) return;
    const msgLoading = await bot.sendMessage(chatId, `⏳ Aguarde, gerando seu PIX seguro e anônimo...`);

    try {
      const URL_WEBHOOK = `${getPublicUrl()}/webhook/aryan`;
      const response = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: WIINPAY_KEY, value: valor, name: "Cliente VIP Aryan", email: "vip@aryanalmeida.com", description: nomePlano, metadata: { chatId: String(chatId), plano: tipoPlano }, webhook_url: URL_WEBHOOK })
      });
      const json = await response.json();
      bot.deleteMessage(chatId, msgLoading.message_id).catch(() => {});
      const qrcode = extrairQrCode(json); const txid = extrairPaymentId(json);
      if (!qrcode || !txid) throw new Error("Sem QR Code");

      const texto = `💳 PIX GERADO COM SUCESSO\n\n💰 Valor: R$ ${valor.toFixed(2).replace('.', ',')}\n\n📋 Código PIX (Copia e Cola):\n\n\`\${qrcode}\`\n\n📌 Toque no código acima para copiar.\n\n⏳ O acesso é liberado automaticamente após o pagamento.`;
      const mensagemPix = await bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });
      pagamentos.push({ txid: String(txid), chatId: String(chatId), mensagemId: String(mensagemPix.message_id), status: "pending", createdAt: Date.now(), etapaFunil: 0, plano: tipoPlano });
    } catch (e) { bot.sendMessage(chatId, "⚠️ Sistema indisponível."); }
  });

  app.post('/webhook/aryan', async (req, res) => {
    res.status(200).json({ ok: true });
    try {
      const payload = req.body || {};
      if (!pagamentoAprovado(payload)) return;
      const txid = extrairPaymentId(payload); const meta = extrairMetadata(payload);
      const pendente = pagamentos.find(p => String(p.txid) === String(txid));
      const chatId = meta.chatId || pendente?.chatId; const plano = meta.plano || pendente?.plano; const mensagemId = pendente?.mensagemId;

      if (!chatId) return;
      const chave = String(txid || `${chatId}-${plano}`);
      if (processados.has(chave)) return;
      processados.add(chave);

      const invite = await bot.createChatInviteLink(CHANNEL_ID, { member_limit: 1 });
      if (mensagemId) try { await bot.deleteMessage(String(chatId), mensagemId); } catch (e) {}
      await bot.sendMessage(chatId, `🎉 PAGAMENTO APROVADO!\n\nSeu pagamento foi confirmado ✅\n\n🔒 Acesso liberado:\n\n${invite.invite_link}\n\n⚠️ Link único com limite de 1 uso.`);
      
      const agora = Date.now(); let validade = null;
      if (plano === '7_dias') validade = agora + (7 * 24 * 60 * 60 * 1000);
      else if (plano === '30_dias') validade = agora + (30 * 24 * 60 * 60 * 1000);
      if (validade) assinantes.push({ chatId: String(chatId), validade });
    } catch (e) {}
  });

  setInterval(async () => {
    const pendentes = pagamentos.filter(p => p.status === 'pending');
    for (const cliente of pendentes) {
      const min = (Date.now() - cliente.createdAt) / 60000;
      if (min >= 5 && cliente.etapaFunil === 0) {
        bot.sendMessage(cliente.chatId, `Ei… 👀 Você gerou o PIX e sumiu.\n\nTá com medo da visão? 😈 O acesso é na hora.\n\nFinaliza agora e vem me ver de verdade 🤤💦`, { parse_mode: "HTML", reply_markup: botoesPlanos }).catch(() => {});
        cliente.etapaFunil = 1;
      }
    }
  }, 15000);

  setInterval(async () => {
    const agora = Date.now();
    for (let i = assinantes.length - 1; i >= 0; i--) {
      const a = assinantes[i];
      if (agora > a.validade) {
        try { await bot.banChatMember(CHANNEL_ID, a.chatId); await bot.unbanChatMember(CHANNEL_ID, a.chatId); await bot.sendMessage(a.chatId, `⚠️ <b>Seu tempo de acesso expirou!</b>\n\nEspero que tenha aproveitado! 😈 Para renovar, digite /start e escolha um novo plano.`, { parse_mode: 'HTML' }); assinantes.splice(i, 1); } catch (e) {}
      }
    }
  }, 3600000);
}

// ==========================================
// 7. INICIALIZADOR GLOBAL
// ==========================================
// Comente as linhas abaixo caso queira desligar algum bot temporariamente
iniciarAcervoBrasil();
iniciarTriboDosNovinhos();
iniciarBielSalles();
iniciarAryanAlmeida();
