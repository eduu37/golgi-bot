@echo off
title Golgi Bot - Asistente de Configuracion
cd /d "%~dp0"

echo ============================================================
echo   GOLGI BOT - ASISTENTE DE CONFIGURACION
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
    echo [1/2] Primera ejecucion detectada. Instalando componentes...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Hubo un problema instalando las librerias. Revisa tu conexion a internet.
        pause
        exit /b
    )
    echo.
)

call node configurador.js

echo.
pause
