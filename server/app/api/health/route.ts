import { getParkingDataSource } from '@/src/lib/env';
import { providerNames } from '@/lib/providers.ts';

export function GET() {
  const timestamp = new Date().toISOString();
  return Response.json({
    status: 'ok',
    service: 'park-busan-api',
    dataSource: getParkingDataSource(),
    providers: providerNames,
    timestamp,
    time: timestamp,
  });
}
