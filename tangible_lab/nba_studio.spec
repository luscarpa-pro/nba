# -*- mode: python ; coding: utf-8 -*-
#
# Spec PyInstaller per NBA Studio (Lab Tangible) — eseguibile Windows standalone.
# Entry: tangible_lab/desktop_main.py
#
# Build (da una macchina Windows, dalla ROOT del repo):
#     python -m PyInstaller --noconfirm --clean tangible_lab\nba_studio.spec
# oppure usa tangible_lab\build_windows.bat
#
# NB: preserviamo la struttura di cartelle del repo dentro il bundle, così la
# risoluzione dei path basata su __file__ in server.py/auth.py/db.py funziona
# senza modifiche. I dati MUTABILI (DB, .secret, dataset/config/overrides) NON
# stanno nel bundle: vengono scritti in %APPDATA%\NBAStudio a runtime
# (vedi desktop_main.py + TANGIBLE_LAB_DATA_DIR).

import os

# SPECPATH è la cartella di questo .spec (tangible_lab/); la root del repo è il padre.
_ROOT = os.path.dirname(SPECPATH)

datas = [
    # UI statiche (sola lettura)
    (os.path.join(_ROOT, "static"), "static"),                          # UI del cliente
    (os.path.join(_ROOT, "tangible_lab", "static"), "tangible_lab/static"),  # UI del Lab
    (os.path.join(_ROOT, "tangible_lab", "checkup"), "tangible_lab/checkup"), # dati Check-up + seed
    (os.path.join(_ROOT, "tangible_lab", "messages_revised.json"), "tangible_lab"), # mappa "messaggi rivisti"
    # Default dei file mutabili: usati come sorgente di seed verso %APPDATA% al primo avvio
    (os.path.join(_ROOT, "nba_config.json"), "."),
    (os.path.join(_ROOT, "trigger_catalog_base.json"), "."),
    (os.path.join(_ROOT, "trigger_catalog_overrides.json"), "."),
]

hiddenimports = [
    # Backend del cliente (importati dinamicamente dopo manipolazione di sys.path)
    "nba_api", "nba_engine", "nba_config", "nba_catalog",
    # Package del Lab
    "tangible_lab.server", "tangible_lab.db", "tangible_lab.auth",
    "tangible_lab.models", "tangible_lab.checkup_engine", "tangible_lab.messages",
    "tangible_lab.version",
    # Dipendenze runtime che PyInstaller a volte non rileva
    "bcrypt", "openpyxl", "itsdangerous", "multipart",
    "uvicorn", "uvicorn.lifespan.on", "uvicorn.lifespan.off",
    "uvicorn.loops.auto", "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto", "uvicorn.logging",
]

a = Analysis(
    [os.path.join(_ROOT, "tangible_lab", "desktop_main.py")],
    pathex=[_ROOT],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="NBAStudio",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,            # console visibile: mostra log e URL. Metti False per nasconderla.
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
