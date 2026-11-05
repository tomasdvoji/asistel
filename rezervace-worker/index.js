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
      if (!env.GH_TOKEN) return new Response('GH_TOKEN neni nastaveny (wrangler secret put GH_TOKEN)', { status: 503, headers: cors });
      const REPOS = { alerta: 'tomasdvoji/Alerta1', asistel: 'tomasdvoji/asistel' };
      const api = 'https://api.github.com/repos/' + REPOS[site] + '/contents/src/data/editable/pozice.json';
      const gh = { Authorization: 'Bearer ' + env.GH_TOKEN, 'User-Agent': 'pozice-admin', Accept: 'application/vnd.github+json' };
      if (req.method === 'GET') {
        const r = await fetch(api, { headers: gh });
        if (!r.ok) return new Response('github ' + r.status, { status: 502, headers: cors });
        const j = await r.json();
        const txt = new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
        return Response.json({ items: JSON.parse(txt).items || [] }, { headers: cors });
      }
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
  <button id="logout">Odhlásit</button>
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
<title>Nábor — volné pozice</title>
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
</style></head><body>

<div id="login" hidden>
  <h1>Nábor<span>.</span></h1>
  <label>Uživatel</label><input id="lu" autocomplete="username">
  <label>Heslo</label><input id="lp" type="password" autocomplete="current-password">
  <p style="margin-top:18px"><button id="lbtn" style="width:100%">Přihlásit se</button></p>
  <p id="lerr" style="color:#ff5c8a;font-size:.85rem;display:none">Špatné jméno nebo heslo.</p>
</div>

<div id="app" hidden>
<header><h1 id="title">Volné pozice<span>.</span></h1><button id="logout">Odhlásit</button></header>
<p class="muted">Změny se po uložení projeví na webu zhruba do 2 minut. Prázdný text inzerátu = použije se přednastavený text s benefity.</p>
<div id="list"></div>
<div class="bar">
  <button class="ghost" id="add">+ Přidat pozici</button>
  <button id="save">Uložit změny</button>
  <span id="msg"></span>
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
      '<label>Text inzerátu (nepovinné)</label><textarea class="f-text">'+esc(p.text||'')+'</textarea>'+
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
  $('title').innerHTML='Volné pozice '+auth.site.charAt(0).toUpperCase()+auth.site.slice(1)+'<span>.</span>';
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
show();
</script></body></html>
`;
