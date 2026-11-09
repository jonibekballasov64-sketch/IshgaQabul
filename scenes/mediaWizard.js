const { Scenes } = require('telegraf');
const { updateApplicationFields, finalizeApplication, getApplication } = require('../db');

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Bu scene Web App orqali matn + hujjatlar (skrinshot, diplom) allaqachon saqlangandan
// keyin ishga tushadi. Bu yerda faqat namunaviy video va test so'raladi.
// ctx.scene.enter('media-wizard', { applicationId }) orqali kiritiladi.
const wizard = new Scenes.WizardScene(
  'media-wizard',

  // Step 0: kirish — namunaviy video so'rash
  async (ctx) => {
    ctx.wizard.state.applicationId = ctx.scene.state.applicationId;
    await ctx.reply(
      "Hujjatlaringiz qabul qilindi! Endi so'nggi bosqich.\n\n" +
        "\"Bog'lovchi\" mavzusida tayyorlagan namunaviy videodarsingizni yuboring.\n\n" +
        "Video faylni to'g'ridan-to'g'ri shu yerga yuborishingiz mumkin, yoki YouTube havolasini yozing:"
    );
    return ctx.wizard.next();
  },

  // Step 1: video (fayl yoki havola) -> namunaviy test
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

  // Step 2: namunaviy test -> yakunlash
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Iltimos, namunaviy testingizni matn ko'rinishida yuboring.");
      return;
    }
    await updateApplicationFields(ctx.wizard.state.applicationId, {
      namunaviy_test: ctx.message.text.trim(),
      test_received: true,
    });

    const id = ctx.wizard.state.applicationId;
    await finalizeApplication(id, true);
    await ctx.reply("Rahmat! Arizangiz to'liq qabul qilindi. Tez orada siz bilan bog'lanishadi.");

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
        `Zoom/Meet/YouTube'da dars o'ta oladi: ${{ ha: 'Ha', yoq: "Yo'q", qisman: 'Qisman' }[d.onlayn_dars_otkazish] || d.onlayn_dars_otkazish}\n` +
        `Zoom/Meet: ${d.zoom_meet_tajriba}\n` +
        `Telegram: ${d.telegram_tajriba}\n` +
        `YouTube: ${d.youtube_tajriba}\n` +
        `Haftalik kun: ${d.haftalik_kun}\n` +
        (d.namunaviy_video_link ? `Namunaviy video: ${d.namunaviy_video_link}\n` : '') +
        `\nNamunaviy test:\n${d.namunaviy_test}\n\n` +
        `Telegram: ${d.telegram_username || "username yo'q"} (id: ${d.telegram_user_id})\n\n` +
        `ATT/Milliy Sertifikat skrinshot va diplom yuqorida alohida yuborilgan edi.`;

      try {
        await ctx.telegram.sendMessage(ADMIN_CHAT_ID, summary);
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
