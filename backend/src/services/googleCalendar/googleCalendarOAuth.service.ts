import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.events'
];

export function isGoogleCalendarConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const sec = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redir = process.env.GOOGLE_REDIRECT_URI?.trim();
  return Boolean(id && sec && redir);
}

export function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Calendar OAuth não configurado (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI).');
  }
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export function createOAuthStateToken(userId: string): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error('JWT_SECRET não configurado.');
  return jwt.sign({ sub: userId, typ: 'gcal_oauth' }, secret, { expiresIn: '10m' });
}

export function verifyOAuthStateToken(token: string): { userId: string } {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error('JWT_SECRET não configurado.');
  const p = jwt.verify(token, secret) as { sub: string; typ?: string };
  if (p.typ !== 'gcal_oauth') throw new Error('state inválido');
  return { userId: p.sub };
}

export function getAuthorizationUrl(userId: string): string {
  const o = getOAuth2Client();
  const state = createOAuthStateToken(userId);
  return o.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state
  });
}
