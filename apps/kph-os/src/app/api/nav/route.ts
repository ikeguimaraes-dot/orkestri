import { NextResponse } from "next/server";
import { NAV_CONFIG } from "@/lib/nav-config";

export const dynamic = "force-static";

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET() {
  return NextResponse.json(
    { groups: NAV_CONFIG },
    { headers: { ...CORS, "Cache-Control": "public, max-age=300, stale-while-revalidate=60" } },
  );
}
