const columns = [
  ['deviceName', 'Gerät'],
  ['source', 'Auswertung'],
  ['status', 'Status'],
  ['osVersion', 'Ist-Version'],
  ['targetVersion', 'Ziel-Version'],
  ['readiness', 'Readiness'],
  ['severity', 'Severity'],
  ['category', 'Problemkategorie'],
  ['errorCode', 'Fehlercode'],
  ['alerts', 'Alerts'],
  ['lastSync', 'Letzter Sync'],
  ['ring', 'Ring'],
  ['action', 'Empfohlene Aktion']
];

function csvEscape(value) {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function filterRows(rows, filters = {}) {
  const search = String(filters.q || '').trim().toLowerCase();
  const source = String(filters.source || '').trim().toLowerCase();
  const severity = String(filters.severity || '').trim().toLowerCase();

  return rows.filter((row) => {
    const matchesSearch = !search || JSON.stringify(row).toLowerCase().includes(search);
    const matchesSource = !source || String(row.source || '').toLowerCase() === source;
    const matchesSeverity = !severity || String(row.severity || '').toLowerCase() === severity;
    return matchesSearch && matchesSource && matchesSeverity;
  });
}

export function serializeRowsToCsv(rows) {
  const header = columns.map(([, label]) => csvEscape(label)).join(',');
  const body = rows.map((row) => columns.map(([key]) => csvEscape(row[key])).join(',')).join('\r\n');
  return `\uFEFF${header}\r\n${body}\r\n`;
}

function timestampLabel(isoTimestamp) {
  return String(isoTimestamp || new Date().toISOString())
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .replace(/\..+$/, '');
}

export function exportFilename(kind, generatedAt) {
  const allowedKinds = new Set(['feature', 'quality', 'combined']);
  const normalizedKind = allowedKinds.has(kind) ? kind : 'combined';
  return `intune-autopatch-${normalizedKind}-${timestampLabel(generatedAt)}.csv`;
}
