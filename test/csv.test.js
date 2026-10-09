import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeRowsToCsv, filterRows, exportFilename } from '../src/csv.js';

test('serialisiert CSV mit Headern und BOM', () => {
  const csv = serializeRowsToCsv([
    {
      deviceName: 'PC01',
      source: 'Feature',
      status: 'Failed',
      osVersion: '24H2',
      targetVersion: '25H2',
      readiness: 'Not ready',
      severity: 'high',
      category: 'Readiness/Kompatibilität',
      errorCode: '0x1234',
      alerts: 'Safeguard',
      lastSync: '2026-10-09T10:00:00Z',
      ring: 'Fast',
      action: 'Prüfen'
    }
  ]);

  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"Gerät","Auswertung","Status"/);
  assert.match(csv, /"PC01","Feature","Failed"/);
});

test('filtert über Suchtext, Source und Severity', () => {
  const rows = [
    { deviceName: 'PC01', source: 'Feature', severity: 'high', text: 'alpha' },
    { deviceName: 'PC02', source: 'Quality', severity: 'ok', text: 'beta' }
  ];

  assert.equal(filterRows(rows, { q: 'pc01' }).length, 1);
  assert.equal(filterRows(rows, { source: 'quality' }).length, 1);
  assert.equal(filterRows(rows, { severity: 'ok' }).length, 1);
});

test('erstellt konsistenten Export-Dateinamen', () => {
  const name = exportFilename('feature', '2026-10-09T11:47:50.000Z');
  assert.match(name, /^intune-autopatch-feature-20261009-114750\.csv$/);
});
