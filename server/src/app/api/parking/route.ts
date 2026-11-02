import { NextResponse } from 'next/server';
import { parkingService } from '@/services/parkingService';
export async function GET() { return NextResponse.json({ data: await parkingService.list() }); }
