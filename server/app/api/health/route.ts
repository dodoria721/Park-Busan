import { providerNames } from '@/lib/providers.ts';

export function GET() {
  return Response.json({ status: 'ok', providers: providerNames, time: new Date().toISOString() });
}
