# 🔓 Demo Mode Guide — Disable Authentication

## Quick Enable

To disable authentication for demos and testing, set the `DEMO_MODE` environment variable:

### Option 1: Command Line (Immediate)

```bash
# Windows (PowerShell)
$env:DEMO_MODE="true"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Windows (CMD)
set DEMO_MODE=true
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Linux/Mac
export DEMO_MODE=true
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Option 2: .env File (Persistent)

1. Create or edit `backend/.env`:
```env
DEMO_MODE=true
GROQ_API_KEY=your_api_key
GROQ_MODEL=llama3-70b-8192
```

2. Start the server:
```bash
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Option 3: Using the Startup Script

Edit `start-all.bat` and add before starting the backend:
```batch
set DEMO_MODE=true
```

---

## What Happens in Demo Mode?

When `DEMO_MODE=true`:

✅ **Authentication bypassed** — No JWT token required
✅ **Auto-login** — All requests use demo user: `demo@advocai.local` (ID: 999)
✅ **Full API access** — Submit cases, get results, download PDFs
✅ **Backend logs** — Shows warning: `⚠️  DEMO MODE ENABLED`

### Example API Call (With Demo Mode)

```bash
# Before Demo Mode: Requires JWT token
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/cases

# After Demo Mode: Works without token!
curl http://localhost:8000/api/cases
```

---

## Demo Mode Features

### ✅ What Works

- ✅ Submit cases without login
- ✅ Upload documents (PDFs, images)
- ✅ Stream real-time agent processing
- ✅ Get appeal letter results
- ✅ Download PDF packets
- ✅ Multiple case submissions

### ❌ What's Limited

- ❌ User registration (`/api/auth/register`) — demo user is hardcoded
- ❌ User login (`/api/auth/login`) — not needed, auto-authenticated
- ❌ User profile (`/api/auth/me`) — returns demo user info
- ❌ Multi-user case isolation — all cases belong to demo user (ID: 999)

---

## Demo User Info

When Demo Mode is enabled:

| Property | Value |
|----------|-------|
| User ID | 999 |
| Email | demo@advocai.local |
| Password | (none — auth bypassed) |
| Cases | All test cases stored under this user |

---

## Production Safety

### ⚠️ Important: NEVER Use Demo Mode in Production

- **Never** set `DEMO_MODE=true` on production servers
- **Always** require authentication in production
- **Always** use strong JWT_SECRET in production
- Add environment validation to prevent accidental exposure

---

## Switching Back to Production

To re-enable authentication:

### Option 1: Remove .env variable
```bash
# Delete DEMO_MODE=true from backend/.env
```

### Option 2: Set explicitly to false
```bash
DEMO_MODE=false
```

### Option 3: Command line
```bash
# Windows (PowerShell)
Remove-Item Env:DEMO_MODE
# or
$env:DEMO_MODE="false"
```

---

## Troubleshooting

### Issue: Still getting 401 Unauthorized

**Check:**
1. Backend restarted after setting `DEMO_MODE=true`?
2. Check backend logs for: `⚠️  DEMO MODE ENABLED`
3. Try restarting the entire application

### Issue: Authorization header still required

**Solution:** The frontend might still be sending auth headers (which is fine).
In demo mode, the backend simply ignores missing auth headers.

---

## Testing the Demo Mode

### 1. Check Backend Logs

When starting the backend, you should see:
```
==============================================================
⚠️  DEMO MODE ENABLED - Authentication Bypassed!
    All endpoints accessible without JWT token
    Demo user: demo@advocai.local (ID: 999)
==============================================================
```

### 2. Test with cURL

```bash
# This should work in demo mode (no token needed)
curl http://localhost:8000/api/cases

# This should also work (but token is ignored)
curl -H "Authorization: Bearer invalid_token" http://localhost:8000/api/cases
```

### 3. Test with Frontend

- Open http://localhost:3000
- You should be able to submit cases **without** logging in
- All features should work normally

---

## Comparison: Auth vs Demo Mode

| Feature | Production | Demo Mode |
|---------|-----------|-----------|
| Login required | ✅ Yes | ❌ No |
| JWT validation | ✅ Yes | ❌ No |
| User isolation | ✅ By user ID | ❌ All demo user |
| Database required | ✅ Yes | ⚠️ Optional |
| Multi-user | ✅ Yes | ❌ Single demo user |
| Security | ✅ High | ❌ None |
| Performance | Normal | Slightly faster |

---

## Next Steps

- ✅ Enable demo mode: Set `DEMO_MODE=true`
- ✅ Restart backend: `python -m uvicorn main:app --reload`
- ✅ Open frontend: http://localhost:3000
- ✅ Try submitting a case without login!
- ✅ When done: Set `DEMO_MODE=false` and restart

---

**Happy testing! 🚀**
