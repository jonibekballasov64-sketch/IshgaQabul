const { Scenes, Markup } = require('telegraf');
const { updateApplicationFields, finalizeApplication, getApplication } = require('../db');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

function roziKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Roziman', 'shart_rozi')],
    [Markup.button.callback('❌ Rozi emasman', 'shart_norozi')],
  ]);
}

// Bu scene faqat matnli ariza (Web App orqali) qabul qilingandan keyin ishga tushadi.
// ctx.scene.enter('media-wizard', { applicationId }) orqali kiritiladi.
const wizard = new Scenes.WizardScene(
  'media-wizard',

  // Step 0: kirish — ATT skrinshot so'rash
  async (ctx) => {
    ctx.wizard.state.applicationId = ctx.scene.state.applicationId;
    await ctx.reply(
      "Ma'lumotlaringiz qabul qilindi! Endi hujjatlarni yuboring.\n\nATT natijangiz skrinshotini rasm sifatida yuboring:"
    );
    return ctx.wizard.next();
  },

  // Step 1: ATT skrinshot -> Milliy Sertifikat skrinshot
  async (ctx) => {
    if (!ctx.message || !ctx.message.photo) {
      await ctx.reply("Iltimos, ATT natijasi skrinshotini rasm sifatida yuboring.");
      return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    await updateApplicationFields(ctx.wizard.state.applicationId, {
      att_screenshot_file_id: photo.file_id,
      att_photo_received: true,
    });
    await ctx.reply("Milliy Sertifikat natijangiz skrinshotini yuboring (rasm sifatida):");
    return ctx.wizard.next();
  },

  // Step 2: MS skrinshot -> namunaviy video
  async (ctx) => {
    if (!ctx.message || !ctx.message.photo) {
      await ctx.reply("Iltimos, Milliy Sertifikat natijasi skrinshotini rasm sifatida yuboring.");
      return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    await updateApplicationFields(ctx.wizard.state.applicationId, {
      milliy_sertifikat_screenshot_file_id: photo.file_id,
      ms_photo_received: true,
    });
    await ctx.reply(
      "Endi \"bog'lovchi\" mavzusida tayyorlagan namunaviy videodarsingizni yuboring.\n\n" +
        "Video faylni to'g'ridan-to'g'ri shu yerga yuborishingiz mumkin, yoki YouTube havolasini yozing:"
    );
    return ctx.wizard.next();
  },

  // Step 3: video (fayl yoki havola) -> namunaviy test
  async (ctx) => {
    const fields = { video_received: true };
    if (ctx.message && ctx.message.video) {
      fields.namunaviy_video_file_id = ctx.message.video.file_id;
    } else if (ctx.message && ctx.message.document) {
      fields.namunaviy_video_file_id = ctx.message.document.file_id;
    } else if (ctx.message && ctx.message.text) {
      fields.namunaviy_video_link = ctx.message.text.trim();
    } else {
      await ctx.reply("Iltimos, video faylni yoki uning havolasini yuboring.");
      return;
    }
    await updateApplicationFields(ctx.wizard.state.applicationId, fields);
    await ctx.reply(
      "Imtihon darajasida, sifatli, 5-10 ta savoldan iborat namunaviy test tuzing va shu yerga yuboring (har bir savol 4 variant va to'g'ri javobi bilan):"
    );
    return ctx.wizard.next();
  },

  // Step 4: namunaviy test -> shartlar
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, namunaviy testingizni matn ko'rinishida yuboring.");
      return;
    }
    await updateApplicationFields(ctx.wizard.state.applicationId, {
      namunaviy_test: ctx.message.text.trim(),
      test_received: true,
    });
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

  // Step 5: shartga rozilik -> yakunlash
  async (ctx) => {
    if (!ctx.callbackQuery || !['shart_rozi', 'shart_norozi'].includes(ctx.callbackQuery.data)) {
      await ctx.reply("Iltimos, tugmalardan birini tanlang.");
      return;
    }
    const rozi = ctx.callbackQuery.data === 'shart_rozi';
    await ctx.answerCbQuery();
    const id = ctx.wizard.state.applicationId;
    await finalizeApplication(id, rozi);

    if (!rozi) {
      await ctx.editMessageText(
        "Tushunarli. Qiziqish bildirganingiz uchun tashakkur. Shartlar o'zgarsa, qaytib murojaat qilishingiz mumkin."
      );
      return ctx.scene.leave();
    }

    await ctx.editMessageText("Rahmat! Arizangiz to'liq qabul qilindi. Tez orada siz bilan bog'lanishadi.");

    const d = await getApplication(id);
    if (ADMIN_CHAT_ID && d) {
      const summary =
        `🆕 Yangi ariza (#${d.id}) — TO'LIQ\n\n` +
        `Lavozim: ${d.lavozim}\n` +
        `F.I.Sh.: ${d.ism_sharif}\n` +
        `Tug'ilgan yili: ${d.tugilgan_yili}\n` +
        `Telefon: ${d.telefon}\n` +
        `Viloyat: ${d.viloyat}${d.yashash_joyi ? ', ' + d.yashash_joyi : ''}\n` +
        `Ta'lim: ${d.talim}\n` +
        `ATT: ${d.att_ball} ball, ${d.att_daraja}\n` +
        `Milliy Sertifikat: ${d.milliy_sertifikat_daraja}\n` +
        `Ish tajribasi: ${d.ish_tajribasi_yil} yil — ${d.tajriba}\n` +
        (d.pedagogik_standart ? `Pedagogik standart: ${d.pedagogik_standart}\n` : '') +
        `Zoom/Meet: ${d.zoom_meet_tajriba}\n` +
        `Telegram: ${d.telegram_tajriba}\n` +
        `YouTube: ${d.youtube_tajriba}\n` +
        `Haftalik kun: ${d.haftalik_kun}\n` +
        (d.namunaviy_video_link ? `Namunaviy video: ${d.namunaviy_video_link}\n` : '') +
        `\nNamunaviy test:\n${d.namunaviy_test}\n\n` +
        `Telegram: ${d.telegram_username || "username yo'q"} (id: ${d.telegram_user_id})`;

      try {
        await ctx.telegram.sendMessage(ADMIN_CHAT_ID, summary);
        if (d.att_screenshot_file_id) {
          await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, d.att_screenshot_file_id, {
            caption: `ATT skrinshot — ariza #${d.id}`,
          });
        }
        if (d.milliy_sertifikat_screenshot_file_id) {
          await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, d.milliy_sertifikat_screenshot_file_id, {
            caption: `Milliy Sertifikat skrinshot — ariza #${d.id}`,
          });
        }
        if (d.namunaviy_video_file_id) {
          await ctx.telegram.sendVideo(ADMIN_CHAT_ID, d.namunaviy_video_file_id, {
            caption: `Namunaviy videodars — ariza #${d.id}`,
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
  await ctx.reply("Ariza bekor qilindi. Qayta boshlash uchun /start ni bosing.");
  return ctx.scene.leave();
});

module.exports = wizard;
