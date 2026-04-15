import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "keep-alive-ping-bot",
    timestamp: new Date().toISOString(),
  });
}
