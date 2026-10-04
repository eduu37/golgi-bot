@echo off
title Golgi Bot Desktop
cd /d "%~dp0"

if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
if exist "C:\Program Files (x86)\nodejs" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\node" set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro Node.js en tu computador.
    echo Node.js es necesario para abrir Golgi Bot.
    echo Se abrira la pagina oficial para descargarlo.
    start https://nodejs.org/
    pause
    exit /b
)

if not exist "node_modules\" (
    echo Instalando componentes por primera vez...
    call npm install
)

call npm run app
if %errorlevel% neq 0 (
    echo.
    echo [AVISO] La aplicacion se ha cerrado.
    pause
)
