window.APP_CONFIG = {
  clientId: '',
  tenantId: 'organizations',
  redirectUri: window.location.href.split('#')[0],
  authorityHost: 'https://login.microsoftonline.com',
  scopes: ['User.Read', 'DeviceManagementManagedDevices.Read.All'],
  featureReportName: 'FeatureUpdateDeviceState',
  qualityReportName: ''
};
