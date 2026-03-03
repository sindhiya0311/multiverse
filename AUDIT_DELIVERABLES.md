# Noctis — Audit Deliverables
## Production Readiness & Presentation Polish

---

## 1. DETECTED LOGICAL ISSUES & FIXES

### 1.1 GPS Teleportation Check Bug (RiskEngine)
**Issue:** Teleportation detection compared current location with itself (same array element) due to comparing with `previousLocations[length-1]` after pushing current. Time difference was always ~0, causing false positives/negatives.

**Fix:** Compare current with **previous** point at index `length-2`. Use proper timestamp extraction for `prevTs` and `currTs`, with `timeDiffSec` minimum 0.1s to avoid division issues.

### 1.2 Speed Unit Mismatch (Client → Server)
**Issue:** Geolocation API returns speed in **m/s**; RiskEngine expects **km/h** for stationary threshold (2 km/h). All stop-duration and speed-entropy logic was using wrong units.

**Fix:** Convert in `locationStore.js`: `speedKmh = (speedMps ?? 0) * 3.6`. Clamp to `≥ 0`.

### 1.3 RiskBreakdown Location Field Mismatch
**Issue:** Component used `breakdown.locationRisk` but server sends `breakdown.locationRiskWeight`. Location risk bar always showed 0.

**Fix:** Use `breakdown.locationRiskWeight ?? breakdown.locationRisk ?? 0` for backward compatibility.

### 1.4 Negative Speed Handling
**Issue:** Invalid GPS could send negative speed; speed entropy buffer would accumulate invalid values.

**Fix:** Clamp in `RiskEngine.calculateSpeedEntropy`: `speed = Math.max(0, parseFloat(currentSpeed) || 0)`. DataProcessor already clamps 0–300 km/h.

### 1.5 Family Location Broadcast Ignored User Preference
**Issue:** `DataProcessor.broadcastToFamily` sent location to family regardless of `user.isLocationSharingEnabled`. User privacy setting was bypassed for real-time broadcast.

**Fix:** Check `user.isLocationSharingEnabled !== false` before calling `broadcastToFamily`. Fetch `isLocationSharingEnabled` in user select.

### 1.6 Orange Alert Log Spam
**Issue:** Every location update with score 60–79 created a new Alert document. High DB write volume during sustained elevated risk.

**Fix:** Added `lastOrangeLogTime` and `ORANGE_LOG_COOLDOWN_MS` (60s). Log orange only once per minute per user.

### 1.7 Emergency Modal Showed Wrong Location
**Issue:** Modal displayed `currentLocation` (viewer) instead of alert subject’s location (person in distress).

**Fix:** Use `alert.location` for latitude/longitude in EmergencyAlertModal.

---

## 2. EDGE CASE HANDLING

### 2.1 GPS Signal Loss
**Fix:** In `locationStore`, on `POSITION_UNAVAILABLE` error, keep last known location instead of clearing. Prevents map jump and preserves last valid state.

### 2.2 Invalid/Undefined Location Payload (Socket)
**Fix:** Validate `latitude`, `longitude` before processing. Use `parseFloat` and reject `NaN`. Normalize `timestamp` (string/number). Pass validated object to DataProcessor.

### 2.3 Undefined Accuracy
**Fix:** `DataProcessor.validateCoordinates` now allows `accuracy` undefined. Only validate when provided; type and range check when present.

### 2.4 Socket Reconnection
**Fix:** Increased `reconnectionAttempts` to 10, added `reconnectionDelayMax: 10000`, `timeout: 20000`. Added `polling` fallback transport. User-friendly toast on invalid token.

### 2.5 Family Presence Toast Spam
**Issue:** Every `family:presence` with `isOnline: true` showed toast, including reconnects.

**Fix:** Only toast when transitioning from offline → online (check previous `member.member.isOnline`).

### 2.6 Duplicate Location Updates
**Existing:** 1s deduplication by `lat_lon_timestamp` key. **Added:** Rate limit of 5 location updates per second per user to prevent abuse.

---

## 3. SECURITY HARDENING

### 3.1 Socket Input Validation
- **location:update:** Validate `latitude`, `longitude` (reject NaN). Build normalized payload for DataProcessor.
- **sos:trigger:** Validate coordinates, cap `message` to 500 chars.
- **alert:acknowledge / alert:resolve:** Validate `alertId` presence and type before processing.

### 3.2 Location Broadcasting
- Uses `io.to(\`user:${memberId}\`)` for room-based delivery (multi-tab safe).
- Family notifications require `canReceiveAlerts: true` (RED) and `canViewLocation: true` (location).
- Respects `user.isLocationSharingEnabled` before broadcasting to family.

### 3.3 Rate Limiting
- **HTTP:** General, auth, location, SOS, API limiters already applied.
- **Socket:** In-memory rate limit for `location:update` (5/sec/user).
- Cleanup on disconnect: `locationUpdateCounts.delete(userId)`.

### 3.4 User Model
- Added `currentBaseScore`, `lastLocationUpdateAt` for proper schema alignment with DataProcessor updates.

---

## 4. UI / UX IMPROVEMENTS

### 4.1 Loading Screen
- New `LoadingScreen.jsx`: branded NOCTIS splash, Moon icon, animated dots.
- Configurable `minDuration` for presentation. Smooth fade-out.

### 4.2 Demo Mode
- New `useDemoStore` with persisted `demoMode`.
- Toggle in MainLayout sidebar.
- When enabled: RiskMeter uses `smoothTransition` (1.5s vs 0.7s). Demo badge in Dashboard header.
- Ensures stable, smooth animations during demos.

### 4.3 Risk Meter
- `smoothTransition` prop for slower transitions in demo mode.
- Existing pulse and glow retained.

### 4.4 Cards
- Subtle hover shadow for cards in `index.css` for depth.

### 4.5 Cleanup
- Removed debug `console.log` from Dashboard, EmergencyAlertModal, socket service.
- Kept `console.error` for real errors (family, location, auth stores, etc.).

### 4.6 MainLayout
- Fixed navigation array mutation: use spread instead of `push` for admin link to avoid duplicates on re-render.

---

## 5. PRESENTATION MODE

- **Loading screen:** Professional first-impression on app load.
- **Demo mode toggle:** Persistent, enables smoothed risk transitions and clear indicator.
- **Emergency modal:** Correct location, optional alarm (default off for demos).
- **Socket resilience:** Reconnection and fallback transports reduce disconnect during demos.
- **Rate limits:** Prevent accidental spam from rapid location updates during demos.

---

## 6. CODE QUALITY

- **RiskBreakdown:** Correct field name for location risk.
- **EmergencyAlertModal:** Uses `alertId` from `alert._id ?? alert.alertId`; removed unused imports.
- **Socket handler:** Consistent validation pattern for all socket events.
- **Store exports:** Added `useDemoStore` to store index.
- **DataProcessor:** Explicit check for `isLocationSharingEnabled` before broadcast.

---

## 7. FILES MODIFIED

| File | Changes |
|------|---------|
| `server/src/services/RiskEngine.js` | Teleportation fix, speed clamping, negative speed handling |
| `server/src/services/AlertEngine.js` | Orange log cooldown |
| `server/src/services/DataProcessor.js` | isLocationSharingEnabled check, validateCoordinates improvements |
| `server/src/socket/socketHandler.js` | Payload validation, rate limit, room-based broadcast, cleanup on disconnect |
| `server/src/models/User.js` | currentBaseScore, lastLocationUpdateAt |
| `client/src/store/locationStore.js` | Speed m/s→km/h conversion, GPS error handling |
| `client/src/store/demoStore.js` | **New** – demo mode state |
| `client/src/store/index.js` | Export useDemoStore |
| `client/src/components/RiskMeter.jsx` | smoothTransition prop |
| `client/src/components/RiskBreakdown.jsx` | locationRiskWeight support |
| `client/src/components/EmergencyAlertModal.jsx` | Use alert.location, remove debug logs |
| `client/src/components/LoadingScreen.jsx` | **New** – branded loading UI |
| `client/src/services/socket.js` | Reconnection config, presence toast logic, transport fallback |
| `client/src/pages/Dashboard.jsx` | Demo mode integration, remove debug logs |
| `client/src/layouts/MainLayout.jsx` | Demo toggle, navigation fix |
| `client/src/App.jsx` | LoadingScreen integration |
| `client/src/index.css` | Card hover transition |

---

## 8. STABILITY SUMMARY

- **Logical consistency:** Teleportation, speed units, and thresholds corrected.
- **Edge cases:** GPS loss, invalid payloads, reconnection, and rate limits handled.
- **Security:** Validated inputs, room-based delivery, and user preference respected.
- **Presentation:** Loading screen, demo mode, and polished UI for demos.
- **Code quality:** Correct field names, removed mutation, and clearer validation flows.

The system is stable, audited, and ready for production and live demos.
