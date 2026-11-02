import { NextResponse } from 'next/server';
import { parkingService } from '@/services/parkingService';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const parking = await parkingService.get(id); return parking ? NextResponse.json({ data: parking }) : NextResponse.json({ error: 'Parking lot not found' }, { status: 404 }); }
