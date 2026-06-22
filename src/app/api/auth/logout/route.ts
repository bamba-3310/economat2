import { NextResponse } from "next/server";
// WHEN/WHY: logs out the single active session (frees the single-session lock on
// Django) and clears the JWT cookies. Added with the single-session feature.
import { logoutSession } from "@/server/auth-service";

export const runtime = "nodejs";

export async function POST() {
  const result = await logoutSession();
  return NextResponse.json(result);
}
