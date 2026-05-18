# NestJS Backend – Deployment Guide (Docker + GitHub)

## 1. GitHub repo + deployment platform

- Repo connect ho chuka hai, branch **main** select hai.
- **Root directory:** Agar backend repo ke **root** par hai (jo tumhare case mein lagta hai), Root Directory **khali** chhod do ya `./` do. Agar backend kisi subfolder mein hai (e.g. `comesh-backend-`), to wahan `comesh-backend-` ya jo folder hai woh path do.
- **Build method:** Docker select hai – sahi hai.

---

## 2. Environment variables (Env)

Platform (Render / Railway / Fly.io / etc.) ke **Environment** / **Env Variables** section mein ye add karo. Values apni real values se replace karo; production ke liye strong secrets use karo.

| Variable | Required | Notes |
|----------|----------|--------|
| **PORT** | Yes | Platform usually auto-set karta hai (e.g. Render: `PORT`). Agar platform khud set karta hai to dubara add mat karo. Warna `3001` ya platform jo port de woh do. |
| **NODE_ENV** | Recommended | `production` |
| **MONGO_URL_ATLAS** | Yes | MongoDB Atlas connection string |
| **JWT_SECRET** | Yes | Strong secret (e.g. long random string) |
| **API_BASE_URL** | Recommended | Deployed app ka public URL (e.g. `https://comesh-app-backend.onrender.com`) – chat image URLs ke liye |

Optional (agar use ho rahe hon):

- **EMAIL_HOST**, **EMAIL_PORT**, **EMAIL_ID**, **EMAIL_PASS**
- **SENDGRID_API_KEY**
- **twilioAccountSid**, **twilioAuthToken**
- **IMAGE_KIT_*** (agar ImageKit use ho)

---

## 3. PORT ka use

- `main.ts` mein: `const port = process.env.PORT || 3001`
- Platform deployment pe **PORT** env variable set karta hai; app usi port par listen karegi.
- **Env mein PORT rakhna:** Agar platform **PORT** khud set karta hai to alag se add karne ki zarurat nahi. Agar platform PORT nahi deta (rare), to env mein `PORT=3001` (ya jo port platform assign kare) add karo.

---

## 4. Dockerfile (already fixed)

- `WORKDIR` ab `/usr/src/app` hai.
- Build stage: `npm ci` + `npm run build`.
- Production stage: `npm ci --only=production`, `dist` copy, `node dist/main.js`.
- **EXPOSE 3001** – container internally 3001 use karta hai; platform **PORT** env se override kar sakta hai (platform ka reverse proxy app ko us port par forward karta hai).

---

## 5. Deploy steps (short)

1. **Environment** section open karo.
2. **PORT:**  
   - Agar platform “PORT is set automatically” kehta hai → kuch mat add karo.  
   - Warna add: `PORT` = `3001` (ya platform jo bataaye).
3. **NODE_ENV** = `production`.
4. **MONGO_URL_ATLAS** = Atlas connection string.
5. **JWT_SECRET** = strong secret.
6. **API_BASE_URL** = deployed backend ka full URL (e.g. `https://your-app.onrender.com`).
7. Baaki env vars (email, SendGrid, Twilio, etc.) jo local `.env` mein hain, woh bhi add karo (values production ke hisaab se).
8. Save karke deploy chala do.

---

## 6. Post-deploy

- Health check: `https://your-domain.com/comesh/api` (ya koi public GET route).
- Frontend mein **BASE_URL** / **API_BASE_URL** ko isi deployed URL par point karo.
