import { NextResponse } from 'next/server';
export function GET() { return NextResponse.json({ status: 'ok', service: 'park-busan-api', timestamp: new Date().toISOString() }); }
