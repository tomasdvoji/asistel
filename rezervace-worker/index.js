// Pocita rezervace na slot (prodejna+den+cas), max 2 na slot.
// GET  /slots?key=<site:shop:date>          -> {"9:00":2,...}
// POST /book  {key:"site:shop:date", time}  -> 200 ok | 409 obsazeno
// ponytail: bez zamku - soubezny zapis muze vyjimecne pustit 3. rezervaci; pri realnem provozu to nevadi
const LIMIT = 2;
const TTL = 60 * 60 * 24 * 60; // 60 dni

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/slots') {
      const key = url.searchParams.get('key') || '';
      const data = (await env.BOOKINGS.get(key, 'json')) || {};
      return Response.json(data, { headers: cors });
    }

    if (req.method === 'POST' && url.pathname === '/book') {
      let body;
      try { body = await req.json(); } catch { return new Response('bad request', { status: 400, headers: cors }); }
      const { key, time } = body || {};
      if (!key || !time || !/^[\w:@.-]+$/.test(key) || key.length > 80) {
        return new Response('bad request', { status: 400, headers: cors });
      }
      const data = (await env.BOOKINGS.get(key, 'json')) || {};
      if ((data[time] || 0) >= LIMIT) {
        return new Response('full', { status: 409, headers: cors });
      }
      data[time] = (data[time] || 0) + 1;
      await env.BOOKINGS.put(key, JSON.stringify(data), { expirationTtl: TTL });
      return Response.json(data, { headers: cors });
    }

    return new Response('not found', { status: 404, headers: cors });
  },
};
