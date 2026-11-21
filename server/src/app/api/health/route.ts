import { NextResponse } from 'next/server';
import { hasSupabaseEnv } from '@/lib/env';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'park-busan-api',
    dataSource: hasSupabaseEnv() ? 'supabase' : 'mock',
    timestamp: new Date().toISOString(),
  });
}
