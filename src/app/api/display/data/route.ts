import { NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { getDisplayData } from "@/server/services/display.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await getDisplayData();
  return NextResponse.json(data);
}
