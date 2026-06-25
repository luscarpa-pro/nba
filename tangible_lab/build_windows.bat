@echo off
REM ============================================================
REM  Build dell'eseguibile NBA Studio per Windows (Modello A - standalone).
REM
REM  Da lanciare UNA VOLTA su una macchina Windows con Python 3.12 installato.
REM  Produce dist\NBAStudio.exe : copialo su ogni PC e fai doppio click.
REM  Sui PC di destinazione NON serve Python ne' installare nulla.
REM ============================================================
setlocal

REM Posizionati nella ROOT del repo (questa .bat sta in tangible_lab\)
cd /d "%~dp0.."

echo [1/3] Aggiorno pip e installo le dipendenze + PyInstaller...
python -m pip install --upgrade pip || goto :err
python -m pip install -r requirements.txt pyinstaller || goto :err

echo [2/3] Compilo l'eseguibile...
python -m PyInstaller --noconfirm --clean tangible_lab\nba_studio.spec || goto :err

echo [3/3] Fatto.
echo.
echo  Eseguibile creato in:  dist\NBAStudio.exe
echo  Copia quel file su ogni PC e fai doppio click per avviare NBA Studio.
echo.
endlocal
exit /b 0

:err
echo.
echo  ERRORE durante la build. Controlla i messaggi sopra.
endlocal
exit /b 1
