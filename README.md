# Ancient Bloom — owner's manual

You never edit code. You edit two spreadsheets and drop in photos.

```
index.html          the shop page          ← don't touch
track.html          order status page      ← don't touch
assets/             styling and logic      ← don't touch
data/products.csv   YOUR PRODUCTS          ← edit in Excel
data/settings.csv   YOUR SETTINGS          ← edit in Excel
images/             YOUR PHOTOS            ← drop files here
apps-script/Code.gs paste into Google once ← setup only
```

---

## Part 1 — Put it online (15 minutes, once)

1. Make a free account at **github.com**.
2. **New repository**. Name it `ancientbloom`. Set it **Public** — GitHub Pages doesn't work on private repos on the free plan. Tick *Add a README file*. Create.
3. **Add file → Upload files.** Drag in everything: `index.html`, `track.html`, and the `assets`, `data`, `images` and `apps-script` folders. Commit.
4. **Settings → Pages.** Source: *Deploy from a branch*. Branch `main`, folder `/ (root)`. Save.
5. Wait two minutes. Your shop is at `https://yourusername.github.io/ancientbloom`.

> **Don't test by double-clicking `index.html` on your computer.** The page will load but the shelf will be empty and a yellow warning will appear. Browsers block local file reading for security. It only works from a real web address.

---

## Part 2 — Orders and notifications (30 minutes, once)

Without this, the Place Order button still works — it falls back to WhatsApp, and nothing is lost. This part adds the order log, the emails, and customer tracking.

1. Make a new **Google Sheet**. Name it `Ancient Bloom Orders`.
2. **Extensions → Apps Script.** Delete whatever's in the editor.
3. Open `apps-script/Code.gs`, copy all of it, paste it in.
4. Change the top two lines to your real email and business name. Save.
5. In the function dropdown choose **setup**, click **Run**. Approve the permissions when Google asks — it will warn you about an unverified app; that's because you wrote it. Click *Advanced → Go to (unsafe)*. It's your own script.
6. **Deploy → New deployment → ⚙ → Web app.**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy. Copy the URL ending in `/exec`.
7. Open `data/settings.csv`, paste that URL as the value for `orders_url`. Upload the file to GitHub.

Now every order lands as a row in your Sheet, emails you within seconds, and emails the customer a confirmation if they gave an address.

**To update an order:** change the **Status** column in the Sheet. The dropdown offers New → Confirmed → Paid → Packed → Shipped → Delivered. Paste a courier number into the **Tracking** column and the customer sees it on the tracking page. That's your whole order management system — a spreadsheet.

> **Whenever you change `Code.gs` later**, you must **Deploy → Manage deployments → ✏️ → New version → Deploy**. Just saving doesn't publish it. This catches everyone once.

---

## Part 3 — Updating products

Open `data/products.csv` in Excel. One row per product.

| Column | What goes in it |
|---|---|
| `id` | short lowercase name, no spaces — `bloom-oil`. Never change it once orders exist. |
| `name` | what customers see |
| `category` | groups the filter buttons — Face, Body, Hair, Lips |
| `price` | numbers only. `1450`, not `₹1,450` |
| `size` | `30 ml`, `100 g` |
| `status` | `available`, `sold out`, `preorder`, or `hidden` |
| `options` | choices separated by `\|`. Blank if none. |
| `short` | one line, currently unused — a spare |
| `description` | the two or three sentences on the card |
| `ingredients` | separated by `\|` |
| `image` | filename in `images/`, e.g. `bloom-oil.jpg` |
| `sort` | 1, 2, 3… controls the order on the page |

**Options that change the price.** Put the difference in brackets:

```
30 ml|50 ml (+₹700)
Jasmine|Unscented|Rose (+150)
```

Picking the 50 ml adds ₹700 automatically. Use `(-100)` to take money off.

**To add a product:** new row, fill it in, save. **To retire one:** set `status` to `hidden` — better than deleting, because you keep the record.

### Saving the file correctly

In Excel: **File → Save As → CSV UTF-8 (Comma delimited) (.csv)**.

Not plain "CSV" — that one mangles the ₹ symbol and any accented characters. Excel will warn you about losing formatting. Say yes; there's no formatting to lose.

### Getting it onto the site

On GitHub, open `data/products.csv` → the pencil icon → paste your new content → **Commit changes**. Or **Add file → Upload files** and drop the new CSV over the old one.

Live within a minute. If you don't see the change, hard-refresh: `Ctrl+Shift+R`, or `Cmd+Shift+R` on a Mac.

---

## Part 4 — Settings

`data/settings.csv` is key-and-value pairs. The ones you'll actually touch:

| Key | Notes |
|---|---|
| `whatsapp` | country code, no `+`, no spaces: `919999999999` |
| `orders_url` | the `/exec` URL from Part 2 |
| `batch_number` | shows in the band across the top |
| `batch_poured` / `batch_best_before` | free text dates |
| `batch_jars` / `batch_claimed` | the tally marks. Update `batch_claimed` as jars sell. |
| `free_shipping_over` | in rupees. `2000` |
| `ship_flat_india` | flat shipping charge |

Editing `batch_claimed` as stock moves is the single highest-value two-second job on this site. A tally visibly emptying is what turns "maybe later" into an order.

---

## Part 5 — Photos

Drop files into `images/`, named to match the `image` column. If a file is missing, the card shows a grey placeholder naming the file it wanted — so nothing breaks, it just looks unfinished.

Shoot all products in one session: same surface, same window light, no flash, same angle. Crop square. Consistency across the six matters far more than the quality of any one shot.

Resize to about 1000px wide before uploading. Phone photos are 4MB each and will make the page crawl on mobile data.

---

## When something goes wrong

**Shelf is empty, yellow banner.** You opened the file locally, or a CSV has a broken row. Check that every row has the same number of commas as the header.

**A product vanished.** `status` is `hidden`, or its `id` is blank.

**Price shows as ₹NaN.** There's a comma or a ₹ inside the `price` cell. Digits only.

**Orders aren't arriving by email.** `orders_url` is empty or wrong, or you edited `Code.gs` without redeploying a new version. Check the Sheet first — if rows are appearing but no email, it's the `OWNER_EMAIL` line.

**Tracking says it can't reach the order system.** The deployment access is set to something other than *Anyone*.

**Changes aren't showing.** Hard-refresh. GitHub Pages also takes up to a minute.

---

## A note on what this is and isn't

There's no payment gateway here. Orders arrive, you confirm stock and shipping, then you send a payment link — UPI, Razorpay, a bank transfer, whatever you already use. That's deliberate: it's how most small handmade businesses actually work, it costs nothing, and it keeps you in the conversation with every customer.

If you outgrow it — a hundred orders a month, say — that's the point to look at Shopify or Razorpay's storefront. Not before.
