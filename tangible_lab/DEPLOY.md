# Deploy di NBA Studio (Tangible Lab) su Render

Guida step-by-step per pubblicare l'app online con dominio Tangible o Render
e accesso protetto con account individuali.

## Prerequisiti

- **Account GitHub** (può essere quello Tangible)
- **Account Render** ([render.com](https://render.com)) — supporta team
- (Opzionale) un **dominio** per il custom subdomain (es. `nba.tangible.is`)
- **Nullaosta Vittoria** per pubblicare il loro engine NBA su infrastruttura terza
  (anche se i dati sono fittizi, l'algoritmo è proprietario)

## 1. Push del repo su GitHub

Dal terminale, nella root del progetto:

```bash
git init
git add .
git commit -m "Tangible Lab — multi-user + admin"

# Crea repo PRIVATO su GitHub (Tangible org consigliata)
gh repo create tangible/nba-studio --private --source=. --remote=origin --push
# (oppure crea il repo via UI e poi:
# git remote add origin git@github.com:tangible/nba-studio.git
# git push -u origin main )
```

> **Importante**: il repo deve essere **privato**. Contiene il codice
> dell'engine NBA di Vittoria + estensione Tangible. Verifica che `.gitignore`
> escluda `tangible_lab/tangible_lab.db*` e `tangible_lab/.secret` — sono
> file con dati utente e segreti, non vanno mai sul repo.

## 2. Connetti il repo a Render

1. Apri Render → **New +** → **Blueprint**
2. Connetti l'account GitHub e seleziona il repo `nba-studio`
3. Render trova `render.yaml` e propone di creare:
   - un **Web Service** chiamato `nba-studio` (piano Starter, $7/mese)
   - un **Disk** persistente da 1 GB montato su `/data`
   - una env var `TANGIBLE_LAB_SECRET` generata automatica
4. Conferma → primo deploy parte (5-10 min)

Quando lo status diventa **Live**, l'URL è `https://nba-studio.tangible.design` (o
simile in base al nome scelto).

## 3. Primo login

Apri `https://nba-studio.tangible.design/lab/` → vieni rediretto a `/lab/login.html`.

Credenziali bootstrap (create automaticamente al primo avvio):

- **Username**: `admin`
- **Password**: `admin`

Una volta dentro, vai subito su **Pannello admin** (icona 🛡️ in alto a destra)
→ tab **Utenti** → **Reset pw** sul tuo utente admin e imposta una password
forte. Quindi crea gli account dei tester con il bottone **Nuovo utente** —
ognuno riceverà credenziali iniziali da cambiare al primo accesso.

## 4. (Opzionale) Dominio custom

Su Render dashboard del servizio → **Settings** → **Custom Domains** → aggiungi
`nba.tangible.is` (o quello che preferisci). Render ti dà un record `CNAME` da
inserire nei DNS Tangible. Il certificato HTTPS è gestito da loro
automaticamente (Let's Encrypt).

## 5. Aggiornamenti

Quando aggiorni il codice e fai `git push`, Render builda e deploya
automaticamente (`autoDeploy: true` nel `render.yaml`).

Il volume `/data` **non viene toccato** dai deploy: utenti, casi, giudizi,
commenti e modifiche di config rimangono intatti.

## 6. Aggiornamenti dal cliente (Vittoria)

Se Vittoria invia una nuova versione del software (`nba_api.py`,
`nba_engine.py`, `dataset.json`, ...):

1. Sostituisci nel repo locale i file del backend
2. `git commit -am "Aggiornamento engine Vittoria"`
3. `git push`
4. Render fa redeploy automatico

La cartella `tangible_lab/` (Tangible) resta intatta, e il volume `/data`
preserva tutti i dati utente. Le modifiche di config dell'engine fatte dagli
operatori restano (perché vivono su `/data/nba_config.json`); per "ripartire
dai default" Vittoria, basta entrare nello shell del container e eliminare
`/data/nba_config.json` (al prossimo restart viene reseedato dal nuovo file
del cliente).

## 7. Backup

Il file `tangible_lab.db` (su `/data/tangible_lab.db`) contiene tutti gli
account utente, casi, giudizi e commenti. Da Render:

- **Disk snapshots**: Settings → Disk → "Take snapshot" prima di operazioni
  rischiose
- **Manuale**: shell del container → `cat /data/tangible_lab.db | base64 -w0`
  e salva l'output, oppure usa rclone/rsync verso un bucket

In alternativa puoi esportare le review come CSV dal pannello admin (tab
**Giudizi** → **Esporta CSV**).

## Costi mensili indicativi

- Render Web Service Starter: **$7/mese**
- Render Disk 1 GB: **$0.25/mese**
- Dominio custom: dipende dal registrar Tangible (~€10/anno)
- **Totale: ~$7-8/mese**

## Note di sicurezza

- Cookie sessione `secure=True` (solo HTTPS), `httponly=True`, `samesite=Lax` —
  protetti da XSS e CSRF di base.
- Password hashate con `bcrypt` (cost factor 12).
- Segreto firma cookie generato in build e persistito su `/data/.secret`.
  Ruotalo cambiando la env var `TANGIBLE_LAB_SECRET` su Render (tutti gli
  utenti dovranno re-loggarsi).
- L'admin bootstrap (`admin/admin`) deve essere riassegnato a una password
  forte al primo accesso — l'app mostra un avviso esplicito.
- Cancellazione utenti: cascade automatico su sessioni, casi, giudizi,
  commenti dell'utente cancellato.

## Troubleshooting

- **"502 Bad Gateway" subito dopo il deploy**: aspetta che la prima build
  finisca, poi che l'healthcheck `/lab/api/health` ritorni 200.
- **Login non funziona dopo cambio dominio**: probabile mismatch cookie
  domain. Su Render Settings rimuovi il vecchio dominio o forza HTTPS-only.
- **Vedo solo "Internal Server Error"**: controlla i Logs su Render dashboard
  — di solito è una env var mancante (`TANGIBLE_LAB_SECRET`).
- **DB corrotto**: shell container → `rm /data/tangible_lab.db` → al
  prossimo restart l'app rifa il bootstrap (perdi tutti gli utenti, attenzione).

## Test locale del Dockerfile

Prima di pushare, puoi verificare la build localmente:

```bash
docker build -t nba-studio .
docker run --rm -p 8000:8000 \
  -e TANGIBLE_LAB_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(48))") \
  -e TANGIBLE_LAB_SECURE_COOKIE=0 \
  -v $(pwd)/.data:/data \
  nba-studio
```

Apri `http://localhost:8000/lab/` — login `admin/admin`. Il database vive in
`./.data/tangible_lab.db` locale.
