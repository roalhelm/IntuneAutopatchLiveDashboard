import { getManagedDevices, exportReport } from './graph.js';
import { normalizeRows, summarize, evaluateRows } from './normalize.js';

const CACHE_TTL_MS = 2 * 60 * 1000;
const snapshotCache = new Map();

function cacheKeyForUser(userKey) {
  return `dashboard:${userKey || 'anonymous'}`;
}

function getCachedSnapshot(userKey) {
  const cacheKey = cacheKeyForUser(userKey);
  const snapshot = snapshotCache.get(cacheKey);
  if (!snapshot) return null;
  if (Date.now() - snapshot.cachedAt > CACHE_TTL_MS) {
    snapshotCache.delete(cacheKey);
    return null;
  }
  return snapshot.data;
}

function setCachedSnapshot(userKey, data) {
  snapshotCache.set(cacheKeyForUser(userKey), { cachedAt: Date.now(), data });
}

function attachManagedDevice(rows, deviceById) {
  return rows.map((row) => ({ ...row, managedDevice: deviceById.get(row.deviceId) || null }));
}

export async function buildDashboardSnapshot(accessToken, userKey, config, options = {}) {
  const forceRefresh = options.forceRefresh ?? true;
  if (!forceRefresh) {
    const cached = getCachedSnapshot(userKey);
    if (cached) return cached;
  }

  const warnings = [];
  const [devices, featureRows, qualityResult] = await Promise.all([
    getManagedDevices(accessToken),
    exportReport(accessToken, config.featureReportName),
    config.qualityReportName
      ? exportReport(accessToken, config.qualityReportName)
          .then((rows) => ({ rows, failed: false }))
          .catch((error) => ({ rows: [], failed: true, error }))
      : Promise.resolve({ rows: [], failed: false })
  ]);

  if (qualityResult.failed) {
    warnings.push(`Quality-Report konnte nicht geladen werden: ${qualityResult.error.message}`);
  }

  const featureNormalized = normalizeRows(featureRows, 'Feature');
  const qualityNormalized = normalizeRows(qualityResult.rows, 'Quality');
  const combinedBase = [...featureNormalized, ...qualityNormalized];
  const deviceById = new Map(devices.map((device) => [device.azureADDeviceId || device.id, device]));
  const combinedRows = attachManagedDevice(combinedBase, deviceById);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    summary: summarize(combinedRows),
    evaluations: evaluateRows(combinedRows),
    rowsBySource: {
      feature: attachManagedDevice(featureNormalized, deviceById),
      quality: attachManagedDevice(qualityNormalized, deviceById),
      combined: combinedRows
    },
    rows: combinedRows,
    devices,
    warnings,
    qualityReportConfigured: Boolean(config.qualityReportName)
  };

  setCachedSnapshot(userKey, snapshot);
  return snapshot;
}
