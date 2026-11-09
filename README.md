# IshgaQabul

Grammatika ustoz va Pedmahorat ustoz lavozimlariga ishga qabul qilish uchun Telegram bot.

## Nima qiladi

Nomzod botga `/start` yozadi, bot unga lavozimni tanlashni so'raydi va keyin ketma-ket savollar beradi:
umumiy ma'lumot, ATT va Milliy Sertifikat natijalari (skrinshot bilan), ish tajribasi, texnik
ko'nikmalar, namunaviy videodars havolasi va namunaviy test. Oxirida ish shartlari ko'rsatiladi va
nomzod rozilik bildiradi. Har bir ariza PostgreSQL bazasiga saqlanadi va admin'ga Telegram orqali
to'liq ma'lumot yuboriladi (skrinshotlar bilan birga).

## O'rnatish

```bash
npm install
cp .env.example .env
```

`.env` faylga quyidagilarni kiriting:

- `BOT_TOKEN` — @BotFather dan olingan token
- `ADMIN_CHAT_ID` — arizalar yuboriladigan Telegram user id (admin)
- `DATABASE_URL` — PostgreSQL ulanish manzili (Railway Postgres plugin avtomatik beradi)
- `PORT` — ixtiyoriy, default 3000

## Ishga tushirish

```bash
npm start
```

## Admin buyruqlari

- `/oxirgi` — so'nggi 10 ta arizani ro'yxat ko'rinishida ko'rsatadi (faqat `ADMIN_CHAT_ID` uchun)

## Texnologiyalar

Node.js, Telegraf (bot + wizard scenes), Express (health-check), PostgreSQL (pg).
