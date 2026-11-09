require('dotenv').config();
const express = require('express');
const { Telegraf, Scenes, session } = require('telegraf');
const { migrate, listRecentApplications } = require('./db');
const applicationWizard = require('./scenes/applicationWizard');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN topilmadi. .env faylga yoki Railway Variables ga qo\'shing.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const stage = new Scenes.Stage([applicationWizard]);

bot.use(session());
bot.use(stage.middleware());

bot.start(async (ctx) => {
  await ctx.scene.enter('ariza-wizard');
});

bot.command('ariza', async (ctx) => {
  await ctx.scene.enter('ariza-wizard');
});

// Faqat admin uchun: so'nggi arizalarni ko'rish
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
        `#${r.id} — ${r.ism_sharif || 'nomsiz'} — ${r.lavozim} — ${r.telefon || ''} — ${new Date(
          r.created_at
        ).toLocaleString('uz-UZ')}`
    )
    .join('\n');
  await ctx.reply(text);
});

bot.catch((err, ctx) => {
  console.error(`Xatolik (update ${ctx.updateType}):`, err);
});

async function main() {
  await migrate();

  const app = express();
  app.get('/', (_req, res) => res.send('Ishga Qabul bot ishlayapti.'));
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
