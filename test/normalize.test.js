import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRows, summarize, classify, evaluateRows } from '../src/normalize.js';

test('normalisiert Feature-Update-Bericht', () => {
  const [row] = normalizeRows([
    {
      DeviceName: 'PC01',
      OSVersion: '24H2',
      TargetOSVersion: '25H2',
      FUStatusLevel1Name: 'Not Up To Date',
      FUAlerts: 'Safeguard hold'
    }
  ]);
  assert.equal(row.deviceName, 'PC01');
  assert.equal(row.category, 'Readiness/Kompatibilität');
});

test('erkennt Policy-Targeting', () => {
  assert.equal(classify({ x: 'RemovedFromDeployment' }).category, 'Policy/Targeting');
});

test('berechnet Compliance', () => {
  assert.equal(summarize([{ severity: 'ok' }, { severity: 'high' }]).compliancePercent, 50);
});

test('leere Liste bleibt stabil', () => {
  assert.deepEqual(summarize([]), { total: 0, current: 0, problems: 0, compliancePercent: 0 });
});

test('erstellt Auswertungsblöcke', () => {
  const rows = [
    { severity: 'high', category: 'Readiness/Kompatibilität', source: 'Feature' },
    { severity: 'ok', category: 'Aktuell', source: 'Feature' },
    { severity: 'critical', category: 'Policy/Targeting', source: 'Quality' }
  ];
  const result = evaluateRows(rows);

  assert.equal(result.bySeverity.high, 1);
  assert.equal(result.bySeverity.ok, 1);
  assert.equal(result.bySeverity.critical, 1);
  assert.equal(result.bySource.Feature.total, 2);
  assert.equal(result.bySource.Quality.total, 1);
  assert.equal(result.topIssueCategories[0].category, 'Readiness/Kompatibilität');
});
