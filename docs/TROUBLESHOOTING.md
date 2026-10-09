# Troubleshooting (SPA / GitHub Pages)

## Anmeldung schlägt fehl (AADSTS-Fehler)

- Redirect URI in Entra muss exakt zur laufenden URL passen.
- In Entra muss die URI als **SPA Redirect URI** eingetragen sein.
- `clientId` und `tenantId` in [config.js](C:/Dev/IntuneAutopatchLiveDashboard/public/config.js) prüfen.

## Nach Login keine Daten / 403

- Admin Consent für `DeviceManagementManagedDevices.Read.All` prüfen.
- Intune RBAC, Scope Groups und Scope Tags des Users prüfen.
- Mit demselben Benutzer im Graph Explorer gegen dieselben Endpunkte testen.

## `FeatureUpdateDeviceState` schlägt fehl

- prüfen, ob der Bericht im Tenant verfügbar ist
- Report im Intune Portal einmal öffnen
- ExportJob-Laufzeit und Status prüfen

## Keine Quality-Daten

- `qualityReportName` in [config.js](C:/Dev/IntuneAutopatchLiveDashboard/public/config.js) ist leer oder nicht tenantkompatibel.
- Den korrekten Namen im Zieltenant verifizieren und erneut testen.

## CSV-Export leer

- Aktive Filter (`Suche`, `Quelle`, `Severity`) können alle Zeilen ausschließen.
- Testweise „Kombiniert“ ohne Filter exportieren.

## CORS-/Netzwerkfehler beim Report-Download

- Blob-Download-URL muss direkt aus dem ExportJob stammen.
- Browser-/Unternehmensproxy oder Security-Filter können den Download blockieren.

## Probleme nur bei bestimmten Nutzern

- Das ist bei delegierten Rechten erwartbar: unterschiedliche RBAC-/Scope-Rechte liefern unterschiedliche Ergebnisse.
