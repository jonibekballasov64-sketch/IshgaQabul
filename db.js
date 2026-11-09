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
  telefon TEXT,
  yashash_joyi TEXT,
  talim TEXT,
  att_ball TEXT,
  att_daraja TEXT,
  att_screenshot_file_id TEXT,
  milliy_sertifikat_daraja TEXT,
  milliy_sertifikat_screenshot_file_id TEXT,
  tajriba TEXT,
  pedagogik_standart TEXT,
  zoom_meet_tajriba TEXT,
  telegram_tajriba TEXT,
  youtube_tajriba TEXT,
  haftalik_kun TEXT,
  namunaviy_video_link TEXT,
  namunaviy_test TEXT,
  shartga_rozi BOOLEAN,
  holat TEXT NOT NULL DEFAULT 'yangi',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_lavozim ON applications(lavozim);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at);
`;

async function migrate() {
  await pool.query(MIGRATION);
}

async function saveApplication(data) {
  const {
    telegram_user_id, telegram_username, lavozim, ism_sharif, telefon,
    yashash_joyi, talim, att_ball, att_daraja, att_screenshot_file_id,
    milliy_sertifikat_daraja, milliy_sertifikat_screenshot_file_id, tajriba,
    pedagogik_standart, zoom_meet_tajriba, telegram_tajriba, youtube_tajriba,
    haftalik_kun, namunaviy_video_link, namunaviy_test, shartga_rozi,
  } = data;

  const result = await pool.query(
    `INSERT INTO applications (
      telegram_user_id, telegram_username, lavozim, ism_sharif, telefon,
      yashash_joyi, talim, att_ball, att_daraja, att_screenshot_file_id,
      milliy_sertifikat_daraja, milliy_sertifikat_screenshot_file_id, tajriba,
      pedagogik_standart, zoom_meet_tajriba, telegram_tajriba, youtube_tajriba,
      haftalik_kun, namunaviy_video_link, namunaviy_test, shartga_rozi
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
    RETURNING id`,
    [
      telegram_user_id, telegram_username, lavozim, ism_sharif, telefon,
      yashash_joyi, talim, att_ball, att_daraja, att_screenshot_file_id,
      milliy_sertifikat_daraja, milliy_sertifikat_screenshot_file_id, tajriba,
      pedagogik_standart, zoom_meet_tajriba, telegram_tajriba, youtube_tajriba,
      haftalik_kun, namunaviy_video_link, namunaviy_test, shartga_rozi,
    ]
  );
  return result.rows[0].id;
}

async function listRecentApplications(limit = 10) {
  const result = await pool.query(
    `SELECT id, lavozim, ism_sharif, telefon, created_at, holat
     FROM applications ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

module.exports = { pool, migrate, saveApplication, listRecentApplications };
