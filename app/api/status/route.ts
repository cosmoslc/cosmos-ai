import { NextRequest, NextResponse } from "next/server";
import { buildGroupStatus } from "@/lib/material-status";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const groupId = req.nextUrl.searchParams.get("groupId");
    const lessonsPerWeek = Number(req.nextUrl.searchParams.get("lessonsPerWeek")) || 3;
    if (!groupId) return NextResponse.json({ error: "Guruh tanlanmagan." }, { status: 400 });
    return NextResponse.json(await buildGroupStatus(groupId, lessonsPerWeek));
  } catch (err) {
    console.error("Status API xatosi:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Holatni hisoblashda xato." }, { status: 500 });
  }
}
