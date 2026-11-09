# IshgaQabul

Grammatika ustoz va Pedmahorat ustoz lavozimlariga ishga qabul qilish uchun Telegram bot + Web App forma + admin panel.

## Nima qiladi

Nomzod botga `/start` yozadi va Telegram **Web App** (Mini App) tugmasi orqali bitta sahifada barcha
matnli savollarga javob beradi: lavozim, F.I.Sh., tug'ilgan yili, telefon, viloyat (ro'yxatdan tanlab),
ta'lim, ATT/Milliy Sertifikat ko'rsatkichlari, ish tajribasi (yil), texnik ko'nikmalar va haftalik kun.

Forma yuborilgandan so'ng bot chatda davom etadi va ATT/Milliy Sertifikat skrinshotlarini, namunaviy
videodarsni (video fayl sifatida yoki havola) va namunaviy testni so'raydi — bular Telegram orqali
yuborilgani qulayroq. Oxirida ish shartlari ko'rsatiladi, nomzod rozilik bildiradi va **sizga (admin)
shaxsiy chatga** to'liq ma'lumot + skrinshotlar + video yuboriladi.

Har bir ariza PostgreSQL bazasida saqlanadi — forma to'ldirilgani, lekin hujjatlar yuborilmagani ham
("qisman") alohida kuzatiladi. **Admin panel** (`/admin`) orqali lavozim bo'yicha nechta ariza
tushgani, nechtasi to'liq va nechtasi qisman to'ldirilgani ko'rinadi, har bir arizani batafsil ochib
ko'rish mumkin.

## O'rnatish

```bash
npm install
cp .env.example .env
```

`.env` faylga quyidagilarni kiriting:

- `BOT_TOKEN` — @BotFather dan olingan token
- `ADMIN_CHAT_ID` — arizalar yuboriladigan Telegram user id (admin)
- `ADMIN_KEY` — admin panelga kirish uchun maxfiy kalit (URL'da `?key=...` sifatida ishlatiladi)
- `DATABASE_URL` — PostgreSQL ulanish manzili (Railway Postgres plugin avtomatik beradi)
- `WEBAPP_URL` — bot deploy qilingan domenning `/webapp/` manzili (masalan:
  `https://ishgaqabul-bot.up.railway.app/webapp/`) — bu bo'lmasa, `/start` Web App tugmasini
  ko'rsatmaydi
- `PORT` — ixtiyoriy, default 3000

## Ishga tushirish

```bash
npm start
```

## Sahifalar

- `/webapp/` — nomzod uchun ariza formasi (faqat Telegram ichida ochiladi)
- `/admin/?key=<ADMIN_KEY>` — admin panel: statistika va arizalar ro'yxati

## Admin buyruqlari (Telegramda)

- `/oxirgi` — so'nggi 10 ta arizani ro'yxat ko'rinishida ko'rsatadi (faqat `ADMIN_CHAT_ID` uchun)

## Texnologiyalar

Node.js, Telegraf (bot + wizard scene + Web App), Express (static + admin API), PostgreSQL (pg).
