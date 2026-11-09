require('dotenv').config();
const path = require('path');
const express = require('express');
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const {
  migrate,
  listRecentApplications,
  upsertTextSubmission,
  getStats,
  listApplications,
  getApplication,
} = require('./db');
const mediaWizard = require('./scenes/mediaWizard');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const ADMIN_KEY = process.env.ADMIN_KEY || 'ishgaqabul';
const PORT = process.env.PORT || 3000;
const WEBAPP_URL = process.env.WEBAPP_URL; // masalan: https://ishgaqabul-bot.up.railway.app/webapp/
const ADMIN_PANEL_URL = WEBAPP_URL
  ? `${WEBAPP_URL.replace(/\/webapp\/?$/, '')}/admin/?key=${encodeURIComponent(ADMIN_KEY)}`
  : null;

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN topilmadi. .env faylga yoki Railway Variables ga qo'shing.");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const stage = new Scenes.Stage([mediaWizard]);

bot.use(session());
bot.use(stage.middleware());

function isAdmin(ctx) {
  return ADMIN_CHAT_ID && String(ctx.from.id) === String(ADMIN_CHAT_ID);
}

function startKeyboard() {
  if (WEBAPP_URL) {
    return Markup.inlineKeyboard([
      [Markup.button.webApp('📝 Arizani to\'ldirish', WEBAPP_URL)],
    ]);
  }
  return undefined;
}

function adminKeyboard() {
  if (ADMIN_PANEL_URL) {
    return Markup.inlineKeyboard([
      [Markup.button.webApp('📊 Admin panelni ochish', ADMIN_PANEL_URL)],
    ]);
  }
  return undefined;
}

bot.start(async (ctx) => {
  if (isAdmin(ctx)) {
    await ctx.reply(
      "Xush kelibsiz! Siz adminsiz — arizalarni ko'rish uchun admin panelni oching:",
      adminKeyboard()
    );
    return;
  }
  if (!WEBAPP_URL) {
    await ctx.reply(
      "Ariza formasi hali ulanmagan. Admin WEBAPP_URL o'zgaruvchisini sozlashi kerak."
    );
    return;
  }
  await ctx.reply(
    "Assalomu alaykum! Ishga qabul uchun ariza to'ldiramiz.\n\nQuyidagi tugma orqali ariza formasini to'ldiring:",
    startKeyboard()
  );
});

bot.command('ariza', async (ctx) => {
  await ctx.reply("Ariza formasini to'ldirish uchun tugmani bosing:", startKeyboard());
});

bot.command('admin', async (ctx) => {
  if (!isAdmin(ctx)) return;
  await ctx.reply('Admin panel:', adminKeyboard());
});

// Web App dan matnli ariza ma'lumotlari keladi
bot.on('message', async (ctx, next) => {
  if (ctx.message && ctx.message.web_app_data) {
    try {
      const data = JSON.parse(ctx.message.web_app_data.data);
      const username = ctx.from.username ? `@${ctx.from.username}` : null;
      const applicationId = await upsertTextSubmission(ctx.from.id, username, data);
      return ctx.scene.enter('media-wizard', { applicationId });
    } catch (err) {
      console.error('Web App ma\'lumotini qayta ishlashda xatolik:', err);
      await ctx.reply("Xatolik yuz berdi, iltimos formani qaytadan to'ldiring: /ariza");
      return;
    }
  }
  return next();
});

// Faqat admin uchun: so'nggi arizalarni Telegram orqali ko'rish
bot.command('oxirgi', async (ctx) => {
  if (!ADMIN_CHAT_ID || String(ctx.from.id) !== String(ADMIN_CHAT_ID)) {
    return;
  }
  const rows = await listRecentApplications(10);
  if (rows.length === 0) {
    await ctx.reply("Hozircha arizalar yo'q.");
    return;
  }
  const text = rows
    .map(
      (r) =>
        `#${r.id} — ${r.ism_sharif || 'nomsiz'} — ${r.lavozim} — ${r.holat} — ${new Date(
          r.created_at
        ).toLocaleString('uz-UZ')}`
    )
    .join('\n');
  await ctx.reply(text);
});

bot.catch((err, ctx) => {
  console.error(`Xatolik (update ${ctx.updateType}):`, err);
});

// ---- HTTP server: Web App sahifalari + admin panel API ----

function checkAdminKey(req, res, next) {
  const key = req.header('X-Admin-Key') || req.query.key;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

async function main() {
  await migrate();

  const app = express();
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/', (_req, res) => res.send('Ishga Qabul bot ishlayapti.'));

  app.get('/api/stats', checkAdminKey, async (_req, res) => {
    const rows = await getStats();
    res.json(rows);
  });

  app.get('/api/applications', checkAdminKey, async (req, res) => {
    const rows = await listApplications({
      lavozim: req.query.lavozim || undefined,
      holat: req.query.holat || undefined,
    });
    res.json(rows);
  });

  app.get('/api/applications/:id', checkAdminKey, async (req, res) => {
    const row = await getApplication(req.params.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json(row);
  });

  // Telegramda saqlangan skrinshotni admin panelda ko'rsatish uchun proksi
  app.get('/api/photo/:fileId', checkAdminKey, async (req, res) => {
    try {
      const link = await bot.telegram.getFileLink(req.params.fileId);
      const response = await fetch(link.href);
      res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      console.error('Rasmni olishda xatolik:', err);
      res.status(500).send('Xatolik');
    }
  });

  app.listen(PORT, () => console.log(`HTTP server ${PORT}-portda ishga tushdi`));

  await bot.launch();
  console.log('Bot ishga tushdi.');
}

main().catch((err) => {
  console.error('Botni ishga tushirishda xatolik:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
