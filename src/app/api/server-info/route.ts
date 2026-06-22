import { networkInterfaces } from "node:os";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getLanAddresses() {
  return Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address);
}

function getPort(host: string, protocol: string) {
  const match = host.match(/:(\d+)$/);

  if (match?.[1]) return match[1];

  return protocol === "https" ? "443" : "80";
}

function getPortSuffix(port: string, protocol: string) {
  if ((protocol === "https" && port === "443") || (protocol === "http" && port === "80")) {
    return "";
  }

  return `:${port}`;
}

export function GET(request: NextRequest) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "") ??
    "http";
  const port = getPort(host, protocol);
  const portSuffix = getPortSuffix(port, protocol);
  const lanUrls = getLanAddresses().map(
    (address) => `${protocol}://${address}${portSuffix}`,
  );

  return NextResponse.json({
    ok: true,
    cameraRequiresHttps: true,
    generatedAt: new Date().toISOString(),
    hostUrl: `${protocol}://${host}`,
    isHttps: protocol === "https",
    lanUrls,
    port,
    protocol,
  });
}
