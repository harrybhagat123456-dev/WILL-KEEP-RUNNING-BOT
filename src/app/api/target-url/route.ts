import { NextResponse } from "next/server";
import { getTargetUrl } from "@/lib/state";

export async function GET() {
  return NextResponse.json({
    url: getTargetUrl(),
  });
}
