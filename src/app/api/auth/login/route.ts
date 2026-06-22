import { type NextRequest, NextResponse } from "next/server";
import { verifyLocalLogin } from "@/server/auth-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: "Email et mot de passe requis." },
      { status: 400 },
    );
  }

  const result = await verifyLocalLogin({
    email: body.email,
    password: body.password,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 401 });
  }

  return NextResponse.json(result);
}
