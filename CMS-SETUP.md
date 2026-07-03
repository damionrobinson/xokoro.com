# Setting up the Xokoro CMS (Decap)

The site stays on GitHub Pages exactly as before. Netlify is only used as a free login service so Decap CMS can commit changes to GitHub on your behalf — nothing about your hosting or domain changes.

## 1. Push these changes

Commit and push everything in this folder to `main`. Once it's live at xokoro.com, you'll also see it at `xokoro.com/admin/` (not usable yet — that's step 4).

## 2. Create a free Netlify account and link the repo

1. Go to app.netlify.com and sign up (free).
2. "Add new site" → "Import an existing project" → connect GitHub → choose `damionrobinson/xokoro.com`.
3. When asked for build settings, leave the build command empty and set the publish directory to `.` (this is a static site, nothing to build). Click deploy — it's fine if this creates a second, unused copy of the site at something like `random-name-123.netlify.app`. You'll keep using xokoro.com for real visitors; the Netlify copy only exists to power login.
4. Note the site name Netlify gave you (shown at the top of the dashboard, and in the URL `https://SITE-NAME.netlify.app`). You'll need it in step 4.
5. Optional: rename it to something memorable under Site settings → General → Site details → Change site name (e.g. `xokoro-cms`).

## 3. Turn on Identity and Git Gateway

In your new Netlify site's dashboard:

1. Site configuration → Identity → **Enable Identity**.
2. Under Identity → Registration, set it to **Invite only** (so strangers can't sign themselves up as editors).
3. Under Identity → Services → **Enable Git Gateway**. This is what lets Decap commit to GitHub without you ever handling a GitHub token.
4. Still on the Identity tab, click **Invite users**, enter your own email, and accept the invite email when it arrives (it'll open a Netlify page where you set a password).

## 4. Point the admin page at your Netlify site

Open `admin/index.html` in this repo and replace `YOUR-NETLIFY-SITE-NAME` with the site name from step 2:

```js
APIUrl: "https://YOUR-NETLIFY-SITE-NAME.netlify.app/.netlify/identity"
```

Commit and push that one-line change.

## 5. Log in and use the CMS

Visit `https://xokoro.com/admin/`, click log in, and sign in with the account you accepted the invite with. You'll land on a "Products" section with one entry — "Product Catalogue" — containing every piece as a repeatable list: add a new item to add a product, drag to reorder (top of the list = "Newest" on the site), or delete one to remove it. Photos upload straight into the media library and get committed alongside the change.

Every save commits directly to `main` and GitHub Pages redeploys automatically, usually live within a minute.

### If login 405s on your custom domain

If xokoro.com's DNS is proxied through Cloudflare (the orange-cloud setting), requests to `/.netlify/identity/*` can get blocked with a 405 error. If that happens, just use `https://YOUR-NETLIFY-SITE-NAME.netlify.app/admin/` instead — same CMS, same repo, and that URL doesn't touch Cloudflare at all.

## What's still a stub

Matching the attached design, two things are intentionally left as visual stubs rather than wired to real services:

- **Checkout** (the PayPal button on the product page) — needs your PayPal Business Client ID before it can take real payments.
- **Contact form** (About page) — validates and shows a success message but doesn't send anywhere yet. The newsletter popup, by contrast, *is* live — it reuses the same Google Form your old coming-soon page posted to, so those sign-ups keep landing in the same spreadsheet.

Ask me any time to wire either of these up properly (Formspree, a Google Form, or your own inbox all work for the contact form).
