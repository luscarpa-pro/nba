# Design — Modalità single-user locale (semplificazione per uso offline su PC)

Data: 2026-06-25

## Contesto e problema

NBA Studio è ora distribuito come app **offline single-user** (un `.exe`/binario per PC,
vedi `tangible_lab/DISTRIBUZIONE_WINDOWS.md`). In questo contesto login, ruoli
admin/tester, gestione utenti e condivisione dei casi **non hanno più scopo**: c'è una
sola persona sul proprio computer. Inoltre l'infrastruttura di deploy online (Render)
è stata dismessa, quindi i relativi file sono morti.

## Obiettivi

- L'app si apre **diretta nello Studio**, senza schermata di login né cambio password.
- Nessuna distinzione di ruolo, nessuna gestione utenti, nessuna condivisione nell'UI.
- Le funzioni utili oggi sotto "Admin" (import dataset, export Excel, reseed Check-up)
  restano accessibili in un pannello **"Strumenti"**.
- Review e Note restano come **annotazioni personali**.
- Rimuovere l'infrastruttura Render ormai morta.

## Approccio

Cambiare il **comportamento al confine auth + la UI**, **non lo schema dati**. Resta un
**singolo utente locale implicito**; review/casi/note continuano a funzionare attribuiti
a lui. Tutto guidato da un flag d'ambiente `TANGIBLE_LAB_SINGLE_USER` impostato da
`desktop_main`. Con il flag **spento**, l'app si comporta esattamente come oggi (auth
completa) — così la modalità multi-utente/LAN (Modello B) resta possibile in futuro.

## Non-obiettivi (YAGNI)

- NON rimuovere dallo schema DB le tabelle `users`/`sessions` né i campi
  `role`/`owner_id`/`shared` (restano inattivi).
- NON toccare il comportamento con flag spento (path online/dev invariato).
- Nessuna migrazione dati.

## Vincoli

- Lavorare in `tangible_lab/` + config repo. Mai modificare i file vendored del cliente.
- Lingua italiana per UI/commit/commenti.
- Nessun framework di test: verifiche via script in-process + `node --check` + boot reale.

## Fatti tecnici (verificati)

- `auth.require_user()` chiama `user_from_request()` e fa 401 se assente;
  `auth.require_admin()` chiama `require_user()` e fa 403 se `role != "admin"`.
- 28 endpoint usano `require_user`/`require_admin`; tutti passano per `user_from_request`.
- Il bootstrap crea già l'utente `admin` con `role="admin"`.
- `desktop_main.py` imposta l'ambiente prima di importare il server.

---

## Parte 1 — Bypass auth single-user (backend)

**File:** `tangible_lab/auth.py`, `tangible_lab/desktop_main.py`

- In `desktop_main.main()` aggiungere: `os.environ.setdefault("TANGIBLE_LAB_SINGLE_USER", "1")`.
- In `auth.user_from_request(request)`: se `os.environ.get("TANGIBLE_LAB_SINGLE_USER")` è
  attivo, restituire l'**utente locale** (get-or-create) ignorando il cookie di sessione.
  - L'utente locale è quello con `role="admin"` (riusa il bootstrap `admin`): così
    `require_admin` passa e gli endpoint Strumenti funzionano senza login.
  - Implementazione: prendere il primo utente admin esistente via
    `models.list_users()` (filtrando `role=="admin"`); se nessuno, è il bootstrap che
    lo crea all'avvio, quindi esisterà. Restituire quel dict utente.
- Effetto: con flag attivo, `require_user`/`require_admin` e `/lab/api/me` ritornano
  sempre l'utente locale → niente 401 → niente redirect a login. Nessun'altra modifica
  alle 28 guardie.

## Parte 2 — UI Studio semplificata

**File:** `tangible_lab/static/studio.js` (+ eventuale `studio.css` per nascondere elementi)

- **Menu utente:** rimuovere l'etichetta ruolo ("Amministratore/Tester") e il pulsante
  logout. Mostrare al più il nome app/utente locale.
- **Must-change-password:** rimuovere il flusso (non verrà mai attivato per l'utente
  locale; togliere il branch UI relativo).
- **Cartelle casi:** unificare "Miei / Condivisi" in un'unica voce **"Casi salvati"**.
- **Salvataggio caso:** rimuovere il toggle "condiviso" (i casi salvati salvano con
  `shared=false` sempre).
- **Commenti:** rinominare il drawer da "Conversazione del team" a **"Note"** (etichette/
  testo; nessuna rimozione di logica). La condizione `isMine || role==="admin"` resta
  valida (l'utente locale è sempre proprietario).

## Parte 3 — Pannello "Strumenti" (ex Admin)

**File:** `tangible_lab/static/admin.js`, `tangible_lab/static/admin.html`

- Rinominare il pannello da "Admin" a **"Strumenti"**.
- **Mantenere** le sezioni: Import dataset, Export Excel, Reseed Check-up.
- **Rimuovere** dall'UI: tab/funzioni **Utenti** (CRUD utenti), **Dashboard statistiche**,
  e la vista **"tutti i casi"** (in single-user i casi sono già nello Studio).
- Gli endpoint backend corrispondenti (`/lab/admin/users`, `/lab/admin/stats`,
  `/lab/admin/cases`, `/lab/admin/reviews`) **restano** nel codice ma non più richiamati
  dall'UI (YAGNI: non li rimuovo, restano dietro `require_admin` che in locale passa).

## Parte 4 — Rimozione infrastruttura Render (morta)

**File da eliminare:** `render.yaml`, `Dockerfile`, `tangible_lab/DEPLOY.md`.
**Modifiche:** rimuovere `gunicorn` da `requirements.txt`. Le env
`TANGIBLE_LAB_SECURE_COOKIE`/HTTPS non sono più rilevanti (in single-user i cookie non
sono usati); nessuna azione necessaria sul codice cookie (resta inerte).

---

## Data flow

`desktop_main` imposta `TANGIBLE_LAB_SINGLE_USER=1` → ogni richiesta è risolta come
utente locale admin → `/lab/` carica lo Studio senza redirect → casi/review/note
attribuiti all'utente locale → pannello "Strumenti" per import/export/reseed.

## Testing

- **Backend single-user:** con `TANGIBLE_LAB_SINGLE_USER=1`, `user_from_request(req)`
  ritorna l'utente admin locale senza cookie; `/lab/api/me` → 200; un endpoint
  `require_admin` (es. export) risponde senza login.
- **Backend flag spento:** senza il flag, `user_from_request` senza cookie ritorna None
  (comportamento attuale) → `/lab/api/me` → 401.
- **UI:** `node --check studio.js` e `admin.js`; boot reale → `/lab/` apre lo Studio
  senza passare da login; nessun toggle "condiviso"; drawer commenti etichettato "Note";
  pannello Strumenti senza tab Utenti.
- **Infra:** `render.yaml`/`Dockerfile`/`DEPLOY.md` assenti; `gunicorn` non in requirements.

## Rischi

- Con flag attivo gli endpoint admin sono di fatto aperti: accettabile in locale
  (localhost, utente singolo). Con flag spento la sicurezza resta invariata.
