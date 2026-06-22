import { NextResponse } from "next/server";
import { djangoFetch } from "@/server/django";

export const runtime = "nodejs";

// WHEN/WHY: lightweight activity heartbeat. The frontend calls this while the
// user is active so Django bumps the session's `session_last_seen` (see
// SessionJWTAuthentication), keeping the single active session alive. When the
// user is idle (or the tab is closed) the heartbeat stops, the session goes
// stale, and it frees itself after SESSION_IDLE_TIMEOUT. /api/accounts/me/ is
// the cheapest authenticated endpoint that runs through the auth class.
export async function POST() {
  const result = await djangoFetch("/api/accounts/me/");
  return NextResponse.json({ ok: result.ok }, { status: result.ok ? 200 : 401 });
}
