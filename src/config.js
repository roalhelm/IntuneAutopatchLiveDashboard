function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Fehlende Umgebungsvariable: ${name}`);
  return value;
}
export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  tenantId: required('TENANT_ID'),
  clientId: required('CLIENT_ID'),
  clientSecret: required('CLIENT_SECRET'),
  sessionSecret: required('SESSION_SECRET'),
  featureReportName: process.env.FEATURE_REPORT_NAME || 'FeatureUpdateDeviceState',
  qualityReportName: process.env.QUALITY_REPORT_NAME || ''
};
if (config.sessionSecret.length < 32) throw new Error('SESSION_SECRET muss mindestens 32 Zeichen lang sein.');
