// Pocita rezervace na slot (prodejna+den+cas), max 2 na slot.
// GET  /slots?key=<site:shop:date>          -> {"9:00":2,...}
// POST /book  {key:"site:shop:date", time}  -> 200 ok | 409 obsazeno
// ponytail: bez zamku - soubezny zapis muze vyjimecne pustit 3. rezervaci; pri realnem provozu to nevadi
const LIMIT = 2;
const TTL = 60 * 60 * 24 * 60; // 60 dni

const SITES = ['alerta', 'asistel'];
const DASH_KEY = 'prehled-7g2k9xqv4m'; // klic do prehledu statistik (neni tajemstvi, jen zavora)
const STATS_TTL = 60 * 60 * 24 * 400;

async function bump(env, site, kind, name) {
  if (!SITES.includes(site)) return;
  const day = new Date().toISOString().slice(0, 10);
  const key = `st:${site}:${day}`;
  const data = (await env.BOOKINGS.get(key, 'json')) || { v: {}, e: {} };
  data[kind][name] = (data[kind][name] || 0) + 1;
  await env.BOOKINGS.put(key, JSON.stringify(data), { expirationTtl: STATS_TTL });
}

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
      await bump(env, key.split(':')[0], 'e', 'rezervace'); // statistika rezervaci
      return Response.json(data, { headers: cors });
    }

    // ---------- anonymni statistiky (zadne cookies, zadne osobni udaje) ----------
    // ponytail: KV bez zamku - pri soubehu se par kliku ztrati; pro prehledy to staci
    if (req.method === 'POST' && (url.pathname === '/hit' || url.pathname === '/event')) {
      let b;
      try { b = await req.json(); } catch { return new Response('bad request', { status: 400, headers: cors }); }
      const site = b && SITES.includes(b.site) ? b.site : null;
      const val = String((b && (url.pathname === '/hit' ? b.path : b.name)) || '').slice(0, 80);
      if (!site || !val) return new Response('bad request', { status: 400, headers: cors });
      await bump(env, site, url.pathname === '/hit' ? 'v' : 'e', val);
      return new Response('ok', { headers: cors });
    }

    if (req.method === 'GET' && url.pathname === '/stats') {
      if (url.searchParams.get('key') !== DASH_KEY) return new Response('forbidden', { status: 403, headers: cors });
      const site = url.searchParams.get('site');
      if (!SITES.includes(site)) return new Response('bad request', { status: 400, headers: cors });
      const days = Math.min(90, Number(url.searchParams.get('days')) || 30);
      const out = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        out.push({ date: d, ...((await env.BOOKINGS.get(`st:${site}:${d}`, 'json')) || { v: {}, e: {} }) });
      }
      return Response.json(out, { headers: cors });
    }

    if (req.method === 'GET' && url.pathname === '/dash') {
      if (url.searchParams.get('key') !== DASH_KEY) return new Response('forbidden', { status: 403 });
      return new Response(DASH_HTML, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    return new Response('not found', { status: 404, headers: cors });
  },
};

const DASH_HTML = `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Statistiky webu</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;background:#141414;color:#eee;margin:0;padding:24px;max-width:960px;margin-inline:auto}
h1{font-size:1.4rem}h2{font-size:1.05rem;margin:26px 0 8px;color:#E20074}
.row{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
.tile{background:#1f1f1f;border:1px solid #333;border-radius:12px;padding:14px 20px;min-width:120px}
.tile b{display:block;font-size:1.6rem}
table{border-collapse:collapse;width:100%}td,th{padding:6px 10px;border-bottom:1px solid #2c2c2c;text-align:left}
th{color:#999;font-weight:600}td.n{text-align:right;font-variant-numeric:tabular-nums}
select,button{background:#1f1f1f;color:#eee;border:1px solid #444;border-radius:8px;padding:6px 12px;font:inherit}
.muted{color:#888;font-size:.85rem}
</style></head><body>
<h1>Statistiky <select id="site"><option>alerta</option><option>asistel</option></select>
<select id="days"><option value="7">7 dní</option><option value="30" selected>30 dní</option><option value="90">90 dní</option></select></h1>
<p class="muted">Anonymní počty bez cookies. Obnovuje se každých 30 s — <span id="upd"></span></p>
<div class="row" id="tiles"></div>
<h2>Akce návštěvníků</h2><table id="events"></table>
<h2>Nejnavštěvovanější stránky</h2><table id="pages"></table>
<h2>Po dnech</h2><table id="daily"></table>
<script>
const KEY=new URLSearchParams(location.search).get('key');
const NAMES={rezervace:'Odeslané objednávky','objednat-klik':'Klik na Objednat se',tel:'Klik na telefon',mailto:'Klik na e-mail'};
async function load(){
  const site=document.getElementById('site').value, days=document.getElementById('days').value;
  const r=await fetch('/stats?site='+site+'&days='+days+'&key='+encodeURIComponent(KEY));
  if(!r.ok){document.body.innerHTML='<p>Přístup odepřen.</p>';return}
  const data=await r.json();
  const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
  const views=data.reduce((a,d)=>a+sum(d.v),0);
  const today=data[0]?sum(data[0].v):0;
  const ev={},pg={};
  data.forEach(d=>{for(const[k,n]of Object.entries(d.e))ev[k]=(ev[k]||0)+n;for(const[k,n]of Object.entries(d.v))pg[k]=(pg[k]||0)+n;});
  document.getElementById('tiles').innerHTML=
    '<div class="tile"><b>'+today+'</b>zobrazení dnes</div>'+
    '<div class="tile"><b>'+views+'</b>zobrazení za '+days+' dní</div>'+
    '<div class="tile"><b>'+(ev.rezervace||0)+'</b>objednávek</div>'+
    '<div class="tile"><b>'+(ev['objednat-klik']||0)+'</b>kliků na Objednat</div>';
  const rows=(obj,label)=>'<tr><th>'+label+'</th><th class="n">počet</th></tr>'+Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,15)
    .map(([k,n])=>'<tr><td>'+(NAMES[k]||k)+'</td><td class="n">'+n+'</td></tr>').join('');
  document.getElementById('events').innerHTML=rows(ev,'akce')||'<tr><td class="muted">zatím nic</td></tr>';
  document.getElementById('pages').innerHTML=rows(pg,'stránka');
  document.getElementById('daily').innerHTML='<tr><th>den</th><th class="n">zobrazení</th><th class="n">akce</th></tr>'+
    data.map(d=>'<tr><td>'+d.date+'</td><td class="n">'+sum(d.v)+'</td><td class="n">'+sum(d.e)+'</td></tr>').join('');
  document.getElementById('upd').textContent='aktualizováno '+new Date().toLocaleTimeString('cs');
}
document.getElementById('site').onchange=load;document.getElementById('days').onchange=load;
load();setInterval(load,30000);
</script></body></html>`;
