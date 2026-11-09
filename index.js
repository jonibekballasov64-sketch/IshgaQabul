require('dotenv').config();
const path = require('path');
const express = require('express');
const multer = require('multer');
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const {
  migrate,
  listRecentApplications,
  createApplicationWithFiles,
  getStats,
  listApplications,
  getApplication,
} = require('./db');
const { validateInitData } = require('./telegramAuth');
const mediaWizard = require('./scenes/mediaWizard');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

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

// Muhim: tg.sendData() faqat "Keyboard button" (pastki reply klaviatura) orqali
// ochilgan Mini App'larda ishlaydi — inline tugma orqali ochilsa, forma
// yuborilgandan keyin bot hech narsa olmaydi (Telegram cheklovi). Shuning uchun
// webApp tugmalari inlineKeyboard emas, pastki reply-klaviatura sifatida beriladi.
function startKeyboard() {
  if (WEBAPP_URL) {
    return Markup.keyboard([
      [Markup.button.webApp('📝 Arizani to\'ldirish', WEBAPP_URL)],
    ]).resize();
  }
  return undefined;
}

function adminKeyboard() {
  if (ADMIN_PANEL_URL) {
    return Markup.keyboard([
      [Markup.button.webApp('📊 Admin panelni ochish', ADMIN_PANEL_URL)],
    ]).resize();
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

// Web App formasi (matn + fayllar) /api/webapp-submit orqali allaqachon saqlangan —
// bu yerda faqat ariza ID kelib, bot suhbatda davom etadi (video + test so'raladi).
bot.on('message', async (ctx, next) => {
  if (ctx.message && ctx.message.web_app_data) {
    try {
      const { applicationId } = JSON.parse(ctx.message.web_app_data.data);
      if (!applicationId) throw new Error('applicationId yo\'q');
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

  // Web App formasi: matn maydonlari + ATT/Milliy Sertifikat skrinshot + diplom (rasm yoki PDF)
  app.post(
    '/api/webapp-submit',
    upload.fields([
      { name: 'att_screenshot', maxCount: 1 },
      { name: 'milliy_sertifikat_screenshot', maxCount: 1 },
      { name: 'diploma', maxCount: 1 },
    ]),
    async (req, res) => {
      const { initData, data } = req.body;
      const auth = validateInitData(initData, BOT_TOKEN);
      if (!auth.ok) {
        return res.status(401).json({ error: 'invalid_init_data' });
      }

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (err) {
        return res.status(400).json({ error: 'bad_data' });
      }

      const username = auth.user.username ? `@${auth.user.username}` : null;
      const files = req.files || {};

      async function uploadToAdmin(fieldName, label) {
        const file = files[fieldName] && files[fieldName][0];
        if (!file || !ADMIN_CHAT_ID) return null;
        try {
          const sent = await bot.telegram.sendDocument(
            ADMIN_CHAT_ID,
            { source: file.buffer, filename: file.originalname || `${fieldName}.jpg` },
            { caption: `${label} — ${parsed.ism_sharif || 'nomzod'} (yuklanmoqda)` }
          );
          return sent.document ? sent.document.file_id : null;
        } catch (err) {
          console.error(`${fieldName} ni yuklashda xatolik:`, err);
          return null;
        }
      }

      try {
        const [attFileId, msFileId, diplomaFileId] = await Promise.all([
          uploadToAdmin('att_screenshot', 'ATT skrinshot'),
          uploadToAdmin('milliy_sertifikat_screenshot', 'Milliy Sertifikat skrinshot'),
          uploadToAdmin('diploma', 'Diplom'),
        ]);

        const applicationId = await createApplicationWithFiles(auth.user.id, username, parsed, {
          att_screenshot_file_id: attFileId,
          milliy_sertifikat_screenshot_file_id: msFileId,
          diploma_file_id: diplomaFileId,
        });

        res.json({ applicationId });
      } catch (err) {
        console.error('Arizani saqlashda xatolik:', err);
        res.status(500).json({ error: 'server_error' });
      }
    }
  );

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
