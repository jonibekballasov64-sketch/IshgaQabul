const { Scenes, Markup } = require('telegraf');
const { saveApplication } = require('../db');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const ATT_DARAJA_OPTIONS = ['Oliy toifa', '1-toifa', '2-toifa'];
const MS_DARAJA_OPTIONS = ['A+', 'A', 'B+', 'B', 'C+', 'C'];
const HAFTALIK_KUN_OPTIONS = ['2 kun', '3 kun'];

function lavozimKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📘 Grammatika ustoz', 'lavozim_grammatika')],
    [Markup.button.callback('🎓 Pedmahorat ustoz', 'lavozim_pedmahorat')],
  ]);
}

function optionsKeyboard(options, prefix) {
  return Markup.inlineKeyboard(
    options.map((opt) => [Markup.button.callback(opt, `${prefix}_${opt}`)])
  );
}

function roziKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Roziman', 'shart_rozi')],
    [Markup.button.callback('❌ Rozi emasman', 'shart_norozi')],
  ]);
}

const wizard = new Scenes.WizardScene(
  'ariza-wizard',

  // Step 0: lavozim tanlash
  async (ctx) => {
    ctx.wizard.state.data = {
      telegram_user_id: ctx.from.id,
      telegram_username: ctx.from.username ? `@${ctx.from.username}` : null,
    };
    await ctx.reply(
      "Assalomu alaykum! Ishga qabul uchun ariza to'ldiramiz.\n\nQaysi lavozimga ariza topshirmoqchisiz?",
      lavozimKeyboard()
    );
    return ctx.wizard.next();
  },

  // Step 1: lavozim javobi -> ism_sharif so'rash
  async (ctx) => {
    if (!ctx.callbackQuery) {
      await ctx.reply("Iltimos, tugmalardan birini tanlang.");
      return;
    }
    const data = ctx.callbackQuery.data;
    const lavozim = data === 'lavozim_grammatika' ? 'Grammatika ustoz' : 'Pedmahorat ustoz';
    ctx.wizard.state.data.lavozim = lavozim;
    await ctx.answerCbQuery();
    await ctx.editMessageText(`Tanlangan lavozim: ${lavozim}`);
    await ctx.reply("F.I.Sh.ingizni to'liq kiriting:");
    return ctx.wizard.next();
  },

  // Step 2: ism_sharif -> telefon so'rash
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, F.I.Sh.ingizni matn ko'rinishida kiriting.");
      return;
    }
    ctx.wizard.state.data.ism_sharif = ctx.message.text.trim();
    await ctx.reply(
      "Telefon raqamingizni yuboring (tugma orqali ulashing yoki qo'lda yozing, masalan: +998901234567):",
      Markup.keyboard([Markup.button.contactRequest('📱 Raqamni ulashish')]).resize().oneTime()
    );
    return ctx.wizard.next();
  },

  // Step 3: telefon -> yashash joyi
  async (ctx) => {
    let telefon = null;
    if (ctx.message && ctx.message.contact) {
      telefon = ctx.message.contact.phone_number;
    } else if (ctx.message && ctx.message.text) {
      telefon = ctx.message.text.trim();
    }
    if (!telefon) {
      await ctx.reply("Iltimos, telefon raqamingizni yuboring.");
      return;
    }
    ctx.wizard.state.data.telefon = telefon;
    await ctx.reply("Yashash joyingizni kiriting (shahar/tuman):", Markup.removeKeyboard());
    return ctx.wizard.next();
  },

  // Step 4: yashash joyi -> ta'lim
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, yashash joyingizni matn ko'rinishida kiriting.");
      return;
    }
    ctx.wizard.state.data.yashash_joyi = ctx.message.text.trim();
    await ctx.reply(
      "Ta'limingiz haqida yozing (OTM nomi, yo'nalishi, bitirgan yili):"
    );
    return ctx.wizard.next();
  },

  // Step 5: ta'lim -> ATT ball
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, ta'lim ma'lumotingizni matn ko'rinishida kiriting.");
      return;
    }
    ctx.wizard.state.data.talim = ctx.message.text.trim();
    await ctx.reply("Attestatsiya (ATT) natijangizdagi ballni kiriting (masalan: 85):");
    return ctx.wizard.next();
  },

  // Step 6: ATT ball -> ATT daraja
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, ATT ballingizni raqam bilan kiriting.");
      return;
    }
    ctx.wizard.state.data.att_ball = ctx.message.text.trim();
    await ctx.reply("ATT bo'yicha toifangizni tanlang:", optionsKeyboard(ATT_DARAJA_OPTIONS, 'att'));
    return ctx.wizard.next();
  },

  // Step 7: ATT daraja -> ATT skrinshot
  async (ctx) => {
    if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('att_')) {
      await ctx.reply("Iltimos, tugmalardan birini tanlang.");
      return;
    }
    const daraja = ctx.callbackQuery.data.replace('att_', '');
    ctx.wizard.state.data.att_daraja = daraja;
    await ctx.answerCbQuery();
    await ctx.editMessageText(`ATT toifasi: ${daraja}`);
    await ctx.reply("ATT natijangiz skrinshotini yuboring (rasm sifatida):");
    return ctx.wizard.next();
  },

  // Step 8: ATT skrinshot -> Milliy Sertifikat daraja
  async (ctx) => {
    if (!ctx.message || !ctx.message.photo) {
      await ctx.reply("Iltimos, ATT natijasi skrinshotini rasm sifatida yuboring.");
      return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.wizard.state.data.att_screenshot_file_id = photo.file_id;
    await ctx.reply(
      "Milliy Sertifikat darajangizni tanlang:",
      optionsKeyboard(MS_DARAJA_OPTIONS, 'ms')
    );
    return ctx.wizard.next();
  },

  // Step 9: MS daraja -> MS skrinshot
  async (ctx) => {
    if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('ms_')) {
      await ctx.reply("Iltimos, tugmalardan birini tanlang.");
      return;
    }
    const daraja = ctx.callbackQuery.data.replace('ms_', '');
    ctx.wizard.state.data.milliy_sertifikat_daraja = daraja;
    await ctx.answerCbQuery();
    await ctx.editMessageText(`Milliy Sertifikat darajasi: ${daraja}`);
    await ctx.reply("Milliy Sertifikat natijangiz skrinshotini yuboring (rasm sifatida):");
    return ctx.wizard.next();
  },

  // Step 10: MS skrinshot -> tajriba
  async (ctx) => {
    if (!ctx.message || !ctx.message.photo) {
      await ctx.reply("Iltimos, Milliy Sertifikat natijasi skrinshotini rasm sifatida yuboring.");
      return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.wizard.state.data.milliy_sertifikat_screenshot_file_id = photo.file_id;
    await ctx.reply("Ish tajribangiz haqida yozing (necha yil, qayerda, qaysi yo'nalishda ishlagansiz):");
    return ctx.wizard.next();
  },

  // Step 11: tajriba -> pedagogik standart (agar pedmahorat) yoki zoom/meet savoliga sakrash
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, ish tajribangizni matn ko'rinishida kiriting.");
      return;
    }
    ctx.wizard.state.data.tajriba = ctx.message.text.trim();

    if (ctx.wizard.state.data.lavozim === 'Pedmahorat ustoz') {
      await ctx.reply(
        "Pedagogik kasb standarti bo'yicha 15 banddan nechtasi bo'yicha ishlagansiz? (masalan: 14/15)"
      );
      return ctx.wizard.next();
    }

    ctx.wizard.state.data.pedagogik_standart = null;
    await ctx.reply("Google Meet/Zoom orqali dars o'tgan tajribangiz bormi? Qisqacha yozing:");
    return ctx.wizard.selectStep(13);
  },

  // Step 12: pedagogik standart -> zoom/meet
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, javobni matn ko'rinishida kiriting (masalan: 14/15).");
      return;
    }
    ctx.wizard.state.data.pedagogik_standart = ctx.message.text.trim();
    await ctx.reply("Google Meet/Zoom orqali dars o'tgan tajribangiz bormi? Qisqacha yozing:");
    return ctx.wizard.next();
  },

  // Step 13: zoom/meet -> telegram tajriba
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, javobni matn ko'rinishida kiriting.");
      return;
    }
    ctx.wizard.state.data.zoom_meet_tajriba = ctx.message.text.trim();
    await ctx.reply("Telegram guruh/kanal orqali ishlagan tajribangiz bormi? Qisqacha yozing:");
    return ctx.wizard.next();
  },

  // Step 14: telegram tajriba -> youtube tajriba
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, javobni matn ko'rinishida kiriting.");
      return;
    }
    ctx.wizard.state.data.telegram_tajriba = ctx.message.text.trim();
    await ctx.reply("YouTube orqali videodars joylagan tajribangiz bormi? Qisqacha yozing:");
    return ctx.wizard.next();
  },

  // Step 15: youtube tajriba -> haftalik kun
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, javobni matn ko'rinishida kiriting.");
      return;
    }
    ctx.wizard.state.data.youtube_tajriba = ctx.message.text.trim();
    await ctx.reply(
      "Haftada nechta kun ishlashga tayyorsiz?",
      optionsKeyboard(HAFTALIK_KUN_OPTIONS, 'kun')
    );
    return ctx.wizard.next();
  },

  // Step 16: haftalik kun -> namunaviy video
  async (ctx) => {
    if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('kun_')) {
      await ctx.reply("Iltimos, tugmalardan birini tanlang.");
      return;
    }
    const kun = ctx.callbackQuery.data.replace('kun_', '');
    ctx.wizard.state.data.haftalik_kun = kun;
    await ctx.answerCbQuery();
    await ctx.editMessageText(`Haftalik ish kuni: ${kun}`);
    await ctx.reply(
      "Endi amaliy sinov topshirig'i.\n\n\"Bog'lovchi\" mavzusida tayyorlagan namunaviy videodarsingiz havolasini yuboring (YouTube yoki boshqa):"
    );
    return ctx.wizard.next();
  },

  // Step 17: namunaviy video -> namunaviy test
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, videodars havolasini matn ko'rinishida yuboring.");
      return;
    }
    ctx.wizard.state.data.namunaviy_video_link = ctx.message.text.trim();
    await ctx.reply(
      "Imtihon darajasida, sifatli, 5-10 ta savoldan iborat namunaviy test tuzing va shu yerga yuboring (har bir savol 4 variant va to'g'ri javobi bilan):"
    );
    return ctx.wizard.next();
  },

  // Step 18: namunaviy test -> shartlar
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, namunaviy testingizni matn ko'rinishida yuboring.");
      return;
    }
    ctx.wizard.state.data.namunaviy_test = ctx.message.text.trim();
    await ctx.reply(
      "Ish shartlari:\n\n" +
        "• Oylik: boshlang'ich 800 000 so'm, natijaga qarab oyma-oy 1 200 000 so'mgacha oshib boradi\n" +
        "• Jadval: haftada 3 kun (yoki 2 kun), har safar 1,5-2 soat\n" +
        "• Format: Google Meet/Zoom, Telegram chat, YouTube orqali videodars\n\n" +
        "Shu shartlarga rozimisiz?",
      roziKeyboard()
    );
    return ctx.wizard.next();
  },

  // Step 19: shartga rozilik -> saqlash va tugatish
  async (ctx) => {
    if (!ctx.callbackQuery || !['shart_rozi', 'shart_norozi'].includes(ctx.callbackQuery.data)) {
      await ctx.reply("Iltimos, tugmalardan birini tanlang.");
      return;
    }
    const rozi = ctx.callbackQuery.data === 'shart_rozi';
    ctx.wizard.state.data.shartga_rozi = rozi;
    await ctx.answerCbQuery();

    const d = ctx.wizard.state.data;
    try {
      const id = await saveApplication(d);
      d.id = id;
    } catch (err) {
      console.error('Arizani saqlashda xatolik:', err);
    }

    if (!rozi) {
      await ctx.editMessageText(
        "Tushunarli. Qiziqish bildirganingiz uchun tashakkur. Shartlar o'zgarsa, qaytib murojaat qilishingiz mumkin."
      );
      return ctx.scene.leave();
    }

    await ctx.editMessageText(
      "Rahmat! Arizangiz qabul qilindi. Tez orada siz bilan bog'lanishadi."
    );

    if (ADMIN_CHAT_ID) {
      const summary =
        `🆕 Yangi ariza (#${d.id || '?'})\n\n` +
        `Lavozim: ${d.lavozim}\n` +
        `F.I.Sh.: ${d.ism_sharif}\n` +
        `Telefon: ${d.telefon}\n` +
        `Yashash joyi: ${d.yashash_joyi}\n` +
        `Ta'lim: ${d.talim}\n` +
        `ATT: ${d.att_ball} ball, ${d.att_daraja}\n` +
        `Milliy Sertifikat: ${d.milliy_sertifikat_daraja}\n` +
        `Tajriba: ${d.tajriba}\n` +
        (d.pedagogik_standart ? `Pedagogik standart: ${d.pedagogik_standart}\n` : '') +
        `Zoom/Meet: ${d.zoom_meet_tajriba}\n` +
        `Telegram: ${d.telegram_tajriba}\n` +
        `YouTube: ${d.youtube_tajriba}\n` +
        `Haftalik kun: ${d.haftalik_kun}\n` +
        `Namunaviy video: ${d.namunaviy_video_link}\n\n` +
        `Namunaviy test:\n${d.namunaviy_test}\n\n` +
        `Telegram: ${d.telegram_username || 'username yo\'q'} (id: ${d.telegram_user_id})`;

      try {
        await ctx.telegram.sendMessage(ADMIN_CHAT_ID, summary);
        if (d.att_screenshot_file_id) {
          await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, d.att_screenshot_file_id, {
            caption: `ATT skrinshot — ariza #${d.id || '?'}`,
          });
        }
        if (d.milliy_sertifikat_screenshot_file_id) {
          await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, d.milliy_sertifikat_screenshot_file_id, {
            caption: `Milliy Sertifikat skrinshot — ariza #${d.id || '?'}`,
          });
        }
      } catch (err) {
        console.error('Adminga xabar yuborishda xatolik:', err);
      }
    }

    return ctx.scene.leave();
  }
);

wizard.command('bekor', async (ctx) => {
  await ctx.reply("Ariza bekor qilindi. Qayta boshlash uchun /start ni bosing.", Markup.removeKeyboard());
  return ctx.scene.leave();
});

module.exports = wizard;
