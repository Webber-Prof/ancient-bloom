/* ═══════════════════════════════════════════════════════════════
   Ancient Bloom — shop engine.

   YOU DO NOT NEED TO EDIT THIS FILE.
   Products live in  data/products.csv
   Settings live in  data/settings.csv
   Both open in Excel. See README.md.
   ═══════════════════════════════════════════════════════════════ */

const S = {};            // settings
let PRODUCTS = [];       // products
let CART = [];           // [{id,name,option,price,qty}]
let FILTER = 'All';

/* ── CSV parsing ───────────────────────────────────────────── */
function parseCSV(text){
  text = text.replace(/^\uFEFF/, '');           // strip Excel's byte-order mark
  const rows = []; let row = [], field = '', quoted = false;
  for(let i = 0; i < text.length; i++){
    const c = text[i];
    if(quoted){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; } else quoted = false;
      } else field += c;
    } else {
      if(c === '"') quoted = true;
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else if(c !== '\r') field += c;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

function toObjects(rows){
  if(!rows.length) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(r => {
    const o = {};
    head.forEach((h, i) => o[h] = (r[i] || '').trim());
    return o;
  });
}

async function loadCSV(path){
  const res = await fetch(path + '?v=' + Date.now());
  if(!res.ok) throw new Error(path + ' returned ' + res.status);
  return toObjects(parseCSV(await res.text()));
}

/* ── helpers ───────────────────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => (S.currency || '₹') + Number(n).toLocaleString('en-IN');
const pipe = s => (s || '').split('|').map(x => x.trim()).filter(Boolean);

/* An option can carry a price change: "50 ml (+700)" or "Small (-100)" */
function optionDelta(opt){
  const m = (opt || '').match(/\(([+-])\s*[₹$]?\s*([\d,]+)\)/);
  return m ? (m[1] === '-' ? -1 : 1) * Number(m[2].replace(/,/g, '')) : 0;
}

function banner(kind, html){
  const el = document.createElement('div');
  el.className = 'alert alert--' + kind;
  el.innerHTML = html;
  document.body.prepend(el);
}

/* ── boot ──────────────────────────────────────────────────── */
async function boot(){
  try{
    const [set, prod] = await Promise.all([
      loadCSV('data/settings.csv'),
      loadCSV('data/products.csv')
    ]);
    set.forEach(r => S[r.key] = r.value);
    PRODUCTS = prod
      .filter(p => p.id && (p.status || '').toLowerCase() !== 'hidden')
      .sort((a, b) => (Number(a.sort) || 99) - (Number(b.sort) || 99));
  }catch(err){
    banner('err',
      '<b>The product list could not load.</b> ' +
      'If you opened this file by double-clicking it, that is why — browsers block ' +
      'local file reads. Push it to GitHub Pages, or run a local preview server. ' +
      '<span style="opacity:.7">(' + esc(err.message) + ')</span>');
    return;
  }

  if(!S.orders_url){
    console.warn('No orders_url set in settings.csv — orders will go to WhatsApp only.');
  }

  paintSettings();
  paintBand();
  paintFilters();
  paintShelf();
  wireCart();
  reveal();
}

/* ── settings into the page ────────────────────────────────── */
function paintSettings(){
  document.title = S.brand_name + ' — ' + (S.tagline || '');
  $$('[data-s]').forEach(el => {
    const v = S[el.dataset.s];
    if(v) el.textContent = v;
  });
  const ig = 'https://www.instagram.com/' + (S.instagram || '');
  $$('[data-ig]').forEach(a => { a.href = ig; a.textContent = '@' + S.instagram; });
  $$('[data-mail]').forEach(a => { a.href = 'mailto:' + S.email; a.textContent = S.email; });
  $('#yr').textContent = new Date().getFullYear();
}

/* ── batch band ────────────────────────────────────────────── */
function paintBand(){
  const poured  = Number(S.batch_jars) || 0;
  const claimed = Math.min(Number(S.batch_claimed) || 0, poured);
  const t = $('#tally');
  for(let i = 0; i < poured; i++){
    const k = document.createElement('i');
    if(i < claimed) k.className = 'g';
    t.appendChild(k);
  }
  $('#tallyNote').innerHTML = '<b>' + (poured - claimed) + ' left</b> of ' + poured;
}

/* ── filters ───────────────────────────────────────────────── */
function paintFilters(){
  const cats = ['All', ...new Set(PRODUCTS.map(p => p.category).filter(Boolean))];
  $('#filters').innerHTML = cats.map(c =>
    `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === FILTER}">${esc(c)}</button>`
  ).join('');
  $('#filters').onclick = e => {
    const b = e.target.closest('[data-cat]');
    if(!b) return;
    FILTER = b.dataset.cat;
    paintFilters();
    paintShelf();
  };
}

/* ── the shelf ─────────────────────────────────────────────── */
function paintShelf(){
  const list = PRODUCTS.filter(p => FILTER === 'All' || p.category === FILTER);
  $('#shelf').innerHTML = list.map(card).join('');
  $('#shelf').onclick = e => {
    const b = e.target.closest('[data-add]');
    if(!b) return;
    const p = PRODUCTS.find(x => x.id === b.dataset.add);
    const sel = $(`select[data-opt="${p.id}"]`);
    addToCart(p, sel ? sel.value : '');
  };
}

function card(p){
  const st  = (p.status || 'available').toLowerCase();
  const out = st === 'sold out' || st === 'soldout';
  const pre = st === 'preorder' || st === 'pre-order';
  const opts = pipe(p.options);

  const flag = out ? '<span class="flag flag--out">Sold out</span>'
             : pre ? '<span class="flag flag--pre">Pre-order</span>' : '';

  const shot = p.image
    ? `<img src="images/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"
           onerror="this.replaceWith(Object.assign(document.createElement('span'),
             {className:'shot__hint',textContent:'${esc(p.image)} not found in images/'}))">`
    : `<span class="shot__hint">Photo — images/${esc(p.id)}.jpg</span>`;

  const optSel = opts.length
    ? `<select data-opt="${esc(p.id)}" aria-label="Option for ${esc(p.name)}">
         ${opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
       </select>` : '';

  return `<article class="item">
    <div class="shot">${flag}${shot}</div>
    <div class="item__head">
      <h3>${esc(p.name)}</h3>
      <span class="item__price">${money(p.price)}</span>
    </div>
    <span class="item__size">${esc(p.category || '')}${p.size ? ' · ' + esc(p.size) : ''}</span>
    <p>${esc(p.description || p.short || '')}</p>
    <div class="item__foot">
      ${pipe(p.ingredients).length
        ? `<div class="item__ing">${pipe(p.ingredients)
            .map(i => `<b>${esc(i)}</b>`).join('<span>·</span>')}</div>` : ''}
      <div class="item__buy">
        ${optSel}
        <button class="btn btn--sm ${opts.length ? '' : 'btn--full'}"
                data-add="${esc(p.id)}" ${out ? 'disabled' : ''}>
          ${out ? 'Sold out' : pre ? 'Pre-order' : 'Add'}
        </button>
      </div>
    </div>
  </article>`;
}

/* ── cart ──────────────────────────────────────────────────── */
function addToCart(p, option){
  const price = Number(p.price) + optionDelta(option);
  const key = p.id + '|' + option;
  const found = CART.find(l => l.key === key);
  if(found) found.qty++;
  else CART.push({ key, id: p.id, name: p.name, option, price, qty: 1 });
  paintCart();
  openCart(true);
}

function cartCount(){ return CART.reduce((n, l) => n + l.qty, 0); }
function subtotal(){ return CART.reduce((n, l) => n + l.price * l.qty, 0); }
function shipping(){
  if(!CART.length) return 0;
  const free = Number(S.free_shipping_over) || 0;
  if(free && subtotal() >= free) return 0;
  return Number(S.ship_flat_india) || 0;
}

function paintCart(){
  const n = cartCount();
  $('#cartCount').textContent = n;
  $('#cartCount').style.display = n ? 'grid' : 'none';

  if(!CART.length){
    $('#cartBody').innerHTML = '<p class="empty">Nothing here yet.</p>';
    $('#cartFoot').innerHTML = '';
    return;
  }

  $('#cartBody').innerHTML = CART.map((l, i) => `
    <div class="line">
      <div class="line__t">
        <div class="line__n">${esc(l.name)}</div>
        ${l.option ? `<div class="line__o">${esc(l.option)}</div>` : ''}
        <div class="qty">
          <button data-q="${i}" data-d="-1" aria-label="One fewer">−</button>
          <span>${l.qty}</span>
          <button data-q="${i}" data-d="1" aria-label="One more">+</button>
        </div>
      </div>
      <div class="line__p">${money(l.price * l.qty)}</div>
    </div>`).join('');

  const ship = shipping();
  $('#cartFoot').innerHTML = `
    <div class="totals">
      <div><span>Subtotal</span><span>${money(subtotal())}</span></div>
      <div><span>Shipping (India)</span><span>${ship ? money(ship) : 'Free'}</span></div>
      <div class="grand"><span>Total</span><span>${money(subtotal() + ship)}</span></div>
    </div>
    <p class="note">International shipping is quoted by weight after you order.</p>
    <button class="btn btn--full btn--wide" id="toCheckout" style="margin-top:.9rem">Checkout</button>`;

  $('#cartBody').onclick = e => {
    const b = e.target.closest('[data-q]');
    if(!b) return;
    const l = CART[Number(b.dataset.q)];
    l.qty += Number(b.dataset.d);
    if(l.qty < 1) CART = CART.filter(x => x !== l);
    paintCart();
  };
  $('#toCheckout').onclick = paintCheckout;
}

function wireCart(){
  $('#openCart').onclick = () => openCart(true);
  $('#closeCart').onclick = () => openCart(false);
  $('#scrim').onclick = () => openCart(false);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') openCart(false); });
  paintCart();
}

function openCart(on){
  $('#drawer').classList.toggle('on', on);
  $('#scrim').classList.toggle('on', on);
  document.body.style.overflow = on ? 'hidden' : '';
  if(!on && $('#checkoutForm')) paintCart();
}

/* ── checkout ──────────────────────────────────────────────── */
function paintCheckout(){
  $('#drawerTitle').textContent = 'Your details';
  $('#cartBody').innerHTML = `
    <form id="checkoutForm" novalidate>
      <div class="field"><label for="f-name">Name</label><input id="f-name" required></div>
      <div class="field field--row">
        <div><label for="f-phone">Phone / WhatsApp</label><input id="f-phone" inputmode="tel" required></div>
        <div><label for="f-country">Country</label><input id="f-country" value="India" required></div>
      </div>
      <div class="field"><label for="f-email">Email</label><input id="f-email" type="email"></div>
      <div class="field"><label for="f-addr">Full address with pincode</label><textarea id="f-addr" required></textarea></div>
      <div class="field"><label for="f-note">Anything we should know</label><textarea id="f-note" placeholder="A gift, sensitive skin, a date you need it by…"></textarea></div>
      <div id="formErr"></div>
    </form>`;

  $('#cartFoot').innerHTML = `
    <div class="totals"><div class="grand"><span>Total</span><span>${money(subtotal() + shipping())}</span></div></div>
    <button class="btn btn--full btn--wide" id="placeOrder" style="margin-top:.9rem">Place order</button>
    <button class="btn btn--ghost btn--full btn--sm" id="backToCart" style="margin-top:.5rem">Back to bag</button>
    <p class="note">Nothing is charged now. We confirm stock and shipping, then send a payment link.</p>`;

  $('#backToCart').onclick = () => { $('#drawerTitle').textContent = 'Your bag'; paintCart(); };
  $('#placeOrder').onclick = submitOrder;
}

function orderId(){
  const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let o = '';
  for(let i = 0; i < 6; i++) o += s[Math.floor(Math.random() * s.length)];
  return 'AB-' + o;
}

function itemsText(){
  return CART.map(l =>
    `${l.qty} × ${l.name}${l.option ? ' (' + l.option + ')' : ''} — ${money(l.price * l.qty)}`
  ).join('\n');
}

async function submitOrder(){
  const v = id => ($('#' + id).value || '').trim();
  const name = v('f-name'), phone = v('f-phone'), country = v('f-country'), addr = v('f-addr');

  if(!name || !phone || !addr){
    $('#formErr').innerHTML = '<p class="err">Name, phone and address are needed.</p>';
    return;
  }

  const btn = $('#placeOrder');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  const id = orderId();
  const total = subtotal() + shipping();
  const payload = {
    id, name, phone, country, address: addr,
    email: v('f-email'), notes: v('f-note'),
    items: itemsText(),
    subtotal: subtotal(), shipping: shipping(), total,
    brand: S.brand_name, batch: S.batch_number,
    placed: new Date().toISOString()
  };

  let sent = false;
  if(S.orders_url){
    try{
      const fd = new FormData();
      Object.entries(payload).forEach(([k, val]) => fd.append(k, val));
      await fetch(S.orders_url, { method: 'POST', body: fd, mode: 'no-cors' });
      sent = true;
    }catch(err){
      console.error('Order POST failed', err);
    }
  }

  const wa = 'https://wa.me/' + S.whatsapp + '?text=' + encodeURIComponent(
    `Hello ${S.brand_name} — order ${id}\n\n${itemsText()}\n\nTotal: ${money(total)}\n\n` +
    `${name}\n${phone}\n${country}\n${addr}` + (payload.notes ? `\n\nNotes: ${payload.notes}` : '')
  );

  $('#drawerTitle').textContent = 'Order placed';
  $('#cartBody').innerHTML = `
    <div class="done">
      <p style="margin-bottom:0">Thank you, ${esc(name)}. Your order number is</p>
      <div class="done__id">${id}</div>
      <p style="font-size:.92rem;color:var(--ink-soft)">
        ${sent ? 'We have it, and we will message you on WhatsApp to confirm stock and shipping.'
               : 'Please send this on WhatsApp so we receive it.'}
        Keep the number — you can check it any time on the tracking page.
      </p>
      <a class="btn btn--wide btn--full" href="${wa}" target="_blank" rel="noopener"
         style="margin-top:1rem">${sent ? 'Also confirm on WhatsApp' : 'Send on WhatsApp'}</a>
      <a class="btn btn--ghost btn--full btn--sm" href="track.html" style="margin-top:.5rem">Track this order</a>
    </div>`;
  $('#cartFoot').innerHTML = '';
  CART = [];
  $('#cartCount').style.display = 'none';
}

/* ── scroll reveal ─────────────────────────────────────────── */
function reveal(){
  const items = $$('.rv');
  if(!('IntersectionObserver' in window) ||
     matchMedia('(prefers-reduced-motion: reduce)').matches){
    items.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  items.forEach(el => io.observe(el));
}

boot();
