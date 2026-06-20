import { NextResponse } from "next/server";
import { classifyMerchant } from "@/lib/ai/classifyMerchant";

export async function POST(request: Request) {
  const { merchantName } = await request.json();
  if (!merchantName || typeof merchantName !== "string") {
    return NextResponse.json({ error: "merchantName is required" }, { status: 400 });
  }

  try {
    const result = await classifyMerchant(merchantName);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Classification failed" },
      { status: 502 },
    );
  }
}
