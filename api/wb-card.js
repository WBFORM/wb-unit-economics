// api/wb-card.js
// Берём только nmId и главное фото товара с WB

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

    const productUrl = `https://www.wildberries.ru/catalog/${nmId}/detail.aspx`;

    // Тянем HTML страницы товара
    const resp = await fetch(productUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
      },
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'WB page fetch failed' });
    }

    const html = await resp.text();

    // Пытаемся найти главное изображение
    const imageUrl = extractMainImageUrl(html, nmId);

    return res.status(200).json({
      nmId,
      productUrl,
      imageUrl: imageUrl || null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Вытаскиваем nmId из URL
function extractNmId(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const path = u.pathname || '';

    // /catalog/553101632/detail.aspx
    const match = path.match(/\/catalog\/(\d+)/);
    if (match && match[1]) {
      return match[1];
    }

    // На всякий случай ищем любое длинное число
    const digitsMatch = path.match(/(\d{6,})/);
    if (digitsMatch && digitsMatch[1]) {
      return digitsMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

// Грубый парсер главного изображения из HTML
function extractMainImageUrl(html, nmId) {
  if (!html) return null;

  // 1) ищем img с ссылкой на wbcontent/wbbasket
  let match =
    html.match(/<img[^>]+src="([^"]+?(?:wbcontent|wbbasket)[^"]+)"/i) ||
    html.match(/"zoomImage":"([^"]+?wbcontent[^"]+)"/i) ||
    html.match(/"image":"([^"]+?wbcontent[^"]+)"/i);

  if (match && match[1]) {
    return normalizeImageUrl(match[1]);
  }

  // 2) fallback: ищем любой URL с nmId и .jpg/.jpeg/.png/.webp
  match = html.match(
    new RegExp(`https?://[^"']*${nmId}[^"']*\\.(?:jpg|jpeg|png|webp)`, 'i')
  );
  if (match && match[0]) {
    return match[0];
  }

  return null;
}

function normalizeImageUrl(src) {
  // Если относительный путь — можно дополнительно прикрутить домен,
  // но на WB обычно уже абсолютные ссылки https://...
  if (src.startsWith('//')) {
    return 'https:' + src;
  }
  return src;
}
