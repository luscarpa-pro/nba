# NBA Studio — distribuzione locale su Windows

Versione **offline** del Lab, da installare sui singoli PC. Niente più online, niente
dati sensibili in cloud. Tutto gira in locale.

## In sintesi

- **Modello A (standalone)**: ogni tester ha `NBAStudio.exe`, doppio click → si apre
  il browser sull'app. Ogni PC ha il proprio database isolato.
- I dati (DB, sessioni, dataset/config modificati) stanno in `%APPDATA%\NBAStudio`.
- Per **condividere le considerazioni** si usa l'**export Excel** dal pannello Admin.

---

## 1. Compilare l'eseguibile (UNA volta sola)

L'`.exe` si crea su **una** macchina Windows con **Python 3.12**, poi si copia su tutti
gli altri PC (che non hanno bisogno di nulla).

1. Copia il repo sulla macchina Windows.
2. Doppio click su `tangible_lab\build_windows.bat` (o lancialo da prompt nella root del repo).
3. A fine build trovi l'eseguibile in `dist\NBAStudio.exe`.

> In alternativa, manualmente dalla root del repo:
> ```
> python -m pip install -r requirements.txt pyinstaller
> python -m PyInstaller --noconfirm --clean tangible_lab\nba_studio.spec
> ```

## 2. Installare sui PC dei tester

Copia `NBAStudio.exe` dove vuoi (Desktop, una cartella, ecc.) e fai **doppio click**.
- Parte un server locale e si apre il browser su `http://127.0.0.1:8000/lab/`.
- Resta aperta una finestra console nera: è normale, mostra i log. Chiuderla = chiudere l'app.
- **Login iniziale**: `admin` / `admin` (poi chiede di cambiare password). Database fresco e
  separato su ogni PC.

> **Avviso antivirus / SmartScreen**: essendo un `.exe` non firmato digitalmente, al primo
> avvio Windows può mostrare "Windows ha protetto il PC" → clicca **Maggiori informazioni** →
> **Esegui comunque**. Per eliminare l'avviso servirebbe una firma digitale (a pagamento).

## 3. Dove finiscono i dati

Tutto in `%APPDATA%\NBAStudio` (es. `C:\Users\<nome>\AppData\Roaming\NBAStudio`):
- `tangible_lab.db` — utenti, casi salvati, review, commenti, casi Check-up
- `.secret` — chiave delle sessioni (così il login sopravvive ai riavvii)
- `dataset.json`, `nba_config.json`, `trigger_catalog_overrides.json` — copie modificabili

**Backup / reset**: per azzerare tutto basta cancellare la cartella `NBAStudio`.
Per fare un backup, copiala altrove.

## 4. Condividere i risultati

Non essendoci un server centrale, ogni DB è isolato. Per mettere in comune il lavoro:
- **Admin → Export Excel**: scarica un file multi-foglio con stato dei test, review e casi.
- Si raccolgono i file Excel dei vari tester per consolidare le considerazioni.

## 5. Aggiornare l'app

Quando cambia il motore del cliente o il Lab: si **ricompila** l'`.exe` (passo 1) e si
**ridistribuisce**. I dati in `%APPDATA%\NBAStudio` restano (non vengono toccati).

---

## Opzionale — Modello B: un PC fa da server sulla rete d'ufficio

Se più avanti serve **collaborazione condivisa** (review/commenti su un unico DB) restando
comunque offline da internet: si lancia l'eseguibile in ascolto sulla LAN e gli altri si
collegano col browser.

Crea un file `Avvia in rete locale.bat` accanto all'exe con dentro:
```
NBAStudio.exe --lan
```
Poi gli altri PC aprono `http://<ip-del-PC-server>:8000/lab/` (l'IP lo trovi con `ipconfig`).
Al primo avvio Windows chiede di **sbloccare la porta nel Firewall**: consenti sulle reti private.

> ⚠️ Sconsigliato mettere il `tangible_lab.db` su OneDrive/SharePoint/cartella di rete con
> più persone che scrivono insieme: SQLite su sync/SMB si può corrompere. Per la condivisione
> vera usa il Modello B (un solo PC scrive).

## Cosa si perde rispetto alla versione online

| | Online (Render) | Locale (questo) |
|---|---|---|
| Scoring, breakdown, Check-up, import/export | ✅ | ✅ |
| Multi-utente condiviso | ✅ | solo con Modello B (LAN) |
| Accesso da ovunque / qualsiasi device | ✅ | ❌ (PC locale o rete d'ufficio) |
| Aggiornamento automatico | ✅ (push) | ❌ (ricompila + ridistribuisci) |
| Dati esposti su internet | sì | **no** ← obiettivo |
