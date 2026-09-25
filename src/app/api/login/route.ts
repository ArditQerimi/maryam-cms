import { NextRequest, NextResponse } from 'next/server';
import { authenticateLogin } from '@/lib/login-handler';
import { resolveRequestHostname, getCanonicalAdminHost } from '@/lib/admin-host';
import { logError } from '@/lib/app-logger';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const rawHost = request.headers.get('host') || request.nextUrl.host;
    const forwarded = request.headers.get('x-forwarded-host') || request.headers.get('x-forwarded-server');
    const forwardedProto = request.headers.get('x-forwarded-proto') || '';
    const isHttps = (forwardedProto.split(',')[0] || '').trim() === 'https' || request.nextUrl.protocol === 'https:';
    const requestHost = resolveRequestHostname(rawHost, forwarded);

    // Temporary debug: log host headers and resolved admin host to help diagnose admin login issues
    console.debug('[Login Debug] headers.host=', rawHost, 'headers.x-forwarded-host=', forwarded, 'resolvedHost=', requestHost, 'configuredAdminHost=', getCanonicalAdminHost());
    const { redirectTo, sessionToken } = await authenticateLogin(formData, requestHost);

    const response = new NextResponse(null, {
      status: 303,
      headers: {
        Location: redirectTo,
      },
    });

    if (sessionToken) {
      response.cookies.set({
        name: 'session',
        value: sessionToken,
        path: '/',
        httpOnly: true,
        secure: isHttps,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An error occurred during login';
    console.error('[Login API Error]', errorMessage);
    await logError('Login API Error', { error });
    
    // Determine the appropriate error code based on the error message
    let errorCode = 'server-error';
    if (errorMessage.includes('No company found') || errorMessage.includes('tenant context')) {
      errorCode = 'tenant-not-found';
    } else if (errorMessage.includes('Master database')) {
      errorCode = 'database-error';
    }

    const response = new NextResponse(null, {
      status: 303,
      headers: {
        Location: `/login?error=${errorCode}`,
      },
    });

    return response;
  }
}