# Sicherheits- und Richtlinienbericht

| Prüfung | Status | Ergebnis |
|---|---|---|
| Delegated Auth | Bestanden | Authorization Code Flow mit PKCE |
| Least Privilege | Bestanden | Nur User.Read und ManagedDevices.Read.All |
| Token Exposure | Bestanden | Token bleibt serverseitig |
| CSRF/OAuth State | Bestanden | kryptografischer State und SameSite-Cookie |
| Session Cookie | Bestanden | HttpOnly, SameSite=Lax, Secure in Produktion |
| CSP/Headers | Bestanden | Helmet und lokale Assets |
| SSRF Export URL | Bestanden | HTTPS plus Blob-Host-Allowlist |
| Retry/Throttling | Bestanden | begrenztes Retry für 429 und 5xx |
| HTML Injection | Bestanden | Browser kodiert alle dynamischen Werte |
| Schreibende Aktionen | Bestanden | keine Remediation oder Graph-Schreiboperation |
| Client Secret lokal | Abweichung | Secret ist für lokale Web-App-Entwicklung vorgesehen. Produktion sollte Zertifikat oder Plattform-Identität verwenden. |
| Session Store | Abweichung | Express MemoryStore ist nicht produktionsgeeignet. Vor Produktion Redis/DB mit Verschlüsselung einsetzen. |
| Quality Report | Nicht prüfbar | exakter Reportname muss im Zieltenant verifiziert werden. |
| Tenant-Integration | Nicht prüfbar | kein Zugriff auf den Zieltenant in der Erstellungsumgebung. |
| Cloudflare Mehragenten-Audit | Abweichung | Isolierte Agentenorchestrierung ist hier nicht verfügbar. Manuelle Abdeckung: Auth, SSRF, XSS, CSRF, Secrets, Dependencies, Logging, Fehlerbehandlung. |

## Verbleibende Risiken

- Exportierte Intune-Daten können personenbezogene Geräte- und Benutzerbezüge enthalten.
- Die Klassifizierung gibt Triage-Hinweise, keine garantierte Ursache.
- Intune-Reporting ist nicht sekundengenau.
