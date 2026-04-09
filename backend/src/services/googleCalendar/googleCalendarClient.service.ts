import { google } from 'googleapis';
import { prisma } from '../../lib/prisma';
import { getOAuth2Client } from './googleCalendarOAuth.service';
import type { GoogleCalendarIntegration } from '@prisma/client';

export type CalendarContext = {
  calendar: ReturnType<typeof google.calendar>;
  integration: GoogleCalendarIntegration;
};

/** googleapis + google-auth-library OAuth2Client types diverge; runtime is compatible. */
const calendarAuth = (oauth2: ReturnType<typeof getOAuth2Client>) =>
  oauth2 as unknown as Parameters<typeof google.calendar>[0]['auth'];

/**
 * Retorna cliente Calendar API com tokens válidos.
 * Com refresh_token, renova o access_token antes de cada uso (evita "Login Required" com token velho/inválido).
 */
export async function getCalendarContextForUser(usuarioId: string): Promise<CalendarContext | null> {
  const integ = await prisma.googleCalendarIntegration.findUnique({
    where: { usuario_id: usuarioId }
  });
  if (!integ || !integ.sync_enabled) return null;

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: integ.access_token,
    refresh_token: integ.refresh_token ?? undefined,
    expiry_date: integ.token_expiry?.getTime()
  });

  let integration: GoogleCalendarIntegration = integ;

  try {
    if (integ.refresh_token) {
      const { credentials } = await oauth2.refreshAccessToken();
      integration = await prisma.googleCalendarIntegration.update({
        where: { id: integ.id },
        data: {
          access_token: credentials.access_token!,
          refresh_token: credentials.refresh_token ?? integ.refresh_token,
          token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null
        }
      });
      oauth2.setCredentials(credentials);
    } else {
      await oauth2.getAccessToken();
    }
  } catch (e) {
    console.error('[GoogleCalendar] refresh/getAccessToken', e);
    await prisma.googleCalendarIntegration.update({
      where: { id: integ.id },
      data: { sync_enabled: false }
    });
    return null;
  }

  const calendar = google.calendar({ version: 'v3', auth: calendarAuth(oauth2) });
  return { calendar, integration };
}
