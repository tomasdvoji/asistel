// Pocita rezervace na slot (prodejna+den+cas), max 2 na slot.
// GET  /slots?key=<site:shop:date>          -> {"9:00":2,...}
// POST /book  {key:"site:shop:date", time}  -> 200 ok | 409 obsazeno
// ponytail: bez zamku - soubezny zapis muze vyjimecne pustit 3. rezervaci; pri realnem provozu to nevadi
const LIMIT = 2;
const TTL = 60 * 60 * 24 * 60; // 60 dni

const SITES = ['alerta', 'asistel'];
const DASH_KEY = 'prehled-7g2k9xqv4m'; // master klic (zpetna kompatibilita)
const ACCOUNTS = { alerta: { pass: 'alerta1', key: 'k-alerta-x7q2w' }, asistel: { pass: 'asistel1', key: 'k-asistel-m9v4p' } };
const STATS_TTL = 60 * 60 * 24 * 400;
const GREPOS = { alerta: 'tomasdvoji/Alerta1', asistel: 'tomasdvoji/asistel' };
// soubory editovatelne pres /data (whitelist — nic jineho nejde cist ani zapisovat)
const FILES = { home: 'home.json', kariera: 'kariera.json', objednat: 'objednat.json', site: 'site.json', team: 'team.json', album: 'album.json' };

async function ghPut(env, repo, path, b64, msg) {
  const api = 'https://api.github.com/repos/' + repo + '/contents/' + path;
  const gh = { Authorization: 'Bearer ' + env.GH_TOKEN, 'User-Agent': 'pozice-admin', Accept: 'application/vnd.github+json' };
  const cur = await fetch(api, { headers: gh });
  const sha = cur.ok ? (await cur.json()).sha : undefined;
  return fetch(api, { method: 'PUT', headers: { ...gh, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, content: b64, sha }) });
}

async function bump(env, site, kind, name) {
  if (!SITES.includes(site)) return;
  const day = new Date().toISOString().slice(0, 10);
  const key = `st:${site}:${day}`;
  const data = (await env.BOOKINGS.get(key, 'json')) || { v: {}, e: {} };
  data[kind][name] = (data[kind][name] || 0) + 1;
  await env.BOOKINGS.put(key, JSON.stringify(data), { expirationTtl: STATS_TTL });
}

// sendBeacon posila credentials -> ACAO nesmi byt '*', zrcadlime konkretni Origin
const corsFor = (req) => ({
  'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
  'Vary': 'Origin',
});

export default {
  async fetch(req, env) {
    const cors = corsFor(req);
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
      const ua = req.headers.get('user-agent') || '';
      if (/bot|crawl|spider|headless|lighthouse|preview/i.test(ua)) return new Response('ok', { headers: cors });
      if (url.pathname === '/event') {
        await bump(env, site, 'e', val);
        return new Response('ok', { headers: cors });
      }
      // /hit: zobrazeni + unikat (denni rotujici hash IP+UA, IP se nikdy neuklada), zdroj, zarizeni
      const day = new Date().toISOString().slice(0, 10);
      const key = `st:${site}:${day}`;
      const data = (await env.BOOKINGS.get(key, 'json')) || { v: {}, e: {} };
      data.v[val] = (data.v[val] || 0) + 1;
      const ip = req.headers.get('cf-connecting-ip') || '';
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(day + '|' + DASH_KEY + '|' + ip + '|' + ua));
      const h = [...new Uint8Array(buf).slice(0, 4)].map((x) => x.toString(16).padStart(2, '0')).join('');
      (data.u = data.u || {})[h] = 1;
      const ref = String(b.r || '').slice(0, 60).replace(/[^\w.-]/g, '');
      if (ref) (data.r = data.r || {})[ref] = ((data.r || {})[ref] || 0) + 1;
      const dev = b.d === 'm' ? 'm' : b.d === 'd' ? 'd' : null;
      if (dev) (data.d = data.d || {})[dev] = ((data.d || {})[dev] || 0) + 1;
      await env.BOOKINGS.put(key, JSON.stringify(data), { expirationTtl: STATS_TTL });
      return new Response('ok', { headers: cors });
    }

    if (req.method === 'POST' && url.pathname === '/login') {
      let b;
      try { b = await req.json(); } catch { return new Response('bad request', { status: 400, headers: cors }); }
      const acc = ACCOUNTS[(b && b.user || '').toLowerCase().trim()];
      if (!acc || acc.pass !== (b && b.pass)) return new Response('forbidden', { status: 403, headers: cors });
      return Response.json({ site: (b.user || '').toLowerCase().trim(), key: acc.key }, { headers: cors });
    }

    if (req.method === 'GET' && url.pathname === '/stats') {
      const site = url.searchParams.get('site');
      if (!SITES.includes(site)) return new Response('bad request', { status: 400, headers: cors });
      const k = url.searchParams.get('key');
      if (k !== DASH_KEY && k !== ACCOUNTS[site].key) return new Response('forbidden', { status: 403, headers: cors });
      const days = Math.min(90, Number(url.searchParams.get('days')) || 30);
      const out = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        out.push({ date: d, ...((await env.BOOKINGS.get(`st:${site}:${d}`, 'json')) || { v: {}, e: {} }) });
      }
      return Response.json(out, { headers: cors });
    }

    if (req.method === 'GET' && url.pathname === '/dash') {
      return new Response(DASH_HTML, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---------- jednoducha administrace volnych pozic (bez GitHub uctu) ----------
    if (req.method === 'GET' && url.pathname === '/padmin') {
      return new Response(PADMIN_HTML, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }
    if (url.pathname === '/pozice') {
      const site = url.searchParams.get('site');
      const k = url.searchParams.get('key');
      if (!SITES.includes(site) || (k !== DASH_KEY && k !== ACCOUNTS[site].key)) {
        return new Response('forbidden', { status: 403, headers: cors });
      }
      const REPOS = { alerta: 'tomasdvoji/Alerta1', asistel: 'tomasdvoji/asistel' };
      const api = 'https://api.github.com/repos/' + REPOS[site] + '/contents/src/data/editable/pozice.json';
      const gh = { Authorization: 'Bearer ' + env.GH_TOKEN, 'User-Agent': 'pozice-admin', Accept: 'application/vnd.github+json' };
      if (req.method === 'GET') {
        // cteni z verejneho repa nepotrebuje token
        const r = await fetch('https://raw.githubusercontent.com/' + REPOS[site] + '/main/src/data/editable/pozice.json', { headers: { 'User-Agent': 'pozice-admin' } });
        if (!r.ok) return new Response('github ' + r.status, { status: 502, headers: cors });
        return Response.json({ items: (await r.json()).items || [] }, { headers: cors });
      }
      if (!env.GH_TOKEN) return new Response('GH_TOKEN neni nastaveny (wrangler secret put GH_TOKEN)', { status: 503, headers: cors });
      if (req.method === 'POST') {
        let b;
        try { b = await req.json(); } catch { return new Response('bad request', { status: 400, headers: cors }); }
        if (!Array.isArray(b.items) || b.items.length > 30) return new Response('bad request', { status: 400, headers: cors });
        const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
        const items = b.items.map((p) => ({
          id: slug(p.id || (String(p.title || 'pozice') + '-' + String(p.misto || ''))),
          title: String(p.title || '').slice(0, 80).trim(),
          misto: String(p.misto || '').slice(0, 60).trim(),
          typ: String(p.typ || 'Plný úvazek').slice(0, 40).trim(),
          text: String(p.text || '').slice(0, 4000),
        })).filter((p) => p.id && p.title && p.misto);
        const cur = await fetch(api, { headers: gh });
        const sha = cur.ok ? (await cur.json()).sha : undefined;
        const body = JSON.stringify({ items }, null, 2) + '\n';
        const bytes = new TextEncoder().encode(body);
        let bin = ''; for (const x of bytes) bin += String.fromCharCode(x);
        const r = await fetch(api, {
          method: 'PUT',
          headers: { ...gh, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'pozice: uprava pres administraci naboru', content: btoa(bin), sha }),
        });
        if (!r.ok) return new Response('github ' + r.status, { status: 502, headers: cors });
        return Response.json({ ok: true, count: items.length }, { headers: cors });
      }
    }

    // ---------- texty webu (whitelistovane JSONy) ----------
    if (url.pathname === '/data') {
      const site = url.searchParams.get('site');
      const k = url.searchParams.get('key');
      const file = url.searchParams.get('file');
      if (!SITES.includes(site) || (k !== DASH_KEY && k !== ACCOUNTS[site].key) || !FILES[file]) {
        return new Response('forbidden', { status: 403, headers: cors });
      }
      const path = 'src/data/editable/' + FILES[file];
      if (req.method === 'GET') {
        const r = await fetch('https://raw.githubusercontent.com/' + GREPOS[site] + '/main/' + path, { headers: { 'User-Agent': 'pozice-admin' }, cf: { cacheTtl: 0 } });
        if (!r.ok) return new Response('github ' + r.status, { status: 502, headers: cors });
        return Response.json(await r.json(), { headers: cors });
      }
      if (req.method === 'POST') {
        if (!env.GH_TOKEN) return new Response('GH_TOKEN neni nastaveny', { status: 503, headers: cors });
        let b;
        try { b = await req.json(); } catch { return new Response('bad request', { status: 400, headers: cors }); }
        if (!b || typeof b.data !== 'object') return new Response('bad request', { status: 400, headers: cors });
        const body = JSON.stringify(b.data, null, 2) + '\n';
        if (body.length > 300000) return new Response('too big', { status: 400, headers: cors });
        const bytes = new TextEncoder().encode(body);
        let bin = ''; for (const x of bytes) bin += String.fromCharCode(x);
        const r = await ghPut(env, GREPOS[site], path, btoa(bin), 'web: uprava ' + FILES[file] + ' pres administraci');
        if (!r.ok) return new Response('github ' + r.status, { status: 502, headers: cors });
        return Response.json({ ok: true }, { headers: cors });
      }
    }

    // ---------- upload fotky (album + tym) ----------
    if (req.method === 'POST' && url.pathname === '/foto') {
      const site = url.searchParams.get('site');
      const k = url.searchParams.get('key');
      if (!SITES.includes(site) || (k !== DASH_KEY && k !== ACCOUNTS[site].key)) {
        return new Response('forbidden', { status: 403, headers: cors });
      }
      if (!env.GH_TOKEN) return new Response('GH_TOKEN neni nastaveny', { status: 503, headers: cors });
      let b;
      try { b = await req.json(); } catch { return new Response('bad request', { status: 400, headers: cors }); }
      const path = String(b && b.path || '');
      const b64 = String(b && b.b64 || '');
      if (!/^(album\/[a-z0-9-]{1,60}\/\d{1,3}\.jpg|uploads\/zamestnanci\/[a-z0-9-]{1,80}\.jpg)$/.test(path) ||
          !b64 || b64.length > 4000000 || /[^A-Za-z0-9+/=]/.test(b64.slice(0, 1000))) {
        return new Response('bad request', { status: 400, headers: cors });
      }
      const r = await ghPut(env, GREPOS[site], 'public/' + path, b64, 'web: fotka ' + path + ' pres administraci');
      if (!r.ok) return new Response('github ' + r.status, { status: 502, headers: cors });
      return Response.json({ ok: true, path: '/' + path }, { headers: cors });
    }

    return new Response('not found', { status: 404, headers: cors });
  },
};

const DASH_HTML = `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Statistiky</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{--mag:#E20074;--bg:#121212;--card:#1c1c1e;--line:#2d2d30;--dim:#9a9aa0}
*{box-sizing:border-box}
body{font:15px/1.5 Inter,system-ui,sans-serif;background:var(--bg);color:#f2f2f2;margin:0;padding:28px 20px;max-width:1020px;margin-inline:auto}
header{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px}
h1{font-size:1.35rem;margin:0;font-weight:800}h1 span{color:var(--mag)}
.seg{display:inline-flex;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:3px}
.seg button{background:none;border:0;color:var(--dim);font:inherit;font-weight:600;padding:6px 16px;border-radius:999px;cursor:pointer}
.seg button.on{background:var(--mag);color:#fff}
.muted{color:var(--dim);font-size:.83rem;margin:4px 0 20px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:0 0 22px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.tile b{display:block;font-size:1.9rem;font-weight:800;letter-spacing:-.5px}
.tile small{color:var(--dim)}
.tile.hl{border-color:var(--mag);box-shadow:0 0 24px rgba(226,0,116,.12)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:16px}
.card h2{font-size:.95rem;margin:0 0 12px;color:var(--mag);text-transform:uppercase;letter-spacing:.4px}
#chart{width:100%;height:170px;display:block}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:720px){.cols{grid-template-columns:1fr}}
table{border-collapse:collapse;width:100%;font-size:.92rem}
td,th{padding:7px 4px;border-bottom:1px solid var(--line);text-align:left}
th{color:var(--dim);font-weight:600;font-size:.8rem;text-transform:uppercase;letter-spacing:.4px}
td.n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
tr:last-child td{border-bottom:0}
.bar{height:7px;border-radius:4px;background:var(--mag);min-width:3px;opacity:.85}
.pulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:#2ecc71;margin-right:6px;animation:p 2s infinite}
@keyframes p{50%{opacity:.3}}
#login{max-width:360px;margin:12vh auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:30px}
#login h1{margin-bottom:18px}
#login label{display:block;font-size:.85rem;color:var(--dim);margin:12px 0 5px}
#login input{width:100%;padding:11px 14px;border-radius:10px;border:1px solid var(--line);background:#141414;color:#fff;font:inherit}
#login button{width:100%;margin-top:18px;padding:12px;border:0;border-radius:999px;background:var(--mag);color:#fff;font:inherit;font-weight:700;cursor:pointer}
#lerr{color:#ff5c8a;font-size:.85rem;margin-top:10px;display:none}
#logout{margin-left:auto;background:none;border:1px solid var(--line);color:var(--dim);border-radius:999px;padding:6px 14px;font:inherit;cursor:pointer}
[hidden]{display:none!important}
</style></head><body>

<div id="login" hidden>
  <h1>Statistiky<span style="color:var(--mag)">.</span></h1>
  <label>Uživatel</label><input id="lu" autocomplete="username">
  <label>Heslo</label><input id="lp" type="password" autocomplete="current-password">
  <button id="lbtn">Přihlásit se</button>
  <p id="lerr">Špatné jméno nebo heslo.</p>
</div>

<div id="app" hidden>
<header>
  <h1 id="title">Statistiky<span>.</span></h1>
  <div class="seg" id="days"><button data-v="7">7 dní</button><button data-v="30" class="on">30 dní</button><button data-v="90">90 dní</button></div>
  <a href="/padmin" id="padminlink" style="margin-left:auto;display:inline-block;background:var(--mag);color:#fff;border-radius:999px;padding:7px 16px;font-weight:700;text-decoration:none">Volné pozice ✎</a>
  <button id="logout" style="margin-left:0">Odhlásit</button>
</header>
<p class="muted"><span class="pulse"></span>Živě — obnovuje se každých 30 s · anonymní počty bez cookies · <span id="upd"></span></p>
<div class="tiles" id="tiles"></div>
<div class="card"><h2>Zobrazení po dnech</h2><svg id="chart" preserveAspectRatio="none"></svg><div class="muted" id="chartlab" style="display:flex;justify-content:space-between;margin:6px 0 0"></div></div>
<div class="cols">
  <div class="card"><h2>Akce návštěvníků</h2><table id="events"></table></div>
  <div class="card"><h2>Nejnavštěvovanější stránky</h2><table id="pages"></table></div>
</div>
<div class="cols">
  <div class="card"><h2>Zdroje návštěv</h2><table id="refs"></table></div>
  <div class="card"><h2>Zařízení</h2><table id="devs"></table></div>
</div>
</div>

<script>
const NAMES={rezervace:'Odeslané objednávky','objednat-klik':'Klik na „Objednat se“',tel:'Klik na telefon',mailto:'Klik na e-mail','kariera-klik':'Klik na Kariéru','pozice-klik':'Klik na volnou pozici',prihlaska:'Odeslané přihlášky (nábor)'};
const REFS={direct:'Přímá návštěva','google.com':'Google','google.cz':'Google','seznam.cz':'Seznam','bing.com':'Bing','facebook.com':'Facebook','l.facebook.com':'Facebook','instagram.com':'Instagram','l.instagram.com':'Instagram','t-mobile.cz':'T-Mobile.cz','mapy.cz':'Mapy.cz','firmy.cz':'Firmy.cz'};
const DEVS={m:'Mobil / tablet',d:'Počítač'};
const PAGES={'/':'Úvod','/prodejny/':'Prodejny','/tym/':'Tým','/album/':'Fotoalbum','/kariera/':'Kariéra','/objednat/':'Objednání','/gdpr/':'GDPR'};
let auth=null,days=30,timer=null;
try{auth=JSON.parse(localStorage.getItem('dash-auth'))}catch(e){}
const $=id=>document.getElementById(id);
function show(){
  $('login').hidden=!!auth;$('app').hidden=!auth;
  if(auth){$('title').innerHTML='Statistiky '+auth.site.charAt(0).toUpperCase()+auth.site.slice(1)+'<span>.</span>';load();clearInterval(timer);timer=setInterval(load,30000);}
}
$('lbtn').onclick=async()=>{
  const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:$('lu').value,pass:$('lp').value})});
  if(!r.ok){$('lerr').style.display='block';return}
  auth=await r.json();try{localStorage.setItem('dash-auth',JSON.stringify(auth))}catch(e){}
  show();
};
$('lp').addEventListener('keydown',e=>{if(e.key==='Enter')$('lbtn').click()});
$('logout').onclick=()=>{auth=null;try{localStorage.removeItem('dash-auth')}catch(e){};clearInterval(timer);show()};
$('days').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  [...e.currentTarget.children].forEach(x=>x.classList.toggle('on',x===b));days=+b.dataset.v;load();});
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
async function load(){
  if(!auth)return;
  const r=await fetch('/stats?site='+auth.site+'&days='+days+'&key='+encodeURIComponent(auth.key));
  if(!r.ok){$('logout').click();return}
  const data=(await r.json()).reverse();
  const views=data.reduce((a,d)=>a+sum(d.v),0), today=data[data.length-1]?sum(data[data.length-1].v):0;
  const uniq=data.reduce((a,d)=>a+Object.keys(d.u||{}).length,0);
  const ev={},pg={},rf={},dv={};
  data.forEach(d=>{for(const[k,n]of Object.entries(d.e))ev[k]=(ev[k]||0)+n;for(const[k,n]of Object.entries(d.v))pg[k]=(pg[k]||0)+n;
    for(const[k,n]of Object.entries(d.r||{}))rf[k]=(rf[k]||0)+n;for(const[k,n]of Object.entries(d.d||{}))dv[k]=(dv[k]||0)+n;});
  const conv=uniq?Math.round((ev.rezervace||0)/uniq*100):0;
  $('tiles').innerHTML=
    '<div class="tile hl"><b>'+today+'</b><small>zobrazení dnes</small></div>'+
    '<div class="tile"><b>'+views+'</b><small>zobrazení za '+days+' dní</small></div>'+
    '<div class="tile"><b>'+uniq+'</b><small>návštěvníků za '+days+' dní</small></div>'+
    '<div class="tile"><b>'+(ev.rezervace||0)+'</b><small>odeslaných objednávek</small></div>'+
    '<div class="tile"><b>'+((ev['objednat-klik']||0)+(ev.tel||0)+(ev.mailto||0))+'</b><small>kliků na kontakty</small></div>'+
    '<div class="tile"><b>'+conv+' %</b><small>návštěvníků odešle objednávku</small></div>';
  const svg=$('chart'),W=1000,H=170,n=data.length,max=Math.max(1,...data.map(d=>sum(d.v)));
  const bw=W/n;
  svg.setAttribute('viewBox','0 0 '+W+' '+H);
  svg.innerHTML=data.map((d,i)=>{const h=Math.round(sum(d.v)/max*(H-24));
    return '<rect x="'+(i*bw+1).toFixed(1)+'" y="'+(H-h)+'" width="'+Math.max(1,bw-2).toFixed(1)+'" height="'+h+'" rx="2" fill="#E20074" opacity="'+(i===n-1?'1':'0.55')+'"><title>'+d.date+': '+sum(d.v)+'</title></rect>';}).join('');
  $('chartlab').innerHTML='<span>'+data[0].date.slice(5)+'</span><span>max '+max+' / den</span><span>'+data[n-1].date.slice(5)+'</span>';
  const label=(k,names)=>{if(names&&names[k])return names[k];const i=k.indexOf(':');
    if(i>0){const base=names&&names[k.slice(0,i)]?names[k.slice(0,i)]:k.slice(0,i);
      const suf=k.slice(i+1).replace(/-/g,' ');return base+' — '+suf.charAt(0).toUpperCase()+suf.slice(1);}return k;};
  const rows=(obj,names)=>{const es=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,40);const m=Math.max(1,...es.map(e=>e[1]));
    return es.map(([k,v])=>'<tr><td>'+label(k,names)+'</td><td style="width:34%"><div class="bar" style="width:'+Math.round(v/m*100)+'%"></div></td><td class="n">'+v+'</td></tr>').join('');};
  $('events').innerHTML=rows(ev,NAMES)||'<tr><td class="muted">zatím žádné akce</td></tr>';
  $('pages').innerHTML=rows(pg,PAGES)||'<tr><td class="muted">zatím žádná data</td></tr>';
  $('refs').innerHTML=rows(rf,REFS)||'<tr><td class="muted">zatím žádná data (sbírá se od nasazení)</td></tr>';
  $('devs').innerHTML=rows(dv,DEVS)||'<tr><td class="muted">zatím žádná data (sbírá se od nasazení)</td></tr>';
  $('upd').textContent='aktualizováno '+new Date().toLocaleTimeString('cs');
}
show();
</script></body></html>
`;

const PADMIN_HTML = `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Administrace webu</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{--mag:#E20074;--bg:#121212;--card:#1c1c1e;--line:#2d2d30;--dim:#9a9aa0}
*{box-sizing:border-box}
body{font:15px/1.5 Inter,system-ui,sans-serif;background:var(--bg);color:#f2f2f2;margin:0;padding:28px 20px;max-width:820px;margin-inline:auto}
h1{font-size:1.35rem;margin:0;font-weight:800}h1 span{color:var(--mag)}
header{display:flex;align-items:center;gap:14px;margin-bottom:4px}
.muted{color:var(--dim);font-size:.85rem;margin:6px 0 20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:14px}
label{display:block;font-size:.8rem;color:var(--dim);margin:10px 0 4px}
input,select,textarea{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:#141414;color:#fff;font:inherit}
textarea{min-height:90px}
button{border:0;border-radius:999px;background:var(--mag);color:#fff;font:inherit;font-weight:700;cursor:pointer;padding:10px 20px}
button.ghost{background:none;border:1px solid var(--line);color:var(--dim)}
.row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
@media(max-width:640px){.row{grid-template-columns:1fr}}
.bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0}
#msg{font-size:.9rem}
#msg.ok{color:#2ecc71}#msg.err{color:#ff5c8a}
#login{max-width:360px;margin:12vh auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:30px}
#logout{margin-left:auto;background:none;border:1px solid var(--line);color:var(--dim);padding:6px 14px}
[hidden]{display:none!important}
.seg{display:inline-flex;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:3px;margin:0 0 16px}
.seg button{background:none;border:0;color:var(--dim);font:inherit;font-weight:600;padding:6px 16px;border-radius:999px}
.seg button.on{background:var(--mag);color:#fff}
.trow{display:flex;gap:12px;align-items:center}
.trow img{width:56px;height:56px;object-fit:cover;border-radius:50%;background:#333;flex:none}
.trow .grow{flex:1}
input[type=file]{padding:7px;background:none;border:1px dashed var(--line)}
h2.sec{font-size:.95rem;color:var(--mag);text-transform:uppercase;letter-spacing:.4px;margin:22px 0 10px}
</style></head><body>

<div id="login" hidden>
  <h1>Nábor<span>.</span></h1>
  <label>Uživatel</label><input id="lu" autocomplete="username">
  <label>Heslo</label><input id="lp" type="password" autocomplete="current-password">
  <p style="margin-top:18px"><button id="lbtn" style="width:100%">Přihlásit se</button></p>
  <p id="lerr" style="color:#ff5c8a;font-size:.85rem;display:none">Špatné jméno nebo heslo.</p>
</div>

<div id="app" hidden>
<header><h1 id="title">Administrace<span>.</span></h1>
  <a href="/dash" style="margin-left:auto;color:var(--dim);border:1px solid var(--line);border-radius:999px;padding:6px 14px;text-decoration:none;font-size:.9rem">← Statistiky</a>
  <button id="logout" style="margin-left:0">Odhlásit</button></header>
<p class="muted">Změny se po uložení projeví na webu zhruba do 2 minut.</p>
<div class="seg" id="tabs"><button data-t="pozice" class="on">Volné pozice</button><button data-t="texty">Texty</button><button data-t="fotky">Fotky</button></div>

<div id="tab-pozice">
<p class="muted">Prázdný text inzerátu = použije se přednastavený text s benefity.</p>
<div id="list"></div>
<div class="bar">
  <button class="ghost" id="add">+ Přidat pozici</button>
  <button id="save">Uložit změny</button>
  <span id="msg"></span>
</div>
</div>

<div id="tab-texty" hidden>
<p class="muted">Vyberte část webu a upravte texty. Nic tu nerozbijete — mění se jen slova, ne vzhled.</p>
<div class="bar" style="margin-top:0"><select id="txfile" style="max-width:280px">
  <option value="home">Úvodní stránka</option>
  <option value="kariera">Kariéra</option>
  <option value="objednat">Objednání návštěvy</option>
  <option value="site">Základní údaje a patička</option>
</select></div>
<div id="txlist"></div>
<div class="bar"><button id="txsave">Uložit texty</button><span id="txmsg"></span></div>
</div>

<div id="tab-fotky" hidden>
<h2 class="sec">Tým</h2>
<p class="muted">Fotku člena vyměníte výběrem souboru — nahraje se hned, pak dejte „Uložit tým“. Fotky se automaticky zmenší.</p>
<div id="tymlist"></div>
<div class="bar"><button class="ghost" id="tymadd">+ Přidat člena</button><button id="tymsave">Uložit tým</button><span id="tymmsg"></span></div>

<h2 class="sec">Fotoalbum akcí</h2>
<div id="alblist"></div>
<div class="card">
  <label>Název nové akce (např. „Letní akce – Sázava 2027“)</label><input id="albcap">
  <label>Fotky z akce (lze vybrat víc najednou)</label><input id="albfiles" type="file" accept="image/*" multiple>
  <p style="margin:12px 0 0"><button id="albup">Nahrát novou akci</button></p>
</div>
<div class="bar"><button id="albsave">Uložit názvy akcí</button><span id="albmsg"></span></div>
</div>
</div>

<script>
var LOC={asistel:['Rychnov nad Kněžnou','Benešov','Vrchlabí','Turnov','Třebíč','Jindřichův Hradec','Trutnov','Náchod','Litomyšl','Ústí nad Orlicí','Vedení firmy'],
alerta:['Jablonec nad Nisou','Mladá Boleslav','Děčín','Teplice','Litoměřice','Praha-Dejvice','Praha-Hostivař','Písek','Klatovy','Vedení firmy']};
var auth=null,items=[];
try{auth=JSON.parse(localStorage.getItem('dash-auth'))}catch(e){}
function $(id){return document.getElementById(id)}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function render(){
  var out='';
  for(var i=0;i<items.length;i++){var p=items[i];
    var opts=LOC[auth.site].map(function(m){return '<option'+(m===p.misto?' selected':'')+'>'+esc(m)+'</option>'}).join('');
    out+='<div class="card" data-i="'+i+'"><div class="row">'+
      '<div><label>Název pozice</label><input class="f-title" value="'+esc(p.title)+'"></div>'+
      '<div><label>Lokace</label><select class="f-misto">'+opts+'</select></div>'+
      '<div><label>Úvazek</label><input class="f-typ" value="'+esc(p.typ)+'"></div></div>'+
      '<label>Text inzerátu (nepovinné)</label><textarea class="f-text" placeholder="Prázdné = na webu se zobrazí přednastavený inzerát s benefity a mzdou. Vyplňte jen, když chcete vlastní text.">'+esc(p.text||'')+'</textarea>'+
      '<p style="margin:12px 0 0"><button class="ghost del">Smazat pozici</button></p></div>';
  }
  $('list').innerHTML=out||'<p class="muted">Zatím žádné pozice — přidejte první tlačítkem níže.</p>';
}
function collect(){
  var cards=document.querySelectorAll('#list .card');items=[];
  for(var i=0;i<cards.length;i++){var c=cards[i];
    items.push({title:c.querySelector('.f-title').value,misto:c.querySelector('.f-misto').value,
      typ:c.querySelector('.f-typ').value,text:c.querySelector('.f-text').value});}
}
function show(){
  $('login').hidden=!!auth;$('app').hidden=!auth;
  if(!auth)return;
  $('title').innerHTML='Administrace '+auth.site.charAt(0).toUpperCase()+auth.site.slice(1)+'<span>.</span>';
  fetch('/pozice?site='+auth.site+'&key='+encodeURIComponent(auth.key))
    .then(function(r){if(!r.ok)throw 0;return r.json()})
    .then(function(d){items=d.items;render()})
    .catch(function(){$('msg').className='err';$('msg').textContent='Načtení se nepovedlo — zkuste obnovit stránku.'});
}
$('lbtn').onclick=function(){
  fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:$('lu').value,pass:$('lp').value})})
    .then(function(r){if(!r.ok)throw 0;return r.json()})
    .then(function(a){auth=a;try{localStorage.setItem('dash-auth',JSON.stringify(a))}catch(e){};show()})
    .catch(function(){$('lerr').style.display='block'});
};
$('lp').addEventListener('keydown',function(e){if(e.key==='Enter')$('lbtn').click()});
$('logout').onclick=function(){auth=null;try{localStorage.removeItem('dash-auth')}catch(e){};show()};
$('add').onclick=function(){collect();items.push({title:'Prodejní konzultant/ka',misto:LOC[auth.site][0],typ:'Plný úvazek',text:''});render()};
$('list').addEventListener('click',function(e){
  if(!e.target.classList.contains('del'))return;
  collect();items.splice(+e.target.closest('.card').dataset.i,1);render();
});
$('save').onclick=function(){
  collect();$('msg').className='';$('msg').textContent='Ukládám…';
  fetch('/pozice?site='+auth.site+'&key='+encodeURIComponent(auth.key),{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items})})
    .then(function(r){if(!r.ok)throw 0;return r.json()})
    .then(function(){$('msg').className='ok';$('msg').textContent='Uloženo ✓ Web se obnoví do pár minut.'})
    .catch(function(){$('msg').className='err';$('msg').textContent='Uložení se nepovedlo. Zkuste to znovu.'});
};

// ---------- zalozky ----------
var SITEURL={asistel:'https://www.asistel.cz',alerta:'https://www.alerta.cz'};
var loaded={};
$('tabs').addEventListener('click',function(e){
  var b=e.target.closest('button');if(!b)return;
  var btns=$('tabs').children;for(var i=0;i<btns.length;i++)btns[i].classList.toggle('on',btns[i]===b);
  ['pozice','texty','fotky'].forEach(function(t){$('tab-'+t).hidden=t!==b.dataset.t});
  if(b.dataset.t==='texty'&&!loaded.texty){loaded.texty=1;loadTexty()}
  if(b.dataset.t==='fotky'&&!loaded.fotky){loaded.fotky=1;loadTym();loadAlb()}
});
function getData(file){return fetch('/data?site='+auth.site+'&key='+encodeURIComponent(auth.key)+'&file='+file+'&t='+Date.now()).then(function(r){if(!r.ok)throw 0;return r.json()})}
function postData(file,data){return fetch('/data?site='+auth.site+'&key='+encodeURIComponent(auth.key)+'&file='+file,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:data})}).then(function(r){if(!r.ok)throw 0})}
function slug2(s){return String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)}
function saveMsg(el,p){el.className='';el.textContent='Ukládám…';p.then(function(){el.className='ok';el.textContent='Uloženo ✓ Web se obnoví do pár minut.'}).catch(function(){el.className='err';el.textContent='Uložení se nepovedlo. Zkuste to znovu.'})}

// ---------- texty ----------
var txData=null;
function walk(o,pre,out){
  for(var k in o){if(!Object.prototype.hasOwnProperty.call(o,k))continue;
    var v=o[k],p=pre.concat([k]);
    if(typeof v==='string')out.push({p:p,v:v});
    else if(v&&typeof v==='object')walk(v,p,out);}
}
function loadTexty(){
  $('txlist').innerHTML='<p class="muted">Načítám…</p>';
  getData($('txfile').value).then(function(d){
    txData=d;var out=[],fields=[];walk(d,[],fields);
    for(var i=0;i<fields.length;i++){var f=fields[i];
      var lab=f.p.filter(function(x){return !/^\\d+$/.test(x)}).join(' › ')+(/^\\d+$/.test(f.p[f.p.length-1])?' ('+(+f.p[f.p.length-1]+1)+')':'');
      var long=f.v.length>70||f.v.indexOf('\\n')>-1;
      out+='<div><label>'+esc(lab)+'</label>'+(long
        ?'<textarea class="tx" data-p="'+esc(JSON.stringify(f.p))+'">'+esc(f.v)+'</textarea>'
        :'<input class="tx" data-p="'+esc(JSON.stringify(f.p))+'" value="'+esc(f.v)+'">')+'</div>';}
    $('txlist').innerHTML='<div class="card">'+(out||'<p class="muted">Tento soubor nemá žádné texty.</p>')+'</div>';
  }).catch(function(){$('txlist').innerHTML='<p class="muted">Načtení se nepovedlo.</p>'});
}
$('txfile').onchange=loadTexty;
$('txsave').onclick=function(){
  var els=document.querySelectorAll('#txlist .tx');
  for(var i=0;i<els.length;i++){var p=JSON.parse(els[i].dataset.p),o=txData;
    for(var j=0;j<p.length-1;j++)o=o[p[j]];
    o[p[p.length-1]]=els[i].value;}
  saveMsg($('txmsg'),postData($('txfile').value,txData));
};

// ---------- fotky: zmenseni v prohlizeci ----------
function resize(file,max){
  return new Promise(function(res,rej){
    var img=new Image();img.onerror=rej;
    img.onload=function(){
      var s=Math.min(1,max/Math.max(img.width,img.height));
      var c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      res(c.toDataURL('image/jpeg',0.82).split(',')[1]);
    };
    img.src=URL.createObjectURL(file);
  });
}
function upload(path,b64){
  return fetch('/foto?site='+auth.site+'&key='+encodeURIComponent(auth.key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:path,b64:b64})}).then(function(r){if(!r.ok)throw 0;return r.json()})
}

// ---------- fotky: tym ----------
var tymData=null;
function renderTym(){
  var out='';
  for(var i=0;i<tymData.items.length;i++){var m=tymData.items[i];
    out+='<div class="card trow" data-i="'+i+'">'+
      '<img src="'+esc(m.photo?SITEURL[auth.site]+m.photo:'')+'" alt="">'+
      '<div class="grow"><label>Jméno</label><input class="t-name" value="'+esc(m.name||'')+'">'+
      '<label>Role / prodejna</label><input class="t-role" value="'+esc(m.role||'')+'">'+
      '<label>Nová fotka (nepovinné)</label><input type="file" accept="image/*" class="t-file">'+
      '<p style="margin:10px 0 0"><button class="ghost t-del">Smazat člena</button></p></div></div>';}
  $('tymlist').innerHTML=out||'<p class="muted">Zatím nikdo.</p>';
}
function collectTym(){
  var cards=document.querySelectorAll('#tymlist .card');
  for(var i=0;i<cards.length;i++){var it=tymData.items[+cards[i].dataset.i];
    it.name=cards[i].querySelector('.t-name').value;it.role=cards[i].querySelector('.t-role').value;}
}
function loadTym(){
  getData('team').then(function(d){tymData=d;renderTym()})
    .catch(function(){$('tymlist').innerHTML='<p class="muted">Načtení se nepovedlo.</p>'});
}
$('tymlist').addEventListener('change',function(e){
  if(!e.target.classList.contains('t-file')||!e.target.files[0])return;
  collectTym();
  var card=e.target.closest('.card'),i=+card.dataset.i;
  $('tymmsg').className='';$('tymmsg').textContent='Nahrávám fotku…';
  resize(e.target.files[0],900).then(function(b64){
    var path='uploads/zamestnanci/'+(slug2(tymData.items[i].name)||'clen')+'-'+Date.now()+'.jpg';
    return upload(path,b64);
  }).then(function(r){
    tymData.items[i].photo=r.path;card.querySelector('img').src=SITEURL[auth.site]+r.path;
    $('tymmsg').className='ok';$('tymmsg').textContent='Fotka nahrána ✓ Nezapomeňte „Uložit tým“.';
  }).catch(function(){$('tymmsg').className='err';$('tymmsg').textContent='Nahrání fotky se nepovedlo.'});
});
$('tymlist').addEventListener('click',function(e){
  if(!e.target.classList.contains('t-del'))return;
  collectTym();tymData.items.splice(+e.target.closest('.card').dataset.i,1);renderTym();
});
$('tymadd').onclick=function(){collectTym();tymData.items.push({name:'',role:'',photo:''});renderTym()};
$('tymsave').onclick=function(){collectTym();saveMsg($('tymmsg'),postData('team',tymData))};

// ---------- fotky: album ----------
var albData=null;
function renderAlb(){
  var out='';
  for(var i=0;i<albData.items.length;i++){var a=albData.items[i];
    out+='<div class="card" data-i="'+i+'"><label>Název akce</label><input class="a-cap" value="'+esc(a.caption||'')+'">'+
      '<p style="margin:10px 0 0" class="muted">složka: '+esc(a.slug)+' · <button class="ghost a-del" style="padding:4px 12px">Odebrat z webu</button></p></div>';}
  $('alblist').innerHTML=out||'<p class="muted">Zatím žádné akce.</p>';
}
function collectAlb(){
  var cards=document.querySelectorAll('#alblist .card');
  for(var i=0;i<cards.length;i++)albData.items[+cards[i].dataset.i].caption=cards[i].querySelector('.a-cap').value;
}
function loadAlb(){
  getData('album').then(function(d){albData=d;renderAlb()})
    .catch(function(){$('alblist').innerHTML='<p class="muted">Načtení se nepovedlo.</p>'});
}
$('alblist').addEventListener('click',function(e){
  if(!e.target.classList.contains('a-del'))return;
  collectAlb();albData.items.splice(+e.target.closest('.card').dataset.i,1);renderAlb();
});
$('albsave').onclick=function(){collectAlb();saveMsg($('albmsg'),postData('album',albData))};
$('albup').onclick=function(){
  var cap=$('albcap').value.trim(),files=$('albfiles').files;
  if(!cap||!files.length){$('albmsg').className='err';$('albmsg').textContent='Vyplňte název akce a vyberte fotky.';return}
  var sl=slug2(cap);collectAlb();
  var done=0;$('albmsg').className='';
  var chain=Promise.resolve();
  for(var i=0;i<files.length;i++)(function(i){
    chain=chain.then(function(){return resize(files[i],1600)}).then(function(b64){
      return upload('album/'+sl+'/'+(i+1)+'.jpg',b64);
    }).then(function(){done++;$('albmsg').textContent='Nahrávám… '+done+'/'+files.length});
  })(i);
  chain.then(function(){
    albData.items.unshift({slug:sl,caption:cap});
    return postData('album',albData);
  }).then(function(){
    $('albmsg').className='ok';$('albmsg').textContent='Akce nahrána ✓ Web se obnoví do pár minut.';
    $('albcap').value='';$('albfiles').value='';renderAlb();
  }).catch(function(){$('albmsg').className='err';$('albmsg').textContent='Nahrání se nepovedlo. Zkuste to znovu.'});
};
show();
</script></body></html>
`;
