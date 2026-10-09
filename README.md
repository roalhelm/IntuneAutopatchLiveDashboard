# Intune Autopatch Live Dashboard (GitHub Pages / SPA)

Clientseitiges Dashboard für Intune Autopatch mit Microsoft-Entra-Anmeldung über **MSAL Browser (PKCE)** und **ohne Client Secret**.

Die App läuft als statische Seite (GitHub Pages) und ruft Microsoft Graph direkt im Browser mit den delegierten Rechten des angemeldeten Benutzers auf.

## Highlights

- statisches Hosting auf GitHub Pages
- Anmeldung mit `@azure/msal-browser` (Public Client, PKCE)
- keine Server-Session, kein Client Secret
- Intune-Auswertung mit:
  - Gerätebestand (`managedDevices`)
  - Feature-Report (`FeatureUpdateDeviceState`)
  - optional Quality-Report
- CSV-Export:
  - Feature
  - Quality
  - Kombiniert
  - Aktuell gefilterte Ansicht

## Wichtige Sicherheits- und Betriebsaspekte

- Die App verwendet **delegierte Berechtigungen**: Sichtbarkeit und Zugriff hängen vom angemeldeten Benutzer + Intune RBAC ab.
- Für `DeviceManagementManagedDevices.Read.All` ist in der Regel **Admin Consent** nötig.
- Ohne Backend gibt es keine serverseitige Zugriffskontrolle, kein Secret-Management und keine serverseitige Audit-Schicht.
- `clientId` und `tenantId` sind in SPA-Szenarien nicht geheim.

## Setup für Entra App Registration

1. App Registration erstellen (Single- oder Multi-Tenant, je nach Zielgruppe).
2. Unter **Authentication** eine **Single-page application (SPA)** Redirect URI anlegen:
   - z. B. `https://<github-user>.github.io/<repository>/`
3. Delegierte Graph-Berechtigungen hinzufügen:
   - `User.Read`
   - `DeviceManagementManagedDevices.Read.All`
4. Admin Consent erteilen.
5. **Kein Client Secret** anlegen/verwenden.

## Repository konfigurieren

Für einen Login **ohne Eingabefenster** muss die App-ID einmalig im Repository hinterlegt sein:

1. [config.js](C:/Dev/IntuneAutopatchLiveDashboard/public/config.js) öffnen.
2. Werte setzen:
   - `clientId` (Pflicht)
   - `tenantId` (empfohlen, sonst `organizations`)
   - optional `qualityReportName`
3. Deployen und danach nur noch auf **„Mit Microsoft anmelden“** klicken.

Optional kannst du `clientId`/`tenantId` auch per URL übergeben (`?clientId=...&tenantId=...`), falls du dieselbe Build-Version in mehreren Tenants nutzen willst.

## GitHub Pages Deployment

1. Repository nach GitHub pushen.
2. In GitHub:
   - **Settings → Pages**
   - Source: Deploy from a branch
   - Branch: `main` (oder gewünschter Branch)
   - Folder: `/(root)` (GitHub Pages unterstützt nur `/(root)` oder `/docs`, nicht `/public`)
3. Warten bis die Site live ist.
4. Sicherstellen, dass genau diese URL als SPA Redirect URI in Entra hinterlegt ist.

## Lokales Testen (statisch)

Ein einfacher lokaler HTTP-Server reicht, z. B.:

```bash
npx serve public
```

Danach über die ausgegebene URL öffnen und Anmeldung testen.

## Troubleshooting (kurz)

- **Login-Fehler**: Redirect URI in Entra stimmt nicht exakt mit der laufenden URL überein.
- **403 / fehlende Daten**: Admin Consent oder Intune RBAC fehlt.
- **Keine Quality-Daten**: `qualityReportName` ist leer oder im Tenant nicht passend.
- **CSV leer**: aktive Filter liefern keine Treffer.

Zusätzliche Details in [TROUBLESHOOTING.md](C:/Dev/IntuneAutopatchLiveDashboard/docs/TROUBLESHOOTING.md).
