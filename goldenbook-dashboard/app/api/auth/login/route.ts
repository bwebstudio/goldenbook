import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "Deprecated login endpoint. Use the Supabase client session flow." },
    { status: 410 }
  );
}
