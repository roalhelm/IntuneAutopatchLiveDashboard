# Berechtigungen

## Delegierte Microsoft-Graph-Berechtigungen

| Berechtigung | Zweck |
|---|---|
| `User.Read` | Anzeige des angemeldeten Kontos |
| `DeviceManagementManagedDevices.Read.All` | Intune-Geräte und Gerätereports lesen |

Es werden keine ReadWrite-, PrivilegedOperations-, Directory.Read.All- oder WindowsUpdate.ReadWrite.All-Berechtigungen angefordert.

## Zusätzliches Intune RBAC

Delegierte Graph-Berechtigungen ersetzen Intune RBAC nicht. Der angemeldete Benutzer benötigt eine Intune-Rolle, deren Scope Groups und Scope Tags die gewünschten Geräte und Reports abdecken.

## Consent

Die Intune-Berechtigung benötigt Administratorzustimmung. Die App sollte im Admin-Consent-Prozess technisch bewertet und regelmäßig überprüft werden.
