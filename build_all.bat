@echo off
setlocal

REM Build EXE 1: dataset generator
python -m pip install --upgrade pyinstaller
python -m PyInstaller --onefile --name generate_dataset generate_dataset.py

REM Build EXE 2: API server + static UI
python -m PyInstaller --onefile --name nba_server ^
  --add-data "static;static" ^
  nba_api.py

echo.
echo Build complete. Outputs are in .\dist\
echo - dist\generate_dataset.exe
echo - dist\nba_server.exe
echo.
endlocal
