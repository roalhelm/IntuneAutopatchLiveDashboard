import axios from 'axios';
import unzipper from 'unzipper';
import { parse } from 'csv-parse/sync';

const GRAPH_BASE_URL = 'https://graph.microsoft.com';
const GRAPH_TIMEOUT_MS = 30000;
const EXPORT_POLL_ATTEMPTS = 30;
const EXPORT_POLL_INTERVAL_MS = 2000;
const graph = axios.create({ baseURL: GRAPH_BASE_URL, timeout: GRAPH_TIMEOUT_MS, maxRedirects: 0 });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeNextLink(nextLink) {
  return nextLink?.replace(GRAPH_BASE_URL, '') || '';
}

function parseRetryAfterSeconds(retryAfterHeader, fallbackSeconds) {
  const headerValue = Number.parseInt(String(retryAfterHeader ?? ''), 10);
  if (Number.isFinite(headerValue) && headerValue > 0) return headerValue;
  return fallbackSeconds;
}

async function request(accessToken, requestConfig, attempt = 0) {
  try {
    return await graph.request({
      ...requestConfig,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(requestConfig.headers || {})
      }
    });
  } catch (error) {
    const status = error.response?.status;
    if ((status === 429 || status >= 500) && attempt < 4) {
      const retryAfterSeconds = parseRetryAfterSeconds(error.response?.headers?.['retry-after'], 2 ** attempt);
      await sleep(Math.min(retryAfterSeconds, 30) * 1000);
      return request(accessToken, requestConfig, attempt + 1);
    }
    throw error;
  }
}

export async function getManagedDevices(accessToken) {
  let url = '/v1.0/deviceManagement/managedDevices?$select=id,deviceName,operatingSystem,osVersion,complianceState,lastSyncDateTime,azureADDeviceId,serialNumber';
  const devices = [];
  while (url) {
    const { data } = await request(accessToken, { method: 'GET', url });
    devices.push(...(data.value || []));
    url = normalizeNextLink(data['@odata.nextLink']);
  }
  return devices;
}

export async function exportReport(accessToken, reportName) {
  const { data: job } = await request(accessToken, {
    method: 'POST',
    url: '/v1.0/deviceManagement/reports/exportJobs',
    data: { reportName, format: 'csv' }
  });

  for (let attempt = 0; attempt < EXPORT_POLL_ATTEMPTS; attempt += 1) {
    await sleep(attempt === 0 ? 500 : EXPORT_POLL_INTERVAL_MS);
    const { data } = await request(accessToken, {
      method: 'GET',
      url: `/v1.0/deviceManagement/reports/exportJobs/${encodeURIComponent(job.id)}`
    });
    if (data.status === 'completed') return downloadReport(data.url);
    if (data.status === 'failed') throw new Error(`Intune-Report ${reportName} ist fehlgeschlagen.`);
  }
  throw new Error(`Zeitüberschreitung beim Intune-Report ${reportName}.`);
}

async function downloadReport(url) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.blob.core.windows.net')) {
    throw new Error('Nicht vertrauenswürdige Export-URL abgelehnt.');
  }

  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: GRAPH_TIMEOUT_MS, maxRedirects: 0 });
  const directory = await unzipper.Open.buffer(Buffer.from(response.data));
  const csvFile = directory.files.find((file) => file.path.toLowerCase().endsWith('.csv'));
  if (!csvFile) throw new Error('Der Report enthält keine CSV-Datei.');

  const csvContent = (await csvFile.buffer()).toString('utf8');
  return parse(csvContent, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });
}
