import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { config } from './config.js';
import { buildDashboardSnapshot } from './dashboard.js';
import { createAuthClient, beginSignIn, completeSignIn, getAccessToken, requireAuth, signOut } from './auth.js';
import { exportFilename, filterRows, serializeRowsToCsv } from './csv.js';

const app = express();
const authClient = createAuthClient(config);

app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"]
      }
    }
  })
);
app.use(express.json({ limit: '50kb' }));
app.use(
  session({
    name: 'ap.sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000
    }
  })
);
app.use(express.static('public', { maxAge: config.nodeEnv === 'production' ? '1h' : 0 }));

app.get('/auth/signin', async (req, res, next) => {
  try {
    await beginSignIn(req, res, authClient, config);
  } catch (error) {
    next(error);
  }
});

app.get('/auth/callback', async (req, res, next) => {
  try {
    await completeSignIn(req, res, authClient, config);
  } catch (error) {
    next(error);
  }
});

app.post('/auth/signout', signOut);

app.get('/api/me', (req, res) => res.json(req.session.user || null));

app.get('/api/dashboard', requireAuth, async (req, res, next) => {
  try {
    const accessToken = await getAccessToken(req, authClient);
    const snapshot = await buildDashboardSnapshot(accessToken, req.session.user.homeAccountId, config, {
      forceRefresh: req.query.cached !== '1'
    });
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

app.get('/api/exports/:kind.csv', requireAuth, async (req, res, next) => {
  try {
    const kind = String(req.params.kind || '').toLowerCase();
    if (!['feature', 'quality', 'combined'].includes(kind)) {
      return res.status(400).json({ error: 'Ungültige Exportart. Erlaubt sind feature, quality oder combined.' });
    }

    const accessToken = await getAccessToken(req, authClient);
    const snapshot = await buildDashboardSnapshot(accessToken, req.session.user.homeAccountId, config, {
      forceRefresh: req.query.refresh === '1'
    });

    const sourceRows =
      kind === 'feature'
        ? snapshot.rowsBySource.feature
        : kind === 'quality'
          ? snapshot.rowsBySource.quality
          : snapshot.rowsBySource.combined;

    const rows = filterRows(sourceRows, {
      q: req.query.q,
      source: kind === 'combined' ? req.query.source : undefined,
      severity: req.query.severity
    });

    const csv = serializeRowsToCsv(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename(kind, snapshot.generatedAt)}"`);
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(
    JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      message: error.message,
      status: error.response?.status || 500
    })
  );
  res.status(error.response?.status || 500).json({
    error: 'Abfrage fehlgeschlagen.',
    detail: config.nodeEnv === 'development' ? error.message : undefined
  });
});

app.listen(config.port, () => {
  console.log(`Dashboard läuft auf ${config.baseUrl}`);
});
