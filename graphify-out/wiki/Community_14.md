# Community 14

> 7 nodes · cohesion 0.38

## Key Concepts

- **Cloudflare KV Store — User Sessions and Data** (6 connections) — `functions/api/userdata.js`
- **PBKDF2-SHA256 Authentication (100k iterations, 30-day sessions)** (3 connections) — `functions/api/auth/login.js`
- **functions/api/auth/login.js — User Login** (2 connections) — `functions/api/auth/login.js`
- **functions/api/auth/profile.js — User Profile GET/PUT** (2 connections) — `functions/api/auth/profile.js`
- **functions/api/auth/register.js — User Registration** (2 connections) — `functions/api/auth/register.js`
- **functions/api/userdata.js — User Data Sync (KV)** (2 connections) — `functions/api/userdata.js`
- **functions/api/auth/logout.js — User Logout** (1 connections) — `functions/api/auth/logout.js`

## Relationships

- [[Community 2]] (2 shared connections)

## Source Files

- `functions/api/auth/login.js`
- `functions/api/auth/logout.js`
- `functions/api/auth/profile.js`
- `functions/api/auth/register.js`
- `functions/api/userdata.js`

## Audit Trail

- EXTRACTED: 15 (83%)
- INFERRED: 3 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*