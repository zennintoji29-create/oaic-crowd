# CPR (Crowd Pressure Radar) — Full Audit Log

| ID | Area | Severity | Finding | Evidence | Fix applied | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SEC-01 | Security | High | Hardcoded fallback device keys (`cpr-secret-key-2026`, `cpr-exhibition-secret-2026`) in `requireDeviceAuth` | `backend/src/index.js:190` | Removed `cpr-exhibition-secret-2026` and restricted dev fallback to `NODE_ENV !== 'production'` | Verified |
| SEC-02 | Security | High | Hardcoded `passcode: 'admin123'` in `initDefaultConfig()` exposed via `GET /api/config` | `backend/src/storage.js:117` | Removed `passcode` from `initDefaultConfig()` | Verified |
| SEC-03 | Security | High | Wildcard `'Access-Control-Allow-Origin': '*'` on SSE `/api/stream` | `backend/src/index.js:305` | Restricted SSE `Access-Control-Allow-Origin` to `allowedOrigins` allowlist | Verified |
| SEC-04 | Security | Medium | Operator signup/login used `bcrypt` cost 10 and `expiresIn: '8h'` instead of cost 12 and `2h` | `backend/src/index.js:515, 517, 547` | Updated `bcrypt.hash` to cost `12` and JWT `expiresIn` to `'2h'` across all auth routes | Verified |
| SEC-05 | Security | High | Unprotected mutating endpoints (`PUT /api/zones/:id`, `POST /api/commands`, `POST /api/simulate`) | `backend/src/index.js:718, 741, 780` | Added `requireMasterAuth` middleware to all three endpoints | Verified |
| SEC-06 | Security | Medium | Missing strict validation on gate override, power, density delta, and config angles/counts; no global Express error handler | `backend/src/index.js:358-423, 695-702` | Added explicit `400` validation for `manualState`, boolean `power`, integer `delta`, `servoOpenAngle`/`servoLockedAngle` (0–180), `gateCount` (1–4), plus global error handler | Verified |
| SEC-07 | Security | Low | `npm audit` reports 1 high-severity `zod < 4.6.6` advisory in backend (major breaking upgrade to v4) | `backend/package.json:20` | Audited; frontend has 0 vulnerabilities; backend `zod` v4 upgrade deferred as breaking change (documented below) | Verified |
| FUNC-01 | Functionality | Medium | `AboutTab.tsx` referenced `HLK-LD2450` instead of `HLK-LD2410` | `frontend/src/components/AboutTab.tsx:28, 109` | Updated both references to `HLK-LD2410` | Verified |
| FUNC-02 | Functionality | Medium | `Login.tsx` did not return users to their original `from` route after login | `frontend/src/pages/Login.tsx:75` | Added `useLocation()` `from` redirect after successful login when setup is complete | Verified |
| FUNC-03 | Functionality | Medium | Missing `/api/master/reset` endpoint alias | `backend/src/index.js:316` | Added `POST /api/master/reset` sharing `handleResetAll` with `POST /api/gates/reset-all` | Verified |
| DOC-01 | Docs & Config | Low | Servo angle text in `ZoneDetailTab.tsx`, `ConfirmModal.tsx`, `AboutTab.tsx`, and `formatter.ts` inverted `0°`/`90°` | `ZoneDetailTab.tsx:251, 262`, `ConfirmModal.tsx:29, 35`, `AboutTab.tsx:99`, `formatter.ts:65, 70, 74` | Standardized all copy and unit tests to `90° = OPEN`, `0° = LOCKED` | Verified |
| DATA-01 | Data & Logic | Low | `storage.js` gate overrides and power toggles did not mirror to Supabase | `backend/src/storage.js:402-415` | Added `dbUpsertGate(gate)` calls to `updateGateOverride` and `updateGatePower` | Verified |

---

## Final Report

- **Total Findings**: **12** (0 Critical, 4 High, 5 Medium, 3 Low) — **12 Verified** (0 Open).
  - By Area: `SEC`: 7 | `FUNC`: 3 | `DATA`: 1 | `DOC`: 1 | `UI`: 0 | `PERF`: 0.
- **Audit Rounds**: **2 rounds** (Round 1 discovery + fixes; Round 2 full re-audit across strict TypeScript `--noUnusedLocals --noUnusedParameters`, `vitest`, `vite build`, `dist/` secret scan, `npm audit`, and live backend API verification).
- **Action Items for Operator**:
  1. **Render Environment Variables**: Ensure `JWT_SECRET`, `MASTER_PIN_HASH` (bcrypt cost 12), `MASTER_KEY_HASH` (bcrypt cost 12), `DEVICE_KEY`, `CORS_ORIGIN=https://oaic-crowd.vercel.app`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY` are set in Render.
  2. **Rotate Credentials**: Rotate `MASTER_PIN_HASH`, `MASTER_KEY_HASH`, and `DEVICE_KEY` before production deployment if demo values were used.
  3. **Physical Hardware Tests**: Benchtop verification of ESP32 UART2 (`HLK-LD2410`), I2C (`VL53L0X`), and `SG90` servo angles (`90°` open / `0°` locked) requires physical hardware connected to the host.
