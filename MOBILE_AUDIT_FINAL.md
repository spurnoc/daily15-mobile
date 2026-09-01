# MOBILE APP Forensic Audit Report — daily15-mobile

**Audit Date:** August 31, 2026
**Files Audited:** 14 source files, ~57KB total
**Platform:** Expo SDK 54, React 19.1, React Native 0.81.5

---

## Executive Summary (A-F Scores)

| Category | Grade | Assessment |
|----------|-------|------------|
| **Architecture** | **B+** | Good module separation (useSSEChat hook, AuthContext, haptics util). Shared ChatComponent reused by Survey and CheckIn. No circular dependencies. Bottom tab navigation is clean. |
| **Code Quality** | **B** | Functions are well-structured with useCallback/useRef. One empty catch in haptics.ts (acceptable). 0 hardcoded colors. Design tokens centralized in config.ts. |
| **Security** | **C+** | API uses HTTP (not HTTPS). Demo credentials hardcoded. Fake token fallback when API unreachable is a security risk. AsyncStorage token storage is acceptable for RN but not ideal. |
| **Performance** | **B+** | FlatList for lists, useCallback for callbacks, useRef for refs. XHR streaming for SSE. DashboardScreen has 5 inline onPress functions (minor re-render risk). |
| **Overall** | **B** | Solid mobile app with good architecture and performance. Security needs attention (HTTP, hardcoded creds, fake token). Accessibility is completely missing — zero labels across all screens. |

---

## Issues Found: 6 (after filtering false positives)

### 1. API uses HTTP (not HTTPS) — traffic is unencrypted
**Severity:** HIGH (security)
**File:** `src/config.ts:1`
```typescript
export const API_BASE = 'http://10.220.0.2:8040';
```
All API traffic including auth tokens is sent over plain HTTP. On shared WiFi, anyone can intercept tokens and survey responses. Fix: use HTTPS with a self-signed cert on nocbox-1, or tunnel through ngrok.

### 2. Demo credentials hardcoded
**Severity:** MEDIUM (security)
**File:** `src/context/AuthContext.tsx:47-48`
Demo email and password are hardcoded in source. If this ships to production, anyone can read the source and find the demo credentials. Fix: use environment variables or remove demo login before production.

### 3. Fake token fallback when API unreachable
**Severity:** MEDIUM (security)
**File:** `src/context/AuthContext.tsx:67-72`
When the API is unreachable, the demo login creates a fake token and lets the user "log in". This gives a false sense of authentication — the app shows the UI but no API calls will work. Fix: return false on API failure instead of creating a fake token.

### 4. Zero accessibility labels across all screens
**Severity:** MEDIUM (a11y)
**Files:** All screens (LoginScreen, SurveyScreen, DashboardScreen, CheckInScreen, SettingsScreen, ChatComponent)
No `accessibilityLabel` or `accessibilityRole` on any component. Screen readers (VoiceOver on iOS) cannot identify buttons, inputs, or content. Fix: add accessibilityLabel to all TouchableOpacity, TextInput, and key Text elements.

### 5. Empty catch block in haptics.ts
**Severity:** LOW (code quality)
**File:** `src/utils/haptics.ts:13`
```typescript
} catch (e) {}
```
Haptic feedback errors are silently swallowed. Acceptable for haptics (non-critical), but should at least log in debug mode.

### 6. DashboardScreen has 5 inline onPress functions
**Severity:** LOW (performance)
**File:** `src/screens/DashboardScreen.tsx`
Inline `onPress={() => ...}` creates new function instances on every render, causing child component re-renders. Minor impact for a dashboard, but should use useCallback for production.

---

## False Positives (from automated scan)

- **"SSE no timeout handler"** — FALSE POSITIVE. The XHR has `ontimeout` at line 199 and `xhr.timeout = 90000` at line 205. The scan missed these because they're on separate lines.
- **"SSE no timeout"** — FALSE POSITIVE. 90-second timeout is configured.
- **"AUTH no logout"** — FALSE POSITIVE. `logout()` function exists at line 119, calls `AsyncStorage.removeItem` at lines 120-121.
- **"AUTH no token removal"** — FALSE POSITIVE. `removeItem` is called for both `auth_token` and `auth_email`.
- **"SSE send stale closure"** — FALSE POSITIVE. `send` is in `useCallback` with `[endpoint, token, sessionId, parseSSEChunk]` deps at line 221.

---

## Redundancy Report

### Duplicated AsyncStorage key access
Both `AuthContext.tsx` and `SettingsScreen.tsx` independently call `AsyncStorage.getItem('auth_token')` to get the token. Should centralize token access through AuthContext only.

### Duplicated fetch header construction
The pattern `const token = await AsyncStorage.getItem('auth_token'); headers: token ? { Authorization: 'Bearer ' + token } : {}` appears in SettingsScreen (3 times) and DashboardScreen (1 time). Should be a shared `getAuthHeaders()` utility.

---

## Refactoring Roadmap

### Phase 1: Security (1 day)
1. Switch API to HTTPS (self-signed cert on nocbox-1 or ngrok tunnel)
2. Remove fake token fallback — return false on API failure
3. Move demo credentials to environment variables
4. Add `getAuthHeaders()` utility to AuthContext

### Phase 2: Accessibility (1 day)
5. Add `accessibilityLabel` and `accessibilityRole` to all interactive elements
6. Add `accessibilityHint` for complex actions (e.g., "Starts the survey")
7. Test with VoiceOver on iOS

### Phase 3: Performance (0.5 day)
8. Extract inline onPress functions to useCallback in DashboardScreen
9. Add `React.memo` to CardComponent for grid rendering

### Phase 4: Code Quality (0.5 day)
10. Add debug logging to empty catch in haptics.ts
11. Centralize AsyncStorage key constants
12. Add TypeScript interfaces for all API responses
