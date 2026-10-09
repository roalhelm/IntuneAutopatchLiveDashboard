import crypto from 'node:crypto';
import { ConfidentialClientApplication } from '@azure/msal-node';

const scopes = ['openid', 'profile', 'offline_access', 'User.Read', 'DeviceManagementManagedDevices.Read.All'];

export function createAuthClient(config) {
  return new ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      clientSecret: config.clientSecret
    }
  });
}

export async function beginSignIn(req, res, authClient, config) {
  const state = crypto.randomBytes(24).toString('hex');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  req.session.auth = { state, verifier };
  const redirectUrl = await authClient.getAuthCodeUrl({
    scopes,
    redirectUri: `${config.baseUrl}/auth/callback`,
    state,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256'
  });
  res.redirect(redirectUrl);
}

export async function completeSignIn(req, res, authClient, config) {
  if (!req.session.auth || req.query.state !== req.session.auth.state) {
    throw new Error('Ungültiger OAuth-State.');
  }

  const result = await authClient.acquireTokenByCode({
    code: req.query.code,
    scopes,
    redirectUri: `${config.baseUrl}/auth/callback`,
    codeVerifier: req.session.auth.verifier
  });

  req.session.user = {
    name: result.account?.name || result.account?.username,
    username: result.account?.username,
    homeAccountId: result.account?.homeAccountId
  };
  delete req.session.auth;
  res.redirect('/');
}

export function signOut(req, res) {
  req.session.destroy(() => res.status(204).end());
}

export function requireAuth(req, res, next) {
  if (req.session.user) return next();
  return res.status(401).json({ error: 'Nicht angemeldet' });
}

export async function getAccessToken(req, authClient) {
  const accounts = await authClient.getTokenCache().getAllAccounts();
  const account = accounts.find((entry) => entry.homeAccountId === req.session.user.homeAccountId);
  if (!account) {
    throw new Error('Anmeldesitzung nicht im Token-Cache gefunden. Bitte erneut anmelden.');
  }

  const result = await authClient.acquireTokenSilent({ account, scopes });
  return result.accessToken;
}
