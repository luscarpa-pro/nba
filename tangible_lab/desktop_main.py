"""
Entry-point per la versione desktop/standalone (Windows .exe via PyInstaller).

Differenze rispetto a `python tangible_lab/server.py`:
- imposta `TANGIBLE_LAB_DATA_DIR` su una cartella scrivibile per-utente
  (`%APPDATA%\\NBAStudio` su Windows) PRIMA di importare il server, così che
  DB, `.secret` e i JSON mutabili (dataset/config/overrides) vivano FUORI dal
  bundle (che è di sola lettura / temporaneo);
- importa `tangible_lab.server` come modulo (non come `__main__`) per preservare
  la risoluzione dei path basata su `__file__` dentro il bundle PyInstaller.

Argomenti opzionali:
  --lan            mette il server in ascolto su tutta la rete locale (0.0.0.0)
  --host <ip>      host specifico (default 127.0.0.1)
  --port <n>       porta (default 8000; se occupata ne cerca una libera)
"""
import os
import sys

# Rende importabile il package `tangible_lab` sia da sorgente (dev) sia da bundle.
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)


def _default_data_dir() -> str:
    """Cartella dati scrivibile e persistente tra i riavvii."""
    if os.name == "nt":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
    else:
        base = os.path.join(os.path.expanduser("~"), ".local", "share")
    return os.path.join(base, "NBAStudio")


def main() -> None:
    # 1) cartella dati per-utente (rispetta un eventuale override già impostato)
    os.environ.setdefault("TANGIBLE_LAB_DATA_DIR", _default_data_dir())

    # Modalità locale: un solo utente, niente login (vedi auth.user_from_request)
    os.environ.setdefault("TANGIBLE_LAB_SINGLE_USER", "1")

    # 2) host/porta da argomenti opzionali
    host, port = "127.0.0.1", 8000
    args = sys.argv[1:]
    for i, a in enumerate(args):
        if a == "--lan":
            host = "0.0.0.0"
        elif a == "--host" and i + 1 < len(args):
            host = args[i + 1]
        elif a == "--port" and i + 1 < len(args):
            try:
                port = int(args[i + 1])
            except ValueError:
                pass

    # 3) import del server DOPO aver fissato l'ambiente (il seed dei dati avviene qui)
    from tangible_lab import server

    server.run(host=host, port=port, open_ui=True)


if __name__ == "__main__":
    main()
