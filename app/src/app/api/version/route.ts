import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  });
}
