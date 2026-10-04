@echo off
title Golgi Bot - Iniciador Principal
cd /d "%~dp0"

echo ============================================================
echo   GOLGI BOT - BIBLIOTECA DIGITAL PARA MEDICINA
echo ============================================================
echo.

if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
if exist "C:\Program Files (x86)\nodejs" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\node" set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro Node.js en tu computador.
    echo Node.js es necesario para ejecutar el bot.
    echo Se abrira la pagina oficial de descarga en tu navegador.
    start https://nodejs.org/
    pause
    exit /b
)

if not exist "node_modules\" (
    echo [1/2] Primera ejecucion detectada.
    echo       Instalando componentes necesarios automaticamente...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Hubo un problema instalando las librerias. Revisa tu conexion a internet.
        pause
        exit /b
    )
    echo.
    echo [OK] Componentes instalados con exito.
    echo.
)

if not exist ".env" (
    echo [AVISO] Aun no has configurado el bot para tu generacion.
    echo         Abriendo el Asistente de Configuracion...
    echo.
    call node configurador.js
    pause
    exit /b
)

echo [2/2] Iniciando Golgi Bot...
echo       (Si te pide codigo QR, escanealo con WhatsApp como WhatsApp Web)
echo.
call node index.js

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] El bot se ha detenido.
)

echo.
pause
