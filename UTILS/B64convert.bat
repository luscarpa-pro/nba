@echo off
chcp 65001 >nul

set "infile=%~1"

if "%infile%"=="" (
    echo ❌ Errore: Nessun file specificato.
    echo Uso corretto: %~nx0 ^<nomefile.zip^>
    echo Oppure trascina un file sopra questa icona.
    timeout /t 5 >nul
    exit /b
)

if not exist "%infile%" (
    echo ❌ Errore: Il file "%infile%" non esiste.
    timeout /t 5 >nul
    exit /b
)

set "filename=%~nx1"
set "output=%~dp1B64_%filename%.txt"

echo ⏳ Conversione in corso di "%filename%"...

powershell -NoProfile -Command "[System.IO.File]::WriteAllText('%output:\=\\%', [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes('%infile:\=\\%')))"

if %errorlevel% equ 0 (
    echo   Successo! File convertito.
    echo 📄 Output creato: B64_%filename%.txt
) else (
    echo ❌ Si e verificato un errore durante la conversione.
)

timeout /t 3 >nul
