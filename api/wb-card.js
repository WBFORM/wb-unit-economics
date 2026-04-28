// api/wb-card.js

export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Missing url param' });
    }

    const nmId = extractNmId(url);
    if (!nmId) {
      return res.status(400).json({ error: 'Cannot parse nmId from url' });
    }

    // Пробуем найти card.json на разных basket-* серверах
    const cardData = await fetchCardJson(nmId);
    if (!cardData) {
      return res.status(404).json({ error: 'WB card.json not found' });
    }

    // Структура card.json может немного отличаться,
    // поэтому аккуратно достаём поля.
    const product = cardData?.data?.products?.[0] || cardData?.products?.[0] || cardData;

    const dimensions = product?.dimensions || product?.dimensions_cm || {};
    const lengthCm = dimensions.length || dimensions.L || null;
    const widthCm = dimensions.width || dimensions.W || null;
    const heightCm = dimensions.height || dimensions.H || null;

    const subjectName =
      product?.subject ||
      product?.subjectName ||
      product?.subj_name ||
      null;

    return res.status(200).json({
      nmId,
      lengthCm,
      widthCm,
      heightCm,
      subjectName,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Вытаскиваем nmId из ссылки вида
// https://www.wildberries.ru/catalog/208285191/detail.aspx?... 
function extractNmId(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split('/');
    const idx = parts.indexOf('catalog');
    if (idx !== -1 && parts.length > idx + 1) {
      const raw = parts[idx + 1];
      const match = raw.match(/\d+/);
      return match ? match[0] : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Получаем card.json, перебирая basket-сервера
async function fetchCardJson(nmId) {
  const article = String(nmId);
  const part = article.slice(0, -3);   // все кроме последних 3 цифр
  const vol = article.slice(0, -5);    // все кроме последних 5 цифр

  // Список basket-* по мотивам парсеров (0X и 14) [web:962]
  const baskets = [
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '07',
    '08',
    '09',
    '10',
    '11',
    '12',
    '13',
    '14',
  ];

  for (const b of baskets) {
    const host = b === '14' ? 'basket-14' : `basket-0${b}`;
    const url = `https://${host}.wbbasket.ru/vol${vol}/part${part}/${article}/info/ru/card.json`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      // Простейшая проверка, что это нужная карточка
      if (data && Object.keys(data).length > 0) {
        return data;
      }
    } catch (e) {
      // Просто пробуем следующий basket
      continue;
    }
  }

  return null;
}
