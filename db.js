const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

const MIGRATION = `
CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL,
  telegram_username TEXT,
  lavozim TEXT NOT NULL,
  ism_sharif TEXT,
  tugilgan_yili TEXT,
  telefon TEXT,
  viloyat TEXT,
  yashash_joyi TEXT,
  talim TEXT,
  att_ball TEXT,
  att_daraja TEXT,
  att_screenshot_file_id TEXT,
  milliy_sertifikat_daraja TEXT,
  milliy_sertifikat_screenshot_file_id TEXT,
  ish_tajribasi_yil TEXT,
  tajriba TEXT,
  pedagogik_standart TEXT,
  zoom_meet_tajriba TEXT,
  telegram_tajriba TEXT,
  youtube_tajriba TEXT,
  haftalik_kun TEXT,
  namunaviy_video_file_id TEXT,
  namunaviy_video_link TEXT,
  namunaviy_test TEXT,
  shartga_rozi BOOLEAN,
  text_submitted BOOLEAN NOT NULL DEFAULT false,
  att_photo_received BOOLEAN NOT NULL DEFAULT false,
  ms_photo_received BOOLEAN NOT NULL DEFAULT false,
  video_received BOOLEAN NOT NULL DEFAULT false,
  test_received BOOLEAN NOT NULL DEFAULT false,
  holat TEXT NOT NULL DEFAULT 'boshlangan',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_lavozim ON applications(lavozim);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at);
CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(telegram_user_id);

ALTER TABLE applications ADD COLUMN IF NOT EXISTS tugilgan_yili TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS viloyat TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ish_tajribasi_yil TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS namunaviy_video_file_id TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS text_submitted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS att_photo_received BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ms_photo_received BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS video_received BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS test_received BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
`;

async function migrate() {
  await pool.query(MIGRATION);
}

// Web App dan matnli ma'lumotlar kelganda yangi ariza yaratadi (yoki shu foydalanuvchining
// hali to'liq tugallanmagan arizasini yangilaydi).
async function upsertTextSubmission(telegram_user_id, telegram_username, data) {
  const existing = await pool.query(
    `SELECT id FROM applications
     WHERE telegram_user_id = $1 AND holat != 'to''liq'
     ORDER BY created_at DESC LIMIT 1`,
    [telegram_user_id]
  );

  const fields = {
    lavozim: data.lavozim || null,
    ism_sharif: data.ism_sharif || null,
    tugilgan_yili: data.tugilgan_yili || null,
    telefon: data.telefon || null,
    viloyat: data.viloyat || null,
    yashash_joyi: data.yashash_joyi || null,
    talim: data.talim || null,
    att_ball: data.att_ball || null,
    att_daraja: data.att_daraja || null,
    milliy_sertifikat_daraja: data.milliy_sertifikat_daraja || null,
    ish_tajribasi_yil: data.ish_tajribasi_yil || null,
    tajriba: data.tajriba || null,
    pedagogik_standart: data.pedagogik_standart || null,
    zoom_meet_tajriba: data.zoom_meet_tajriba || null,
    telegram_tajriba: data.telegram_tajriba || null,
    youtube_tajriba: data.youtube_tajriba || null,
    haftalik_kun: data.haftalik_kun || null,
  };

  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await pool.query(
      `UPDATE applications SET
        telegram_username=$1, lavozim=$2, ism_sharif=$3, tugilgan_yili=$4, telefon=$5,
        viloyat=$6, yashash_joyi=$7, talim=$8, att_ball=$9, att_daraja=$10,
        milliy_sertifikat_daraja=$11, ish_tajribasi_yil=$12, tajriba=$13,
        pedagogik_standart=$14, zoom_meet_tajriba=$15, telegram_tajriba=$16,
        youtube_tajriba=$17, haftalik_kun=$18, text_submitted=true,
        holat='matn_tugallangan', updated_at=now()
       WHERE id=$19`,
      [
        telegram_username, fields.lavozim, fields.ism_sharif, fields.tugilgan_yili, fields.telefon,
        fields.viloyat, fields.yashash_joyi, fields.talim, fields.att_ball, fields.att_daraja,
        fields.milliy_sertifikat_daraja, fields.ish_tajribasi_yil, fields.tajriba,
        fields.pedagogik_standart, fields.zoom_meet_tajriba, fields.telegram_tajriba,
        fields.youtube_tajriba, fields.haftalik_kun, id,
      ]
    );
    return id;
  }

  const result = await pool.query(
    `INSERT INTO applications (
      telegram_user_id, telegram_username, lavozim, ism_sharif, tugilgan_yili, telefon,
      viloyat, yashash_joyi, talim, att_ball, att_daraja, milliy_sertifikat_daraja,
      ish_tajribasi_yil, tajriba, pedagogik_standart, zoom_meet_tajriba, telegram_tajriba,
      youtube_tajriba, haftalik_kun, text_submitted, holat
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,true,'matn_tugallangan')
    RETURNING id`,
    [
      telegram_user_id, telegram_username, fields.lavozim, fields.ism_sharif, fields.tugilgan_yili,
      fields.telefon, fields.viloyat, fields.yashash_joyi, fields.talim, fields.att_ball,
      fields.att_daraja, fields.milliy_sertifikat_daraja, fields.ish_tajribasi_yil, fields.tajriba,
      fields.pedagogik_standart, fields.zoom_meet_tajriba, fields.telegram_tajriba,
      fields.youtube_tajriba, fields.haftalik_kun,
    ]
  );
  return result.rows[0].id;
}

async function getApplication(id) {
  const result = await pool.query('SELECT * FROM applications WHERE id=$1', [id]);
  return result.rows[0] || null;
}

async function getLatestOpenApplication(telegram_user_id) {
  const result = await pool.query(
    `SELECT * FROM applications WHERE telegram_user_id=$1 AND holat != 'to''liq'
     ORDER BY created_at DESC LIMIT 1`,
    [telegram_user_id]
  );
  return result.rows[0] || null;
}

async function updateApplicationFields(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = keys.map((k) => fields[k]);
  await pool.query(
    `UPDATE applications SET ${setClauses}, updated_at = now() WHERE id = $${keys.length + 1}`,
    [...values, id]
  );
}

async function finalizeApplication(id, shartga_rozi) {
  await pool.query(
    `UPDATE applications SET shartga_rozi=$1, holat='to''liq', updated_at=now() WHERE id=$2`,
    [shartga_rozi, id]
  );
}

async function listRecentApplications(limit = 10) {
  const result = await pool.query(
    `SELECT id, lavozim, ism_sharif, telefon, holat, created_at
     FROM applications ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function getStats() {
  const result = await pool.query(
    `SELECT lavozim, holat, COUNT(*) as soni FROM applications GROUP BY lavozim, holat`
  );
  return result.rows;
}

async function listApplications({ lavozim, holat } = {}) {
  const conditions = [];
  const values = [];
  if (lavozim) {
    values.push(lavozim);
    conditions.push(`lavozim = $${values.length}`);
  }
  if (holat) {
    values.push(holat);
    conditions.push(`holat = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT * FROM applications ${where} ORDER BY created_at DESC`,
    values
  );
  return result.rows;
}

module.exports = {
  pool,
  migrate,
  upsertTextSubmission,
  getApplication,
  getLatestOpenApplication,
  updateApplicationFields,
  finalizeApplication,
  listRecentApplications,
  getStats,
  listApplications,
};
