const aliases = {
  deviceName: ['DeviceName', 'Device name', 'Gerätename'],
  osVersion: ['OSVersion', 'CurrentVersion', 'Current version', 'Aktuelle Version'],
  targetVersion: ['TargetOSVersion', 'TargetVersion', 'Release', 'Zielversion'],
  status: ['FUStatusLevel1Name', 'UpdateStatus', 'Update status', 'Updatestatus', 'Status'],
  readiness: ['DeviceReadiness', 'Readiness', 'Bereitschaft'],
  alerts: ['FUAlerts', 'Alerts', 'Warnungen'],
  errorCode: ['FUErrorCode', 'HexErrorCode', 'Hex error code', 'Fehlercode'],
  serviceState: ['FUServiceState', 'ServiceState', 'Service state'],
  serviceSubstate: ['FUServiceSubstate', 'ServiceSubstate', 'Service substate'],
  clientState: ['FUClientState', 'ClientState', 'Client state'],
  clientSubstate: ['FUClientSubstate', 'ClientSubstate', 'Client substate'],
  lastSync: ['LastIntuneSyncDateTimeUtc', 'LastContact', 'Last sync', 'Intune last check-in time'],
  deviceId: ['AADDeviceId', 'DeviceId', 'Microsoft Entra device ID'],
  serialNumber: ['SerialNumber', 'Serial number'],
  ring: ['PhaseName', 'DeploymentRing', 'AutopatchGroup', 'Autopatch group']
};

function first(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim()) {
      return String(row[name]).trim();
    }
  }
  return '';
}

function includesPattern(text, pattern) {
  return pattern.test(text);
}

export function classify(row) {
  const text = Object.values(row).join(' ');
  if (includesPattern(text, /RemovedFromDeployment|No policy|nicht zugewiesen|policy.*conflict/i)) {
    return {
      severity: 'critical',
      category: 'Policy/Targeting',
      action: 'Autopatch-Gruppe, Feature-/Quality-Policy und konkurrierende GPO- oder ConfigMgr-Einstellungen prüfen.'
    };
  }
  if (includesPattern(text, /DiagnosticDataNotReceived|telemetry|diagnostic data/i)) {
    return {
      severity: 'high',
      category: 'Telemetrie',
      action: 'Diagnosedaten, Intune-Check-in und Gerätekonnektivität prüfen.'
    };
  }
  if (includesPattern(text, /Safeguard|Not Ready|Nicht bereit|InstallSetupBlock|compatib/i)) {
    return {
      severity: 'high',
      category: 'Readiness/Kompatibilität',
      action: 'Safeguard Hold, Appraiser, Treiber, Hardware und Speicherplatz prüfen.'
    };
  }
  if (includesPattern(text, /DeviceOffline|Download|network|proxy/i)) {
    return {
      severity: 'high',
      category: 'Netzwerk/Download',
      action: 'Windows-Update-Endpunkte, Proxy, HTTP Range, Delivery Optimization und Online-Status prüfen.'
    };
  }
  if (includesPattern(text, /Failed|InstallIssue|Error|Fehler|0x[0-9a-f]+/i)) {
    return {
      severity: 'high',
      category: 'Windows Servicing',
      action: 'WindowsUpdate.log, CBS.log und Setup-/Panther-Logs prüfen. OfferReady trennt Intune-Delivery von lokaler OS-Installation.'
    };
  }
  if (includesPattern(text, /Up to date|Succeeded|Success|Aktuell/i)) {
    return { severity: 'ok', category: 'Aktuell', action: 'Keine Aktion erforderlich.' };
  }
  if (includesPattern(text, /Installing|Offering|Pending|In progress/i)) {
    return {
      severity: 'info',
      category: 'In Bearbeitung',
      action: 'Client- und Service-Substate sowie Compliance-Frist beobachten.'
    };
  }
  return { severity: 'medium', category: 'Unklar', action: 'Gerätedetails, Statusfelder und Fehlercode prüfen.' };
}

export function normalizeRows(rows, source = 'Feature') {
  return rows
    .map((row) => {
      const normalized = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, first(row, names)]));
      return { ...normalized, source, ...classify(normalized) };
    })
    .filter((entry) => entry.deviceName);
}

export function summarize(rows) {
  const total = rows.length;
  const current = rows.filter((row) => row.severity === 'ok').length;
  const problems = rows.filter((row) => ['critical', 'high', 'medium'].includes(row.severity)).length;
  return { total, current, problems, compliancePercent: total ? Math.round((current * 1000) / total) / 10 : 0 };
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

export function evaluateRows(rows) {
  const bySeverity = {};
  const byCategory = {};
  const bySource = {};

  for (const row of rows) {
    increment(bySeverity, row.severity || 'unknown');
    increment(byCategory, row.category || 'Unklar');

    if (!bySource[row.source]) bySource[row.source] = [];
    bySource[row.source].push(row);
  }

  const sourceSummaries = Object.fromEntries(Object.entries(bySource).map(([source, sourceRows]) => [source, summarize(sourceRows)]));
  const topIssueCategories = Object.entries(byCategory)
    .filter(([category]) => category !== 'Aktuell')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  return {
    bySeverity,
    byCategory,
    bySource: sourceSummaries,
    topIssueCategories
  };
}
