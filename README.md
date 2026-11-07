# headphonelessrecording.com

Landing page and waitlist for **Headphoneless** — record with your speakers on; the speaker bleed is removed from the mic track.

- `public/` — the page (`index.html`, `styles.css`, `app.js`), favicon, 404.
- `server.js` — no-dependency Node server: serves `public/`, takes waitlist signups at `POST /api/waitlist`.

## Run locally
```
npm start            # http://localhost:3000
```

## Deploy (Railway)
1. New project → Deploy from GitHub repo → this repo. Railway runs `npm start`.
2. Add a **Volume** mounted at `/data` and set `DATA_DIR=/data` so signups survive redeploys.
3. Set `ADMIN_KEY` to a long random string.
4. Settings → Networking → Custom domain → `headphonelessrecording.com` (and `www.`), then add the CNAME / records Railway shows at your registrar.

## Waitlist
Download signups as CSV: `https://headphonelessrecording.com/api/waitlist.csv?key=<ADMIN_KEY>`
Stored one JSON line per signup in `$DATA_DIR/waitlist.jsonl` (email, what they record, their DAW, time). Duplicate emails are ignored.
