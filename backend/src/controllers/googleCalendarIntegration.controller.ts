import { Request, Response } from 'express';
import { google } from 'googleapis';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';
import {
  getAuthorizationUrl,
  getOAuth2Client,
  isGoogleCalendarConfigured,
  verifyOAuthStateToken
} from '../services/googleCalendar/googleCalendarOAuth.service';

function frontendBase(): string {
  return (process.env.FRONTEND_URL?.trim() || 'http://localhost:5173').replace(/\/$/, '');
}

/** GET /integrations/google-calendar/status */
export async function getStatus(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  if (!isGoogleCalendarConfigured()) {
    res.json({
      configuredOnServer: false,
      connected: false,
      syncEnabled: false,
      googleEmail: null as string | null,
      calendarId: 'primary'
    });
    return;
  }
  try {
    const row = await prisma.googleCalendarIntegration.findUnique({
      where: { usuario_id: userId }
    });
    res.json({
      configuredOnServer: true,
      connected: !!row,
      syncEnabled: row?.sync_enabled ?? false,
      googleEmail: row?.google_email ?? null,
      calendarId: row?.calendar_id ?? 'primary',
      migrationRequired: false
    });
  } catch (e) {
    console.error('[GoogleCalendar] getStatus', e);
    const msg = e instanceof Error ? e.message : String(e);
    const missingTable =
      (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') ||
      /google_calendar_integrations|does not exist|relation.*does not exist/i.test(msg);
    if (missingTable) {
      res.json({
        configuredOnServer: true,
        connected: false,
        syncEnabled: false,
        googleEmail: null,
        calendarId: 'primary',
        migrationRequired: true
      });
      return;
    }
    throw e;
  }
}

/** GET /integrations/google-calendar/auth-url — inicia OAuth */
export async function getAuthUrl(req: AuthRequest, res: Response): Promise<void> {
  if (!isGoogleCalendarConfigured()) {
    throw new AppError('Integração Google Calendar não está configurada no servidor.', 503);
  }
  const url = getAuthorizationUrl(req.userId!);
  res.json({ url });
}

/**
 * GET /integrations/google-calendar/callback — público (redirect do Google)
 * Query: code, state, error
 */
export async function oauthCallback(req: Request, res: Response): Promise<void> {
  const base = `${frontendBase()}/configuracoes/integracoes/google-calendar`;
  const { code, state, error } = req.query;
  if (error) {
    res.redirect(`${base}?error=${encodeURIComponent(String(error))}`);
    return;
  }
  if (!code || !state) {
    res.redirect(`${base}?error=${encodeURIComponent('parametros_invalidos')}`);
    return;
  }
  let userId: string;
  try {
    const v = verifyOAuthStateToken(String(state));
    userId = v.userId;
  } catch {
    res.redirect(`${base}?error=${encodeURIComponent('state_invalido')}`);
    return;
  }
  if (!isGoogleCalendarConfigured()) {
    res.redirect(`${base}?error=${encodeURIComponent('nao_configurado')}`);
    return;
  }
  try {
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(String(code));
    if (!tokens.access_token) {
      throw new Error('Google não retornou access_token');
    }
    oauth2.setCredentials(tokens);

    let email: string | null = null;
    try {
      const oauth2User = google.oauth2({
        version: 'v2',
        auth: oauth2 as unknown as Parameters<typeof google.oauth2>[0] extends { auth?: infer A } ? A : never
      });
      const { data: userInfo } = await oauth2User.userinfo.get();
      email = userInfo.email ?? null;
    } catch (infoErr) {
      console.warn('[GoogleCalendar] userinfo (email) falhou — seguindo sem e-mail na UI:', (infoErr as Error)?.message);
    }

    const existing = await prisma.googleCalendarIntegration.findUnique({
      where: { usuario_id: userId }
    });

    await prisma.googleCalendarIntegration.upsert({
      where: { usuario_id: userId },
      create: {
        usuario_id: userId,
        google_email: email,
        calendar_id: 'primary',
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token ?? null,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        sync_enabled: true
      },
      update: {
        google_email: email ?? existing?.google_email,
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        sync_enabled: true
      }
    });
    res.redirect(`${base}?connected=1`);
  } catch (e) {
    const { errKey, logLine } = classifyGoogleOAuthCallbackError(e);
    console.error('[GoogleCalendar] oauthCallback', logLine);
    res.redirect(`${base}?error=${encodeURIComponent(errKey)}`);
  }
}

/** Extrai erro da API OAuth do Google (token endpoint devolve JSON em response.data, às vezes string). */
function classifyGoogleOAuthCallbackError(e: unknown): { errKey: string; logLine: string } {
  const a = e as {
    response?: { data?: unknown };
    message?: string;
    errors?: unknown;
  };
  let data: unknown = a.response?.data;
  if (typeof data === 'string') {
    const str = data;
    try {
      data = JSON.parse(str) as { error?: string; error_description?: string };
    } catch {
      const q = new URLSearchParams(str);
      const err = q.get('error');
      if (err) data = { error: err, error_description: q.get('error_description') || undefined };
    }
  }
  const d = data as { error?: string; error_description?: string } | undefined;
  const googleErr = typeof d?.error === 'string' ? d.error : undefined;
  const googleDesc = typeof d?.error_description === 'string' ? d.error_description : undefined;
  const msg = e instanceof Error ? e.message : String(e);
  const logLine = [googleErr, googleDesc, msg].filter(Boolean).join(' | ');

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return { errKey: 'database', logLine: `prisma ${e.code}: ${e.message}` };
  }
  if (googleErr === 'redirect_uri_mismatch') return { errKey: 'redirect_uri_mismatch', logLine };
  if (googleErr === 'invalid_grant') return { errKey: 'invalid_grant', logLine };
  if (googleErr === 'invalid_client') return { errKey: 'invalid_client', logLine };
  if (/invalid_grant/i.test(msg)) return { errKey: 'invalid_grant', logLine };
  if (/redirect_uri/i.test(msg) && /mismatch/i.test(msg)) return { errKey: 'redirect_uri_mismatch', logLine };
  return { errKey: 'troca_token', logLine: logLine || msg };
}

/** POST /integrations/google-calendar/disconnect */
export async function disconnect(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  await prisma.googleCalendarIntegration.deleteMany({ where: { usuario_id: userId } });
  res.json({ success: true });
}

/** PATCH /integrations/google-calendar — sync_enabled */
export async function patchSettings(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.userId!;
  const body = req.body as { sync_enabled?: boolean };
  const integ = await prisma.googleCalendarIntegration.findUnique({
    where: { usuario_id: userId }
  });
  if (!integ) throw new AppError('Google Calendar não conectado.', 404);
  if (typeof body.sync_enabled !== 'boolean') {
    throw new AppError('Informe sync_enabled (boolean).', 400);
  }
  await prisma.googleCalendarIntegration.update({
    where: { usuario_id: userId },
    data: { sync_enabled: body.sync_enabled }
  });
  res.json({ sync_enabled: body.sync_enabled });
}
