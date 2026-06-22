import { type NextRequest, NextResponse } from "next/server";
import { parseLotQrValue } from "@/lib/stock-engine";
import { scanLot } from "@/server/stock-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsedCode = parseLotQrValue(searchParams.get("code") ?? "");
  const parsedId = parseLotQrValue(searchParams.get("lotId") ?? "");
  const lotCode = parsedCode.lotCode ?? parsedId.lotCode;
  const lotId = parsedCode.lotId ?? parsedId.lotId;
  const quantityOut = Number(searchParams.get("quantityOut") ?? "1");

  const result = await scanLot({
    lotCode,
    lotId,
    quantityOut: Number.isFinite(quantityOut) ? quantityOut : 1,
  });

  return NextResponse.json(result, { status: result.found ? 200 : 404 });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    lotCode?: string;
    lotId?: string;
    quantityOut?: number;
    unknownScan?: boolean;
  };
  const parsedCode = parseLotQrValue(body.lotCode ?? "");
  const parsedId = parseLotQrValue(body.lotId ?? "");
  const result = await scanLot({
    ...body,
    lotCode: parsedCode.lotCode ?? parsedId.lotCode,
    lotId: parsedCode.lotId ?? parsedId.lotId,
  });

  return NextResponse.json(result, { status: result.found ? 200 : 404 });
}
