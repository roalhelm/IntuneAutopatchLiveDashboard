const graphBaseUrl = 'https://graph.microsoft.com';
const storageKey = 'intuneAutopatchSpaConfig';
const rowColumns = [
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

const state = { dashboard: null, msalClient: null, account: null, config: null };

const e = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function renderNotice(message, isError = false) {
  e('notice').innerHTML = isError ? `<span class="error">${esc(message)}</span>` : esc(message);
}

function ensurePageDependencies() {
  if (!window.msal) throw new Error('MSAL konnte nicht geladen werden.');
  if (!window.JSZip) throw new Error('JSZip konnte nicht geladen werden.');
  if (!window.Papa) throw new Error('PapaParse konnte nicht geladen werden.');
}

function baseRedirectUri() {
  return `${window.location.origin}${window.location.pathname}`;
}

function loadSavedConfig() {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveConfig(config) {
  window.localStorage.setItem(storageKey, JSON.stringify(config));
}

function configFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('clientId') || '';
  const tenantId = params.get('tenantId') || '';
  const qualityReportName = params.get('qualityReportName') || '';
  if (!clientId && !tenantId && !qualityReportName) return {};
  return { clientId, tenantId, qualityReportName };
}

function normalizeConfig() {
  const defaults = {
    clientId: '',
    tenantId: 'organizations',
    redirectUri: baseRedirectUri(),
    authorityHost: 'https://login.microsoftonline.com',
    scopes: ['User.Read', 'DeviceManagementManagedDevices.Read.All'],
    featureReportName: 'FeatureUpdateDeviceState',
    qualityReportName: ''
  };
  const configured = window.APP_CONFIG || {};
  const saved = loadSavedConfig();
  const query = configFromQuery();
  const merged = { ...defaults, ...configured, ...saved, ...query };
  merged.redirectUri = merged.redirectUri || baseRedirectUri();
  merged.tenantId = merged.tenantId || 'organizations';
  merged.clientId = String(merged.clientId || '').trim();
  merged.qualityReportName = String(merged.qualityReportName || '').trim();
  return merged;
}

function hasAuthConfig(config) {
  return Boolean(config?.clientId);
}

function promptForConfig() {
  const current = state.config || normalizeConfig();
  const clientId = window.prompt('Bitte gib die Entra App (Client) ID ein:', current.clientId || '');
  if (!clientId) return null;
  const tenantId = window.prompt('Tenant (ID oder organizations):', current.tenantId || 'organizations');
  if (!tenantId) return null;
  const qualityReportName = window.prompt(
    'Optional: Quality Report Name (leer lassen, wenn nicht genutzt):',
    current.qualityReportName || ''
  );
  const updated = {
    ...current,
    clientId: clientId.trim(),
    tenantId: tenantId.trim(),
    qualityReportName: String(qualityReportName || '').trim(),
    redirectUri: baseRedirectUri()
  };
  saveConfig(updated);
  return updated;
}

function getAuthority(config) {
  return `${config.authorityHost.replace(/\/$/, '')}/${config.tenantId}`;
}

async function initializeMsalClient(config) {
  const client = new window.msal.PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: getAuthority(config),
      redirectUri: config.redirectUri
    },
    cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false }
  });
  if (typeof client.initialize === 'function') await client.initialize();
  await client.handleRedirectPromise();
  return client;
}

async function ensureMsalClient(interactive) {
  if (!state.config) state.config = normalizeConfig();

  if (!hasAuthConfig(state.config)) {
    if (!interactive) return false;
    const configured = promptForConfig();
    if (!configured) {
      renderNotice('Anmeldung abgebrochen. Bitte Client-ID und Tenant beim nächsten Versuch angeben.', true);
      return false;
    }
    state.config = configured;
  }

  if (!state.msalClient) {
    state.msalClient = await initializeMsalClient(state.config);
  }
  state.account = state.msalClient.getAllAccounts()[0] || null;
  return true;
}

async function signIn() {
  const ready = await ensureMsalClient(true);
  if (!ready) return;
  await state.msalClient.loginRedirect({ scopes: state.config.scopes, prompt: 'select_account' });
}

async function signOut() {
  if (!state.account || !state.msalClient) return;
  await state.msalClient.logoutRedirect({ account: state.account, postLogoutRedirectUri: state.config.redirectUri });
}

async function acquireToken() {
  if (!state.account) throw new Error('Kein Benutzerkonto angemeldet.');
  try {
    const result = await state.msalClient.acquireTokenSilent({ account: state.account, scopes: state.config.scopes });
    return result.accessToken;
  } catch (error) {
    if (error instanceof window.msal.InteractionRequiredAuthError) {
      await state.msalClient.acquireTokenRedirect({ account: state.account, scopes: state.config.scopes });
      return null;
    }
    throw error;
  }
}

async function graphRequest(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.error_description || `${response.status} ${response.statusText}`;
    throw new Error(`Graph-Fehler: ${detail}`);
  }
  return payload;
}

async function getManagedDevices(accessToken) {
  let next = `${graphBaseUrl}/v1.0/deviceManagement/managedDevices?$select=id,deviceName,operatingSystem,osVersion,complianceState,lastSyncDateTime,azureADDeviceId,serialNumber`;
  const devices = [];
  while (next) {
    const payload = await graphRequest(accessToken, next, { method: 'GET' });
    devices.push(...(payload.value || []));
    next = payload['@odata.nextLink'] || '';
  }
  return devices;
}

async function exportReport(accessToken, reportName) {
  const job = await graphRequest(accessToken, `${graphBaseUrl}/v1.0/deviceManagement/reports/exportJobs`, {
    method: 'POST',
    body: JSON.stringify({ reportName, format: 'csv' })
  });

  for (let index = 0; index < 30; index += 1) {
    await sleep(index === 0 ? 500 : 2000);
    const status = await graphRequest(
      accessToken,
      `${graphBaseUrl}/v1.0/deviceManagement/reports/exportJobs/${encodeURIComponent(job.id)}`,
      { method: 'GET' }
    );
    if (status.status === 'completed') return downloadCsvZip(status.url);
    if (status.status === 'failed') throw new Error(`Intune-Report ${reportName} ist fehlgeschlagen.`);
  }
  throw new Error(`Zeitüberschreitung beim Intune-Report ${reportName}.`);
}

async function downloadCsvZip(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.blob.core.windows.net')) {
    throw new Error('Nicht vertrauenswürdige Export-URL abgelehnt.');
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error('Download des Reports fehlgeschlagen.');
  const arrayBuffer = await response.arrayBuffer();
  const zip = await window.JSZip.loadAsync(arrayBuffer);
  const csvFileName = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith('.csv'));
  if (!csvFileName) throw new Error('Der Report enthält keine CSV-Datei.');
  const csv = await zip.file(csvFileName).async('string');
  const parsedCsv = window.Papa.parse(csv, { header: true, skipEmptyLines: true });
  if (parsedCsv.errors?.length) throw new Error('CSV-Parsing fehlgeschlagen.');
  return parsedCsv.data || [];
}

function first(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim()) return String(row[name]).trim();
  }
  return '';
}

function classify(row) {
  const text = Object.values(row).join(' ');
  if (/RemovedFromDeployment|No policy|nicht zugewiesen|policy.*conflict/i.test(text)) {
    return {
      severity: 'critical',
      category: 'Policy/Targeting',
      action: 'Autopatch-Gruppe, Feature-/Quality-Policy und konkurrierende GPO- oder ConfigMgr-Einstellungen prüfen.'
    };
  }
  if (/DiagnosticDataNotReceived|telemetry|diagnostic data/i.test(text)) {
    return { severity: 'high', category: 'Telemetrie', action: 'Diagnosedaten, Intune-Check-in und Gerätekonnektivität prüfen.' };
  }
  if (/Safeguard|Not Ready|Nicht bereit|InstallSetupBlock|compatib/i.test(text)) {
    return {
      severity: 'high',
      category: 'Readiness/Kompatibilität',
      action: 'Safeguard Hold, Appraiser, Treiber, Hardware und Speicherplatz prüfen.'
    };
  }
  if (/DeviceOffline|Download|network|proxy/i.test(text)) {
    return {
      severity: 'high',
      category: 'Netzwerk/Download',
      action: 'Windows-Update-Endpunkte, Proxy, HTTP Range, Delivery Optimization und Online-Status prüfen.'
    };
  }
  if (/Failed|InstallIssue|Error|Fehler|0x[0-9a-f]+/i.test(text)) {
    return {
      severity: 'high',
      category: 'Windows Servicing',
      action: 'WindowsUpdate.log, CBS.log und Setup-/Panther-Logs prüfen. OfferReady trennt Intune-Delivery von lokaler OS-Installation.'
    };
  }
  if (/Up to date|Succeeded|Success|Aktuell/i.test(text)) return { severity: 'ok', category: 'Aktuell', action: 'Keine Aktion erforderlich.' };
  if (/Installing|Offering|Pending|In progress/i.test(text)) {
    return { severity: 'info', category: 'In Bearbeitung', action: 'Client- und Service-Substate sowie Compliance-Frist beobachten.' };
  }
  return { severity: 'medium', category: 'Unklar', action: 'Gerätedetails, Statusfelder und Fehlercode prüfen.' };
}

function normalizeRows(rows, source) {
  return rows
    .map((row) => {
      const normalized = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, first(row, names)]));
      return { ...normalized, source, ...classify(normalized) };
    })
    .filter((entry) => entry.deviceName);
}

function summarize(rows) {
  const total = rows.length;
  const current = rows.filter((row) => row.severity === 'ok').length;
  const problems = rows.filter((row) => ['critical', 'high', 'medium'].includes(row.severity)).length;
  return { total, current, problems, compliancePercent: total ? Math.round((current * 1000) / total) / 10 : 0 };
}

function evaluateRows(rows) {
  const bySeverity = {};
  const byCategory = {};
  const bySource = {};
  for (const row of rows) {
    bySeverity[row.severity] = (bySeverity[row.severity] || 0) + 1;
    byCategory[row.category] = (byCategory[row.category] || 0) + 1;
    if (!bySource[row.source]) bySource[row.source] = [];
    bySource[row.source].push(row);
  }

  const topIssueCategories = Object.entries(byCategory)
    .filter(([category]) => category !== 'Aktuell')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  return {
    bySeverity,
    byCategory,
    bySource: Object.fromEntries(Object.entries(bySource).map(([source, sourceRows]) => [source, summarize(sourceRows)])),
    topIssueCategories
  };
}

function severityOrder(severity) {
  return ['critical', 'high', 'medium', 'info', 'ok'].indexOf(severity);
}

function filterRows(rows) {
  const search = e('filter').value.trim().toLowerCase();
  const source = e('sourceFilter').value;
  const severity = e('severityFilter').value;
  return rows.filter((row) => {
    const matchesSearch = !search || JSON.stringify(row).toLowerCase().includes(search);
    const matchesSource = !source || row.source === source;
    const matchesSeverity = !severity || row.severity === severity;
    return matchesSearch && matchesSource && matchesSeverity;
  });
}

function renderCards(summary) {
  const cards = [
    ['Datensätze', summary.total],
    ['Aktuell', summary.current],
    ['Probleme', summary.problems],
    ['Patch-Compliance', `${summary.compliancePercent} %`]
  ];
  e('cards').innerHTML = cards.map(([label, value]) => `<article class="card"><p>${esc(label)}</p><b>${esc(value)}</b></article>`).join('');
}

function renderList(targetId, items) {
  e(targetId).innerHTML = items.map((item) => `<li><span>${esc(item.label)}</span><b>${esc(item.value)}</b></li>`).join('');
}

function renderEvaluation(evaluations) {
  const severityEntries = Object.entries(evaluations.bySeverity || {})
    .sort((a, b) => severityOrder(a[0]) - severityOrder(b[0]))
    .map(([label, value]) => ({ label, value }));

  const categoryEntries = (evaluations.topIssueCategories || []).map((entry) => ({ label: entry.category, value: entry.count }));
  const sourceEntries = Object.entries(evaluations.bySource || {}).map(([source, summary]) => ({
    label: `${source} (${summary.compliancePercent} %)`,
    value: `${summary.current}/${summary.total}`
  }));

  renderList('severityBreakdown', severityEntries.length ? severityEntries : [{ label: 'Keine Daten', value: 0 }]);
  renderList('categoryBreakdown', categoryEntries.length ? categoryEntries : [{ label: 'Keine Daten', value: 0 }]);
  renderList('sourceBreakdown', sourceEntries.length ? sourceEntries : [{ label: 'Keine Daten', value: 0 }]);
}

function renderTable() {
  const rows = state.dashboard?.rows || [];
  const filtered = filterRows(rows);
  e('rows').innerHTML = filtered
    .map(
      (row) => `<tr class="${esc(row.severity)}">
        <td>${esc(row.deviceName)}</td>
        <td>${esc(row.source)}</td>
        <td>${esc(row.status)}</td>
        <td>${esc(row.osVersion)} → ${esc(row.targetVersion)}</td>
        <td>${esc(row.readiness)}</td>
        <td>${esc(row.category)}</td>
        <td>${esc([row.errorCode, row.alerts].filter(Boolean).join(' | '))}</td>
        <td>${esc(row.lastSync || row.managedDevice?.lastSyncDateTime)}</td>
        <td>${esc(row.action)}</td>
      </tr>`
    )
    .join('');
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function serializeRowsToCsv(rows) {
  const header = rowColumns.map(([, label]) => csvEscape(label)).join(',');
  const body = rows.map((row) => rowColumns.map(([key]) => csvEscape(row[key])).join(',')).join('\r\n');
  return `\uFEFF${header}\r\n${body}\r\n`;
}

function triggerCsvDownload(rows, kind) {
  const csv = serializeRowsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\..+$/, '');
  anchor.href = url;
  anchor.download = `intune-autopatch-${kind}-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function rowsByKind(kind) {
  if (!state.dashboard) return [];
  if (kind === 'feature') return state.dashboard.rows.filter((row) => row.source === 'Feature');
  if (kind === 'quality') return state.dashboard.rows.filter((row) => row.source === 'Quality');
  return state.dashboard.rows;
}

async function loadDashboard() {
  renderNotice('Intune-Berichte werden live angefordert …');
  const token = await acquireToken();
  if (!token) return;

  const warnings = [];
  const [devices, featureRows, qualityRows] = await Promise.all([
    getManagedDevices(token),
    exportReport(token, state.config.featureReportName),
    state.config.qualityReportName
      ? exportReport(token, state.config.qualityReportName).catch((error) => {
          warnings.push(`Quality-Report konnte nicht geladen werden: ${error.message}`);
          return [];
        })
      : Promise.resolve([])
  ]);

  const byId = new Map(devices.map((device) => [device.azureADDeviceId || device.id, device]));
  const rows = [...normalizeRows(featureRows, 'Feature'), ...normalizeRows(qualityRows, 'Quality')].map((row) => ({
    ...row,
    managedDevice: byId.get(row.deviceId) || null
  }));
  const evaluations = evaluateRows(rows);
  const summary = summarize(rows);

  state.dashboard = { rows, evaluations, summary, generatedAt: new Date().toISOString(), warnings };
  const qualityNote = state.config.qualityReportName ? '' : ' | Quality-Report ist noch nicht tenant-spezifisch konfiguriert.';
  const warningText = warnings.length ? ` | Hinweise: ${warnings.join(' | ')}` : '';
  renderNotice(`Datenstand: ${new Date(state.dashboard.generatedAt).toLocaleString()}${qualityNote}${warningText}`);
  renderCards(summary);
  renderEvaluation(evaluations);
  renderTable();
}

function syncAuthUi() {
  e('signin').hidden = Boolean(state.account);
  e('signout').hidden = !state.account;
  e('user').textContent = state.account?.name || state.account?.username || '';
  if (!state.account) {
    if (!hasAuthConfig(state.config)) {
      renderNotice('Klicke auf „Mit Microsoft anmelden“. Danach wirst du einmalig nach Client-ID und Tenant gefragt.');
    } else {
      renderNotice('Bitte mit einem berechtigten Entra-ID-Benutzer anmelden.');
    }
  }
}

function wireEvents() {
  e('signin').addEventListener('click', () => {
    signIn().catch((error) => renderNotice(error.message, true));
  });
  e('signout').addEventListener('click', () => {
    signOut().catch((error) => renderNotice(error.message, true));
  });
  e('refresh').addEventListener('click', () => {
    loadDashboard().catch((error) => renderNotice(error.message, true));
  });
  e('filter').addEventListener('input', renderTable);
  e('sourceFilter').addEventListener('change', renderTable);
  e('severityFilter').addEventListener('change', renderTable);
  e('exportFeature').addEventListener('click', () => triggerCsvDownload(rowsByKind('feature'), 'feature'));
  e('exportQuality').addEventListener('click', () => triggerCsvDownload(rowsByKind('quality'), 'quality'));
  e('exportCombined').addEventListener('click', () => triggerCsvDownload(rowsByKind('combined'), 'combined'));
  e('exportFiltered').addEventListener('click', () => triggerCsvDownload(filterRows(rowsByKind('combined')), 'filtered'));
}

async function bootstrap() {
  try {
    ensurePageDependencies();
    state.config = normalizeConfig();
    wireEvents();
    const ready = await ensureMsalClient(false);
    if (ready) {
      state.account = state.msalClient.getAllAccounts()[0] || null;
    }
    syncAuthUi();
    if (state.account) await loadDashboard();
  } catch (error) {
    renderNotice(error.message, true);
  }
}

bootstrap();
