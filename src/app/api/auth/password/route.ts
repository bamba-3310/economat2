import { type NextRequest, NextResponse } from "next/server";
import { changeLocalPassword } from "@/server/auth-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
    userId?: string;
  };

  if (!body.userId || !body.currentPassword || !body.newPassword) {
    return NextResponse.json(
      { error: "userId, currentPassword et newPassword sont requis." },
      { status: 400 },
    );
  }

  const result = await changeLocalPassword({
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
    userId: body.userId,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
