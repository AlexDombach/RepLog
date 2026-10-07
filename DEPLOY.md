# Getting RepLog onto your iPhone

Two paths. Use **LAN preview** for quick testing while you build, and **GitHub
Pages** once — that's the one that gives you a real offline home-screen app.

---

## Why the one-time deploy is needed

iOS only runs a service worker — the thing that caches the app so it works with
no signal — on a **secure origin**: `https://` or `localhost`. Your laptop's LAN
address (`http://192.168.x.x:4173`) is neither.

So over plain LAN HTTP on the phone:

| | LAN `http://` | GitHub Pages `https://` |
|---|---|---|
| Opens in Safari | yes | yes |
| Add to Home Screen | yes | yes |
| Launches fullscreen | yes | yes |
| Data saved in IndexedDB | yes | yes |
| **Works in airplane mode** | **no** | **yes** |

Deploying does **not** put your workout data anywhere. The static files are
public; every profile, session, PR and XP point stays in IndexedDB on your
phone. The app makes zero network requests after it loads.

---

## Option A — GitHub Pages (recommended, do this once)

**This is already done.** The repo is live at
<https://github.com/AlexDombach/RepLog> and Pages is serving from it. Skip to
step 3 to install on the phone.

### 1. Push the project to GitHub

Already set up. To push later changes:

```bash
git add -A
git commit -m "whatever changed"
git push
```

> **The repo name must be `RepLog`.** `vite.config.ts` sets `base: '/RepLog/'`,
> which has to match the URL path GitHub Pages serves from. If you ever rename
> the repo, change `base` to `'/<that-name>/'` to match.
>
> **The repo must be public.** GitHub Pages on a *private* repo requires a paid
> plan (Pro/Team). On the free plan the API refuses with
> `Your current plan does not support GitHub Pages for this repository.`
> If you want the source private, use Cloudflare Pages or Netlify instead —
> both deploy from private GitHub repos for free over HTTPS. Build them with
> `npm run build:root` so the base path is `/`.

### 2. Turn on Pages

Already on, set to **Source: GitHub Actions**. `.github/workflows/deploy.yml`
rebuilds and republishes on every push to `main`. Watch it under the **Actions**
tab; a run takes about a minute.

### 3. Install it on the iPhone

1. Open **Safari** (not Chrome — only Safari can install to the home screen) and
   go to **<https://alexdombach.github.io/RepLog/>**
2. Wait for it to finish loading, then **pull down to refresh once**. This gives
   the service worker a moment to precache everything.
3. Tap the **Share** button → **Add to Home Screen** → **Add**.
4. Launch it from the home-screen icon. No Safari address bar = installed
   correctly.
5. **Test it:** turn on Airplane Mode and open the app. It should start normally
   and let you log a full workout.

Do this on both phones — each gets its own independent copy of the data.

### After you push an update

Next time the phone has signal and you open the app, the new version downloads in
the background and is live the time after that. **Your data is never touched by
an update** — IndexedDB survives.

---

## Option B — LAN preview (fast iteration, no offline)

Good for checking layout and feel on the real phone without deploying.

```bash
npm run build
npm run preview -- --host
```

Vite prints something like:

```
➜  Network: http://192.168.1.42:4173/RepLog/
```

Open that **full URL including `/RepLog/`** in Safari on the phone. Both devices
must be on the same Wi-Fi.

If the phone can't reach it, Windows Firewall is almost certainly blocking Node.
In an **admin** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "Vite preview 4173" -Direction Inbound -LocalPort 4173 -Protocol TCP -Action Allow -Profile Private
```

Remember: offline caching will **not** work over this URL. That's expected.

---

## Option C — any other static host

The build output in `dist/` is plain static files. Netlify, Vercel, Cloudflare
Pages all work. If you serve from the **domain root** rather than a subpath,
build with:

```bash
npm run build:root
```

That sets `base: '/'` so the asset paths and service-worker scope line up.

---

## Backups — read this part

There is no cloud copy of your workouts. If the phone is lost, wiped, or you
delete the app, the data goes with it.

**Settings → Your data → Export** writes a `replog-backup-YYYY-MM-DD.json` file.
On iOS the share sheet opens; save it to Files, iCloud Drive, or mail it to
yourself. **Import** on any device restores it exactly.

Worth doing every few weeks.

One more thing: iOS can evict a web app's storage if the app goes **unused for
about seven days** while it's only a Safari tab. Installing to the home screen
makes Safari treat the storage as persistent, which is the main reason to do the
Add to Home Screen step rather than just bookmarking it. Settings → Your data
shows whether persistent storage was granted.

---

## Troubleshooting

**"Add to Home Screen" is missing** — you're in Chrome or Firefox on iOS. Only
Safari can install PWAs.

**Opens with the Safari address bar visible** — you opened a bookmark, not the
home-screen icon. Delete it and re-add via Share → Add to Home Screen.

**Blank page after deploying** — `base` in `vite.config.ts` doesn't match the
repo name. They have to be identical, including capitalisation.

**`error: remote origin already exists`** — a remote is already set. Change it
rather than adding another: `git remote set-url origin <url>`. Check what you
have with `git remote -v`.

**Push fails with HTTP 400 and the URL contains `<your-username>`** — a
placeholder got copied literally. Fix with
`git remote set-url origin https://github.com/AlexDombach/RepLog.git`.

**Airplane-mode test fails** — the service worker hadn't finished precaching
before you added it. Go back online, open the site in Safari, refresh twice,
wait ten seconds, then re-add it.

**Data vanished** — iOS evicted it (app not installed to the home screen, or
unused for a long stretch) or Safari history+data was cleared. Import your
backup. Nothing else can be done; this is a platform limitation of all web apps
on iOS.
