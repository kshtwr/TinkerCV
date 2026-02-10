# TinkerCV
Tinker is a CV application that lets you manipulate images using gestures.

## Web version (deployable on Vercel)
There is a browser-based demo in `web/` using **MediaPipe Hands**. It runs entirely client-side: the webcam stream stays in the browser.

### Run locally
From the repo root:

```bash
cd web
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Deploy on Vercel
- **Framework**: Next.js
- **Root directory**: `web`
- **Build command**: `npm run build`
- **Output**: default (Next.js)

