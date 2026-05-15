import { NextResponse } from 'next/server';
import { health } from '@office/shared-domain';

export const dynamic = 'force-dynamic';

export async function GET() {
  const domain = await health();
  return NextResponse.json({
    ok: true,
    service: 'web' as const,
    domain,
  });
}
