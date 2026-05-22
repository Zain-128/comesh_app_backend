# Comesh Backend – Render par deploy (Step by Step)

## 1. GitHub par code push karo

- Agar repo pehle se nahi hai: **comesh** folder ko GitHub par push karo.
- Render GitHub repo se hi deploy karega.

```bash
cd /path/to/comesh
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/comesh.git
git push -u origin main
```

---

## 2. Render account & new Web Service

1. **https://render.com** par jao → Sign up / Login (GitHub se link karo).
2. **Dashboard** → **New +** → **Web Service**.
3. **Connect repository**: apna **comesh** repo select karo (agar list mein nahi hai to "Configure account" se GitHub access do).
4. Connect ke baad settings aayengi.

---

## 3. Web Service settings

| Field | Value |
|-------|--------|
| **Name** | `comesh-api` (ya jo naam chaho) |
| **Region** | Singapore (ya sabse nazdeek) |
| **Branch** | `main` |
| **Root Directory** | `comesh-backend-` **(zaroor set karo)** |
| **Runtime** | **Node** |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:prod` |

- **Instance Type**: Free ya Starter (Free par 15 min inactivity ke baad sleep ho jata hai).

Save / Create Web Service.

---

## 4. Environment Variables (Render par)

**Dashboard** → apna service → **Environment** tab.

Yeh variables **add** karo (`.env` wale values yahan daalo; **secret values GitHub par commit mat karo**):

| Key | Value | Notes |
|-----|--------|--------|
| `NODE_ENV` | `production` | |
| `PORT` | (chhodo) | Render khud `PORT` set karta hai |
| `JWT_SECRET` | apna strong secret | |
| `MONGO_URL_ATLAS` | `mongodb+srv://...` | MongoDB Atlas connection string |
| `EMAIL_ID` | your@email.com | |
| `EMAIL_PASS` | app password | |
| `EMAIL_HOST` | smtp.gmail.com | |
| `EMAIL_PORT` | 587 | |
| `SENDGRID_API_KEY` | SG.xxx | (agar use ho) |
| `OTP_EXPIRY_MINUTES` | 1 | |
| `IMAGE_KIT_PUCLIC_KEY` | public_xxx | |
| `IMAGE_KIT_PRIVATE_KEY` | private_xxx | |
| `IMAGE_BASE_URL` | https://ik.imagekit.io/xxx | |
| `twilioAccountSid` | ACxxx | |
| `twilioAuthToken` | xxx | |

**Important:**  
- `.env` file **Render par upload nahi hoti**; saari values **Environment** tab par hi daalni hoti hain.  
- MongoDB, JWT, SendGrid, Twilio etc. sab yahin se aayega.

---

## 5. Deploy

1. **Environment** save karo.
2. **Manual Deploy** → **Deploy latest commit** (ya phir next git push par auto-deploy).
3. Logs mein dekho: `Build successful` aur `Server running on port 10000` (ya jo PORT Render de).

---

## 6. URL aur CORS

- Deploy ke baad URL milega jaise:  
  `https://comesh-api.onrender.com`
- **Frontend** (React Native / web) mein:
  - API base URL: `https://comesh-api.onrender.com`
  - Socket URL: `https://comesh-api.onrender.com` (same host, Socket.IO wahi chalega)

Agar frontend alag domain se chal raha ho to backend mein CORS allow karna padega (abhi `app.enableCors()` sab allow karta hai; production mein specific origin bhi set kar sakte ho).

---

## 7. Free tier – dhyan mein rahe

- **Spin down**: ~15 min koi request nahi aati to service so jati hai, pehli request slow (cold start).
- **WebSockets (Socket.IO)**: Render par chalenge; cold start ke baad connection theek rahega.
- **Build time**: Free tier par limit hoti hai; agar build fail ho to logs check karo.

---

## 8. Frontend mein URL update

**React Native** (`updated/src/constants/endPoints.js`):

- `BASE_URL`: `https://comesh-api.onrender.com/` (ya jo path use karte ho, e.g. `/api/`)
- `SOCKET_BASE_URL`: `https://comesh-api.onrender.com`

Agar backend ab bhi **path prefix** use nahi karta (e.g. `/comesh/api`), to:

- `BASE_URL = 'https://comesh-api.onrender.com/'`
- Socket: `SOCKET_BASE_URL = 'https://comesh-api.onrender.com'`

---

## Short checklist

- [ ] Repo GitHub par push
- [ ] Render par Web Service, **Root Directory** = `comesh-backend-`
- [ ] Build: `npm install && npm run build`
- [ ] Start: `npm run start:prod`
- [ ] Saari env vars Render **Environment** tab par add
- [ ] Deploy → logs check
- [ ] Frontend mein API + Socket URL Render wala daal do

Iske baad backend **Render par live** ho chuka hoga.
