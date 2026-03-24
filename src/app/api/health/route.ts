import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const configured =
    !!apiKey && apiKey !== 'sk-ant-your-key-here' && apiKey.length > 10;

  return NextResponse.json({ configured });
}
