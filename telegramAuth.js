const crypto = require('crypto');

// Telegram Web App initData'ni tekshiradi (https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app)
// Muvaffaqiyatli bo'lsa { ok: true, user } qaytaradi, aks holda { ok: false }.
function validateInitData(initData, botToken) {
  if (!initData || !botToken) return { ok: false };

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  if (!hash) return { ok: false };
  urlParams.delete('hash');

  const pairs = [];
  for (const [key, value] of urlParams.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return { ok: false };

  let user = null;
  try {
    user = JSON.parse(urlParams.get('user') || 'null');
  } catch (err) {
    user = null;
  }
  if (!user || !user.id) return { ok: false };

  return { ok: true, user };
}

module.exports = { validateInitData };
