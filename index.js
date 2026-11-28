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
  return String(url).replace(/\/+$/, '');
}

app.get('/', (req, res) => {
  res.send(`🟢 Super Servidor ONLINE! Rodando 4 Bots simultaneamente (WiinPay).`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Central de Bots aberta na porta ${PORT}`);
});

// ==========================================
// 2. FUNÇÕES GLOBAIS DA WIINPAY
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
  if (typeof meta === 'string') {
    try { return JSON.parse(meta); } catch (e) { return {}; }
  }
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

async function entregarLinkCanal({ bot, channelId, chatId, mensagemSucesso, onErro }) {
  if (!channelId) {
    const errMsg = "CHANNEL_ID não configurado no ambiente para entrega do link.";
    console.error("❌", errMsg);
    if (onErro) await onErro(errMsg);
    return false;
  }

  try {
    const invite = await bot.createChatInviteLink(channelId, { member_limit: 1 });
    const textoFinal = typeof mensagemSucesso === 'function'
      ? mensagemSucesso(invite.invite_link)
      : `${mensagemSucesso}\n\n${invite.invite_link}`;

    await bot.sendMessage(chatId, textoFinal, { parse_mode: 'HTML' });
    console.log(`🎉 Link enviado com sucesso para chatId ${chatId} no canal ${channelId}`);
    return true;
  } catch (err) {
    console.error(`❌ Erro ao gerar/enviar link do canal ${channelId} para chatId ${chatId}:`, err?.message || err);
    if (onErro) await onErro(err);
    return false;
  }
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
  const processados = new Set();
  const emProcessamento = new Set();
  const usuariosAtivos = new Set();

  const VIDEO_START = 'BAACAgEAAxkBAAMDasfXsVxDTJuo2F6Dz6BUJaPu6XAAAs0JAAJkbzlGBVE4HlctfSA9BA';

  const mensagensDiarias = [
    // Mensagem 1 (Índice 0 - VIDEO 01)
    {
      video: 'BAACAgEAAxkBAAIKfWsFrC5nttQjPAACKwIsj5n6AAHf6QAC3gcAAhVxMEQLC7_kYAHiDT0E',
      foto: null,
      texto: `🔥 Aqui sua tá GOZADA garantida 💦\n\n🎥 ATUALIZAÇÕES DIARIAS PRA VOCÊ GOZAR GOSTOSO TODOS OS DIAS!\n\n📁 MLKS ativos, passivos e versáteis\n📂 Chamadinhas selecionadas todos os dias\n💦 Só vídeos completos sem censura\n🍑 MALOKINHAS reais, só mlk gostoso da favela\n\n🎁 Assinou agora? Ganha:\n+20 grupos VIP Proibidus 🔑🔥\n\n✅ Entrada imediata\n♾ Acesso vitalício (paga uma vez só)\n👤 100% anônimo\n\nTá com tesão? Entra agora 👇`
    },

    // Mensagem 2 (Índice 1 - VIDEO+FOTO 02)
    {
      video: 'BAACAgEAAxkBAAIKgGsFrOMjH1L4II9zuPGFn0ZCxnLDAALfBwACFXEwRArVte0n7JZVPQQ',
      foto: 'AgACAgEAAxkBAAIKf2sFrOMp5DDS73LshjFHATJ7ezxaAAKmDmsbFXEwRDtkKSVL_PZmAQADAgADeQADPQQ',
      texto: `⚠️ ÚLTIMAS 6 VAGAS DE HOJE!\n\nVocê foi selecionado pro maior acervo de vazadinhos e chamadinhas de MLKS da favela 🔥\n\nO que te espera:\n\n🎥 Vídeos completos sem censura\n📱 Chamadinhas e lives vazadas\n🍑 Só maloka gostoso (ativo, passivo e versátil)\n🔥 ATUALIZAÇÕES DIARIAS PRA VOCÊ GOZAR GOSTOSO TODOS OS DIAS!\n🔒 Acesso vitalício + grupos de troca\n\nDepois de hoje o preço sobe.\n\nPara de enrolar e garante o seu 👇`
    },

    // Mensagem 3 (Índice 2 - VIDEO 03)
    {
      video: 'BAACAgEAAxkBAAIKg2sFrTmHQjvBHiSBbDfZ_eKzk7-dAALgBwACFXEwRKGlJ90ene0pPQQ',
      foto: null,
      texto: `Quer gozar vendo MLK da favela de verdade?\n\nAqui não tem modelo fake.\nAqui tem:\n\n🔥 Vazadinhos quentes\n🔥 Chamadinhas sujas\n🔥 Vídeos completos sem corte e sem censura\n🔥 ATUALIZAÇÕES DIARIAS PRA VOCÊ GOZAR GOSTOSO TODOS OS DIAS!\n🍑 Só malokinha gostoso da quebrada\n\nEntrada imediata + acesso vitalício + 100% anônimo.\n\nQuer gozar? Então entra agora 👇`
    },

    // Mensagem 4 (Índice 3 - VIDEO+FOTO 04)
    {
      video: 'BAACAgEAAxkBAAIKhmsFrZ-qyK6xPYdh25_ZrPgI18zTAALhBwACFXEwRHgDBwU3Pe4SPQQ',
      foto: 'AgACAgEAAxkBAAIKhWsFrZ95XPBsvthYTzBg3ALqCo50AAKnDmsbFXEwRAYiffFAzKqrAQADAgADeAADPQQ',
      texto: `🎉 PARABÉNS! VOCÊ FOI O SORTEADO DO DIA 🔥\n\nMais de 15.000 mídias de MLKS da favela organizadas pra você:\n\n✅ Vídeos completos sem censura\n✅ Chamadinhas e lives vazadas\n✅ Ativos, passivos e versáteis\n✅ ATUALIZAÇÕES DIARIAS PRA VOCÊ GOZAR GOSTOSO TODOS OS DIAS!\n✅ Acesso vitalício de verdade\n✅ Grupos VIP liberados\n\n⚠️ RESTAM APENAS 5 VAGAS NA PROMOÇÃO!\n\nPoucos minutos pra garantir ou perde a vaga.\n\nEntra e goza à vontade 👇`
    }
  ];

  const botoesPlanos = {
    inline_keyboard: [
      [{ text: "😈 PLANO MENSAL (R$ 14,90)", callback_data: "plano_mensal" }],
      [{ text: "🔥 VITALÍCIO - R$ 29,90", callback_data: "plano_vitalicio" }]
    ]
  };

  const botaoVitalicio = {
    inline_keyboard: [
      [{ text: "💎 VITALÍCIO - 48% OFF 🔥", callback_data: "plano_vitalicio" }]
    ]
  };

  // Mantém qualquer usuário que interagir registrado para os disparos 24h
  bot.on('message', (msg) => {
    if (msg?.chat?.id) {
      usuariosAtivos.add(String(msg.chat.id));
    }
  });

  // Captura IDs de fotos e vídeos enviados diretamente no privado do bot
  bot.on('photo', (msg) => {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    bot.sendMessage(msg.chat.id, `📸 <b>ID da Foto:</b>\n<code>${fileId}</code>`, { parse_mode: 'HTML' }).catch(() => {});
  });

  bot.on('video', (msg) => {
    const fileId = msg.video.file_id;
    bot.sendMessage(msg.chat.id, `🎥 <b>ID do Vídeo:</b>\n<code>${fileId}</code>`, { parse_mode: 'HTML' }).catch(() => {});
  });

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    usuariosAtivos.add(String(chatId));
    console.log(`[ACERVO] Novo usuário: ${chatId} | Total ativos: ${usuariosAtivos.size}`);

    const textoLegenda = "🇧🇷 <b>ACERVO BRASIL +18</b> 🇧🇷\n\nAqui você encontra as melhores chamadinhas, lives e vazados com atualização todo dia.\n\nNada de enrolação, o link é gerado automaticamente após o pagamento.\n\n🌍 Payment via PayPal 15$ USD\n👉 acervobr55@gmail.com\nSend the proof of payment to: @hiagokff\n\nEscolhe seu acesso:\n\n😈 <b>PLANO MENSAL</b>\n👉 30 dias de acesso — R$ 14,90\n\n🔥 <b>Pagamento único. Acesso pra sempre.</b>\n👉 De <s>R$ 60,00</s> por apenas R$ 29,90\n\n⚠️ O acesso Vitalício está disponível até <b>" + getDataAmanha() + "</b>, são poucas vagas.\n\n🔒 Garante seu acesso agora 👇";
    try { await bot.sendVideo(chatId, VIDEO_START, { caption: textoLegenda, parse_mode: "HTML", reply_markup: botoesPlanos }); }
    catch (e) { await bot.sendMessage(chatId, textoLegenda, { parse_mode: "HTML", reply_markup: botoesPlanos }); }
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    usuariosAtivos.add(String(chatId));
    bot.answerCallbackQuery(query.id).catch(() => {});
    const plano = query.data === "plano_mensal" ? "mensal" : "vitalicio";
    const valor = plano === "mensal" ? 14.90 : 29.90;
    const msgL = await bot.sendMessage(chatId, "⏳ Segura aí, gerando seu PIX...");

    try {
      const URL_WEBHOOK = `${getPublicUrl()}/webhook/acervo`;
      const res = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: WIINPAY_TOKEN,
          value: valor,
          name: "Cliente Kelly Mentorias",
          email: "vip@kellymentorias.com",
          description: "Kelly Mentorias",
          metadata: { chatId: String(chatId), plano: plano },
          webhook_url: URL_WEBHOOK
        })
      });
      const json = await res.json();
      bot.deleteMessage(chatId, msgL.message_id).catch(() => {});
      const qr = extrairQrCode(json);
      const txid = extrairPaymentId(json);
      if (!qr) throw new Error("Erro PIX");

      await bot.sendMessage(
        chatId,
        `💳 <b>PIX GERADO COM SUCESSO</b>\n\n💰 Valor: R$ ${valor.toFixed(2).replace('.', ',')}\n\n<code>${qr}</code>\n\n📌 Toca no código aí em cima pra copiar.\n\n✅ O link do grupo sai na hora!`,
        { parse_mode: "HTML" }
      );
      pagamentosPendentes.set(String(chatId), { timestamp: Date.now(), etapa: 0, paymentId: txid ? String(txid) : null });
    } catch (e) {
      bot.deleteMessage(chatId, msgL.message_id).catch(() => {});
      bot.sendMessage(chatId, "⚠️ Instabilidade. Tenta de novo.");
    }
  });

  app.post('/webhook/acervo', async (req, res) => {
    res.send('ok');
    const payload = req.body || {};
    if (!pagamentoAprovado(payload)) return;

    const txid = extrairPaymentId(payload);
    const meta = extrairMetadata(payload);
    const chatId = meta.chatId || meta.chat_id ? String(meta.chatId || meta.chat_id) : null;
    const plano = meta.plano;

    if (!chatId) {
      console.error(`❌ [WEBHOOK ACERVO] chatId ausente no metadata do pagamento ${txid}`);
      return;
    }

    const chave = String(txid || `${chatId}-${plano}`);
    if (processados.has(chave) || emProcessamento.has(chave)) return;
    emProcessamento.add(chave);

    try {
      pagamentosPendentes.delete(chatId);
      usuariosAtivos.delete(chatId);

      const entregue = await entregarLinkCanal({
        bot,
        channelId: CHANNEL_ID,
        chatId,
        mensagemSucesso: (link) => plano === 'vitalicio'
          ? `🎉 <b>PAGAMENTO APROVADO!</b>\n\nLink do Grupo VIP: ${link}\n\n⚠️ <b>Aviso:</b> Você é Vitalício! Acesso garantido pra sempre.`
          : `🎉 <b>PAGAMENTO APROVADO!</b>\n\nLink do Grupo VIP (30 dias): ${link}`
      });

      if (entregue) processados.add(chave);
    } catch (e) {
      console.error("❌ [WEBHOOK ACERVO] erro inesperado:", e);
    } finally {
      emProcessamento.delete(chave);
    }
  });

  // Função de envio diário (Vídeo ou Vídeo+Foto + Texto + Botão Vitalício)
  async function enviarMensagemDiaria(indiceMensagem) {
    const item = mensagensDiarias[indiceMensagem];
    if (!item) return;

    const usuarios = Array.from(usuariosAtivos);
    console.log(`[ACERVO - ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] Enviando Mensagem ${indiceMensagem + 1} para ${usuarios.length} usuários`);

    for (const chatId of usuarios) {
      // 1º Envia o VÍDEO (isolado para não impedir o texto caso o file_id falhe)
      if (item.video) {
        try {
          await bot.sendVideo(chatId, item.video);
          await new Promise(r => setTimeout(r, 700));
        } catch (errVideo) {
          console.log(`[ACERVO] Aviso vídeo Mensagem ${indiceMensagem + 1} para ${chatId}:`, errVideo.message);
        }
      }

      // 2º Envia a FOTO (apenas nas mensagens Video+Foto)
      if (item.foto) {
        try {
          await bot.sendPhoto(chatId, item.foto);
          await new Promise(r => setTimeout(r, 700));
        } catch (errFoto) {
          console.log(`[ACERVO] Aviso foto Mensagem ${indiceMensagem + 1} para ${chatId}:`, errFoto.message);
        }
      }

      // 3º Envia o TEXTO + BOTÃO VITALÍCIO
      try {
        await bot.sendMessage(chatId, item.texto, {
          parse_mode: "HTML",
          reply_markup: botaoVitalicio
        });

        await new Promise(r => setTimeout(r, 350));
      } catch (err) {
        console.log(`[ACERVO] Erro ao enviar para ${chatId}:`, err.message);
        usuariosAtivos.delete(String(chatId));
      }
    }
  }

  // Agendamentos 24h (Horário de Brasília)
  const formatadorSP = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hourCycle: 'h23',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  let ultimoDisparoChave = '';
  setInterval(() => {
    const partes = formatadorSP.formatToParts(new Date());
    const dia = Number(partes.find(p => p.type === 'day')?.value);
    const hora = Number(partes.find(p => p.type === 'hour')?.value);
    const minuto = Number(partes.find(p => p.type === 'minute')?.value);

    if (minuto !== 16) return;

    const chaveAtual = `${dia}-${hora}-${minuto}`;
    if (ultimoDisparoChave === chaveAtual) return;

    if (hora === 6 || hora === 12 || hora === 18) {
      ultimoDisparoChave = chaveAtual;
      enviarMensagemDiaria(0); // 06:16, 12:16, 18:16 -> Mensagem 1 (VIDEO 01)
    } else if (hora === 9 || hora === 15) {
      ultimoDisparoChave = chaveAtual;
      enviarMensagemDiaria(2); // 09:16, 15:16 -> Mensagem 3 (VIDEO 03)
    } else if (hora === 21 || hora === 3) {
      ultimoDisparoChave = chaveAtual;
      enviarMensagemDiaria(1); // 21:16, 03:16 -> Mensagem 2 (VIDEO+FOTO 02)
    } else if (hora === 0) {
      ultimoDisparoChave = chaveAtual;
      enviarMensagemDiaria(3); // 00:16 -> Mensagem 4 (VIDEO+FOTO 04)
    }
  }, 20000);

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
// 4. MÓDULO 2: MLK BRASILEIRO
// ==========================================
function iniciarMlkBrasileiro() {
  if (!process.env.TOKEN_TRIBO) return console.log("⚠️ TOKEN_TRIBO ausente.");

  const bot = new TelegramBot(process.env.TOKEN_TRIBO, { polling: true });
  const CHANNEL_ID = process.env.CHANNEL_TRIBO;
  const WIINPAY_TOKEN = process.env.WIINPAY_TOKEN_TRIBO || process.env.WIINPAY_TOKEN;
  const vitalicios = [];
  const pagamentosPendentes = new Map();
  const processados = new Set();
  const emProcessamento = new Set();

  const PHOTO_START = 'AgACAgEAAxkBAAMKauyYIIuALKzh6EyonG1XDDHExk8AArYMaxtC6mhHNVO84I4U0FIBAAMCAAN5AAM9BA';
  const botoesPlanos = {
    inline_keyboard: [
      [{ text: "🥉 MENSAL (R$ 14,90)", callback_data: "plano_mensal" }],
      [{ text: "💎 VITALÍCIO - R$ 29,90 🔥", callback_data: "plano_vitalicio" }]
    ]
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const textoLegenda = `<b>🇧🇷 MLK BRASILEIRO 🇧🇷</b>\n\nPapo reto, os conteúdos mais brabos, CHAMADINHAS, LIVES, VAZADINHOS que tu não acha em lugar nenhum, com atualizações diárias.\n\n🌍 Payment via PayPal 15$ USD\n👉 acervobr55@gmail.com\nSend the proof of payment to: @hiagokff\n\nEscolhe teu plano aí embaixo:\n\n🥉 <b>PLANO MENSAL</b>\n👉 Acesso por 30 dias - R$ 14,90\n\n💎 <b>PLANO VITALÍCIO</b> (OFERTA RELÂMPAGO)\n👉 DE <s>R$ 60,00</s> POR APENAS R$ 29,90 <b>(50% OFF 🔥)</b>\nPagamento único. O bagulho é teu pra sempre!\n\n🔥 GARANTE LOGO O TEU ACESSO 🔥`;
    try { await bot.sendPhoto(chatId, PHOTO_START, { caption: textoLegenda, parse_mode: "HTML", reply_markup: botoesPlanos }); }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: WIINPAY_TOKEN,
          value: valor,
          name: "Cliente Kelly Mentorias",
          email: "vip@kellymentorias.com",
          description: "Kelly Mentorias",
          metadata: { chatId: String(chatId), plano: plano },
          webhook_url: URL_WEBHOOK
        })
      });
      const json = await res.json();
      bot.deleteMessage(chatId, msgL.message_id).catch(() => {});
      const qr = extrairQrCode(json);
      const txid = extrairPaymentId(json);
      if (!qr) throw new Error("Erro PIX");

      await bot.sendMessage(
        chatId,
        `💳 <b>PIX GERADO NO ESQUEMA</b>\n\n💰 Valor: R$ ${valor.toFixed(2).replace('.', ',')}\n\n<code>${qr}</code>\n\n📌 Toca no código aí em cima pra copiar.\n\n✅ O acesso cai na hora!`,
        { parse_mode: "HTML" }
      );
      pagamentosPendentes.set(String(chatId), { timestamp: Date.now(), etapa: 0, paymentId: txid ? String(txid) : null });
    } catch (e) {
      bot.deleteMessage(chatId, msgL.message_id).catch(() => {});
      bot.sendMessage(chatId, "⚠️ Instabilidade. Tenta de novo rapidinho.");
    }
  });

  app.post('/webhook/tribo', async (req, res) => {
    res.send('ok');
    const payload = req.body || {};
    if (!pagamentoAprovado(payload)) return;

    const txid = extrairPaymentId(payload);
    const meta = extrairMetadata(payload);
    const chatId = meta.chatId || meta.chat_id ? String(meta.chatId || meta.chat_id) : null;
    const plano = meta.plano;

    if (!chatId) {
      console.error(`❌ [WEBHOOK TRIBO] chatId ausente no metadata do pagamento ${txid}`);
      return;
    }

    const chave = String(txid || `${chatId}-${plano}`);
    if (processados.has(chave) || emProcessamento.has(chave)) return;
    emProcessamento.add(chave);

    try {
      pagamentosPendentes.delete(chatId);
      const entregue = await entregarLinkCanal({
        bot,
        channelId: CHANNEL_ID,
        chatId,
        mensagemSucesso: (link) => plano === 'vitalicio'
          ? `🎉 <b>PAGAMENTO APROVADO, CRIA!</b>\n\nLink do Grupo VIP: ${link}\n\n⚠️ <b>VISÃO:</b> Tu é Vitalício! Se der caô no grupo, digita /resgatar aqui no bot!`
          : `🎉 <b>PAGAMENTO APROVADO, CRIA!</b>\n\nLink do Grupo VIP (30 dias): ${link}`
      });

      if (entregue) {
        processados.add(chave);
        if (plano === 'vitalicio' && !vitalicios.includes(chatId)) vitalicios.push(chatId);
      }
    } catch (e) {
      console.error("❌ [WEBHOOK TRIBO] erro inesperado:", e);
    } finally {
      emProcessamento.delete(chave);
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
  const emProcessamento = new Set();

  const botoesPlanos = {
    inline_keyboard: [
      [{ text: "R$ 15,00 / Acesso VIP (24h) - 7 Dias", callback_data: "plano_7" }],
      [{ text: "R$ 24,90 / Acesso VIP 25% OFF - 30 Dias", callback_data: "plano_30" }],
      [{ text: "R$ 49,90 / Acesso VIP (24h) - Vitalício", callback_data: "plano_vitalicio" }]
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
    if (query.data === "plano_7") { valor = 15.00; tipoPlano = "7_dias"; nomePlano = "Acesso VIP 7 Dias"; }
    else if (query.data === "plano_30") { valor = 24.90; tipoPlano = "30_dias"; nomePlano = "Acesso VIP 30 Dias"; }
    else if (query.data === "plano_vitalicio") { valor = 49.90; tipoPlano = "vitalicio"; nomePlano = "Acesso VIP Vitalicio"; }

    if (valor <= 0) return;
    const msgLoading = await bot.sendMessage(chatId, `⏳ Aguarde, gerando seu PIX seguro e anônimo...`);

    try {
      const URL_WEBHOOK = `${getPublicUrl()}/webhook/biel`;
      const response = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: WIINPAY_KEY,
          value: valor,
          name: "Cliente Kelly Mentorias",
          email: "vip@kellymentorias.com",
          description: "Kelly Mentorias",
          metadata: { chatId: String(chatId), plano: tipoPlano },
          webhook_url: URL_WEBHOOK
        })
      });
      const json = await response.json();
      bot.deleteMessage(chatId, msgLoading.message_id).catch(() => {});
      const qrcode = extrairQrCode(json);
      const txid = extrairPaymentId(json);
      if (!qrcode) throw new Error("Sem QR Code");

      const texto = `💳 PIX GERADO COM SUCESSO\n\n💰 Valor: R$ ${valor.toFixed(2).replace('.', ',')}\n\n📋 Código PIX (Copia e Cola):\n\n\`${qrcode}\`\n\n📌 Toque no código acima para copiar.\n\n⏳ O acesso é liberado automaticamente após o pagamento.`;
      const mensagemPix = await bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });
      pagamentos.push({ txid: txid ? String(txid) : '', chatId: String(chatId), mensagemId: String(mensagemPix.message_id), status: "pending", createdAt: Date.now(), etapaFunil: 0, plano: tipoPlano });
    } catch (e) {
      bot.deleteMessage(chatId, msgLoading.message_id).catch(() => {});
      bot.sendMessage(chatId, "⚠️ Sistema indisponível.");
    }
  });

  app.post('/webhook/biel', async (req, res) => {
    res.status(200).json({ ok: true });
    const payload = req.body || {};
    if (!pagamentoAprovado(payload)) return;

    const txid = extrairPaymentId(payload);
    const meta = extrairMetadata(payload);
    const pendente = txid ? pagamentos.find(p => String(p.txid) === String(txid)) : null;
    const chatId = (meta.chatId || meta.chat_id || pendente?.chatId) ? String(meta.chatId || meta.chat_id || pendente?.chatId) : null;
    const plano = meta.plano || pendente?.plano;
    const mensagemId = pendente?.mensagemId;

    if (!chatId) {
      console.error(`❌ [WEBHOOK BIEL] chatId ausente no pagamento ${txid}`);
      return;
    }

    const chave = String(txid || `${chatId}-${plano}`);
    if (processados.has(chave) || emProcessamento.has(chave)) return;
    emProcessamento.add(chave);

    try {
      if (pendente) pendente.status = 'approved';
      if (mensagemId) try { await bot.deleteMessage(chatId, mensagemId); } catch (e) {}

      const entregue = await entregarLinkCanal({
        bot,
        channelId: CHANNEL_ID,
        chatId,
        mensagemSucesso: (link) => `🎉 PAGAMENTO APROVADO!\n\nSeu pagamento foi confirmado ✅\n\n🔒 Acesso liberado:\n\n${link}\n\n⚠️ Link único com limite de 1 uso.`
      });

      if (entregue) {
        processados.add(chave);
        const agora = Date.now(); let validade = null;
        if (plano === '7_dias') validade = agora + (7 * 24 * 60 * 60 * 1000);
        else if (plano === '30_dias') validade = agora + (30 * 24 * 60 * 60 * 1000);
        if (validade) assinantes.push({ chatId, validade });
      }
    } catch (e) {
      console.error("❌ [WEBHOOK BIEL] erro inesperado:", e);
    } finally {
      emProcessamento.delete(chave);
    }
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
// 6. MÓDULO 4: VITOR SOUZA
// ==========================================
function iniciarAryanAlmeida() {
  if (!process.env.TOKEN_ARYAN) return console.log("⚠️ TOKEN_ARYAN ausente.");

  const bot = new TelegramBot(process.env.TOKEN_ARYAN, { polling: true });
  const CHANNEL_ID = process.env.CHANNEL_ARYAN;
  const WIINPAY_KEY = process.env.WIINPAY_TOKEN_ARYAN || process.env.WIINPAY_TOKEN;

  const pagamentos = []; const assinantes = []; const processados = new Set();
  const emProcessamento = new Set();

  const botoesPlanos = {
    inline_keyboard: [
      [{ text: "R$ 20,00 / Acesso VIP - Semanal", callback_data: "plano_7" }],
      [{ text: "R$ 35,00 / Acesso VIP - Mensal", callback_data: "plano_30" }]
    ]
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      await bot.sendMessage(chatId, "Grupo VIP 😈", { parse_mode: "HTML", reply_markup: botoesPlanos });
    } catch (e) {}
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    bot.answerCallbackQuery(query.id).catch(() => {});

    let valor = 0; let tipoPlano = ""; let nomePlano = "";
    if (query.data === "plano_7") { valor = 20.00; tipoPlano = "7_dias"; nomePlano = "Acesso VIP Semanal"; }
    else if (query.data === "plano_30") { valor = 35.00; tipoPlano = "30_dias"; nomePlano = "Acesso VIP Mensal"; }

    if (valor <= 0) return;
    const msgLoading = await bot.sendMessage(chatId, `⏳ Aguarde, gerando seu PIX seguro e anônimo...`);

    try {
      const URL_WEBHOOK = `${getPublicUrl()}/webhook/aryan`;
      const response = await fetch(`${WIINPAY_API}/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: WIINPAY_KEY,
          value: valor,
          name: "Cliente Kelly Mentorias",
          email: "vip@kellymentorias.com",
          description: "Kelly Mentorias",
          metadata: { chatId: String(chatId), plano: tipoPlano },
          webhook_url: URL_WEBHOOK
        })
      });
      const json = await response.json();
      bot.deleteMessage(chatId, msgLoading.message_id).catch(() => {});
      const qrcode = extrairQrCode(json);
      const txid = extrairPaymentId(json);
      if (!qrcode) throw new Error("Sem QR Code");

      const texto = `💳 PIX GERADO COM SUCESSO\n\n💰 Valor: R$ ${valor.toFixed(2).replace('.', ',')}\n\n📋 Código PIX (Copia e Cola):\n\n\`${qrcode}\`\n\n📌 Toque no código acima para copiar.\n\n⏳ O acesso é liberado automaticamente após o pagamento.`;
      const mensagemPix = await bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });
      pagamentos.push({ txid: txid ? String(txid) : '', chatId: String(chatId), mensagemId: String(mensagemPix.message_id), status: "pending", createdAt: Date.now(), etapaFunil: 0, plano: tipoPlano });
    } catch (e) {
      bot.deleteMessage(chatId, msgLoading.message_id).catch(() => {});
      bot.sendMessage(chatId, "⚠️ Sistema indisponível.");
    }
  });

  app.post('/webhook/aryan', async (req, res) => {
    res.status(200).json({ ok: true });
    const payload = req.body || {};
    if (!pagamentoAprovado(payload)) return;

    const txid = extrairPaymentId(payload);
    const meta = extrairMetadata(payload);
    const pendente = txid ? pagamentos.find(p => String(p.txid) === String(txid)) : null;
    const chatId = (meta.chatId || meta.chat_id || pendente?.chatId) ? String(meta.chatId || meta.chat_id || pendente?.chatId) : null;
    const plano = meta.plano || pendente?.plano;
    const mensagemId = pendente?.mensagemId;

    if (!chatId) {
      console.error(`❌ [WEBHOOK ARYAN] chatId ausente no pagamento ${txid}`);
      return;
    }

    const chave = String(txid || `${chatId}-${plano}`);
    if (processados.has(chave) || emProcessamento.has(chave)) return;
    emProcessamento.add(chave);

    try {
      if (pendente) pendente.status = 'approved';
      if (mensagemId) try { await bot.deleteMessage(chatId, mensagemId); } catch (e) {}

      const entregue = await entregarLinkCanal({
        bot,
        channelId: CHANNEL_ID,
        chatId,
        mensagemSucesso: (link) => `🎉 PAGAMENTO APROVADO!\n\nSeu pagamento foi confirmado ✅\n\n🔒 Acesso liberado:\n\n${link}\n\n⚠️ Link único com limite de 1 uso.`
      });

      if (entregue) {
        processados.add(chave);
        const agora = Date.now(); let validade = null;
        if (plano === '7_dias') validade = agora + (7 * 24 * 60 * 60 * 1000);
        else if (plano === '30_dias') validade = agora + (30 * 24 * 60 * 60 * 1000);
        if (validade) assinantes.push({ chatId, validade });
      }
    } catch (e) {
      console.error("❌ [WEBHOOK ARYAN] erro inesperado:", e);
    } finally {
      emProcessamento.delete(chave);
    }
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
iniciarAcervoBrasil();
iniciarMlkBrasileiro();
iniciarBielSalles();
iniciarAryanAlmeida();
