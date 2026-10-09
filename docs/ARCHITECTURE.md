# Architektur und Akzeptanzkriterien (SPA)

## Zielbild

Das Dashboard läuft als statische Single Page Application auf GitHub Pages und verwendet OAuth 2.0 Authorization Code mit PKCE über MSAL Browser.

## Komponenten

- [index.html](C:/Dev/IntuneAutopatchLiveDashboard/public/index.html): UI-Struktur
- [style.css](C:/Dev/IntuneAutopatchLiveDashboard/public/style.css): Layout und Design
- [config.js](C:/Dev/IntuneAutopatchLiveDashboard/public/config.js): Laufzeitkonfiguration
- [app.js](C:/Dev/IntuneAutopatchLiveDashboard/public/app.js): Auth, Graph-Aufrufe, Auswertung, CSV-Export

## Datenfluss

Browser → Entra-Anmeldung (MSAL Browser/PKCE) → Access Token im Browser-Cache → Microsoft Graph (`managedDevices`, `reports/exportJobs`) → clientseitige Normalisierung/Klassifizierung → UI + CSV.

## Trust Boundaries

1. Browser und Microsoft Entra ID
2. Browser und Microsoft Graph
3. temporäre Azure-Blob-Export-URL aus `exportJobs`

Die Export-URL wird nur akzeptiert, wenn sie HTTPS verwendet und der Host auf `.blob.core.windows.net` endet.

## Berechtigungsmodell

- Delegierte Rechte pro angemeldetem Benutzer.
- App-Berechtigung allein reicht nicht aus; effektive Sichtbarkeit hängt zusätzlich von Intune RBAC und Scope-Kontext ab.

## Akzeptanzkriterien

- App funktioniert ohne Backend und ohne Client Secret.
- Anmeldung/Abmeldung über Entra funktioniert mit SPA-Redirect-URI.
- Feature-Report und optional Quality-Report werden aus Graph geladen.
- Auswertung und Filterung laufen clientseitig.
- CSV-Export ist je Auswertung sowie für die gefilterte Ansicht verfügbar.
