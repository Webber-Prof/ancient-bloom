/* ═══════════════════════════════════════════════════════════════
   Ancient Bloom — order receiver.

   This runs on Google's servers, free. It does three things:
     1. writes every order into your Google Sheet
     2. emails you the moment one arrives
     3. answers the tracking page when a customer checks status

   SETUP — see README.md, section "Orders". In short:
     Google Sheet > Extensions > Apps Script > paste this in
     > change the two lines below > Run "setup" once
     > Deploy > New deployment > Web app
        Execute as:  Me
        Access:      Anyone
     > copy the /exec URL into data/settings.csv as orders_url
   ═══════════════════════════════════════════════════════════════ */

const OWNER_EMAIL = 'you@example.com';   // ← where order alerts are sent
const BRAND       = 'Ancient Bloom';     // ← your business name

const HEADERS = ['Order','Placed','Status','Name','Phone','Email','Country',
                 'Address','Items','Subtotal','Shipping','Total','Notes',
                 'Batch','Tracking'];

/* Run this once from the editor to create the header row. */
function setup(){
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sh.setName('Orders');
  sh.clear();
  sh.appendRow(HEADERS);
  sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange('C2:C').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['New','Confirmed','Paid','Packed','Shipped','Delivered','Cancelled'], true)
      .build()
  );
  SpreadsheetApp.getUi().alert('Sheet ready. Now deploy this as a Web app.');
}

function sheet(){
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders')
      || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

/* ── a new order arrives ───────────────────────────────────── */
function doPost(e){
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    const p  = e.parameter || {};
    const sh = sheet();

    sh.appendRow([
      p.id || '', p.placed ? new Date(p.placed) : new Date(), 'New',
      p.name || '', "'" + (p.phone || ''), p.email || '', p.country || '',
      p.address || '', p.items || '', p.subtotal || '', p.shipping || '',
      p.total || '', p.notes || '', p.batch || '', ''
    ]);

    notifyOwner(p);
    if(p.email) confirmCustomer(p);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, id: p.id }))
      .setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }finally{
    lock.releaseLock();
  }
}

function notifyOwner(p){
  const body =
    'New order ' + p.id + '\n\n' +
    p.items + '\n\n' +
    'Total: ' + p.total + '\n\n' +
    p.name + '\n' + p.phone + '\n' + (p.email || 'no email') + '\n' +
    p.country + '\n' + p.address + '\n\n' +
    (p.notes ? 'Notes: ' + p.notes + '\n\n' : '') +
    'WhatsApp them: https://wa.me/' + String(p.phone).replace(/\D/g, '');

  MailApp.sendEmail({
    to: OWNER_EMAIL,
    subject: '🌿 Order ' + p.id + ' — ' + p.name,
    body: body
  });
}

function confirmCustomer(p){
  MailApp.sendEmail({
    to: p.email,
    subject: BRAND + ' — order ' + p.id + ' received',
    body:
      'Thank you, ' + p.name + '.\n\n' +
      'We have your order:\n\n' + p.items + '\n\nTotal: ' + p.total + '\n\n' +
      'Nothing has been charged yet. We will confirm stock and shipping, then send ' +
      'a payment link.\n\nYour order number is ' + p.id + '. Keep it — you can check ' +
      'the status any time on our tracking page.\n\n— ' + BRAND
  });
}

/* ── a customer checks their status ────────────────────────── */
function doGet(e){
  const cb = (e.parameter || {}).callback;
  let out;
  try{
    out = lookup((e.parameter || {}).id, (e.parameter || {}).phone);
  }catch(err){
    out = { found: false, error: String(err) };
  }
  const body = cb ? cb + '(' + JSON.stringify(out) + ')' : JSON.stringify(out);
  return ContentService.createTextOutput(body).setMimeType(
    cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON
  );
}

function lookup(id, phone){
  if(!id || !phone) return { found: false };

  const digits = s => String(s || '').replace(/\D/g, '');
  const want   = String(id).trim().toUpperCase();
  const wantPh = digits(phone).slice(-8);          // last 8 digits, ignores +91 etc.

  const rows = sheet().getDataRange().getValues();
  for(let i = 1; i < rows.length; i++){
    const r = rows[i];
    if(String(r[0]).trim().toUpperCase() !== want) continue;
    if(digits(r[4]).slice(-8) !== wantPh) continue;

    return {
      found: true,
      id: r[0],
      placed: r[1] ? Utilities.formatDate(new Date(r[1]),
                Session.getScriptTimeZone(), 'd MMM yyyy') : '',
      status: r[2] || 'New',
      items: r[8],
      total: r[11],
      tracking: r[14] || ''
    };
  }
  return { found: false };
}
