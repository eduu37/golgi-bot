@echo off
chcp 65001 >nul
title Golgi Bot Desktop
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontró Node.js en tu computador.
    echo Node.js es necesario para abrir Golgi Bot.
    start https://nodejs.org/
    pause
    exit /b
)

if not exist "node_modules\" (
    echo Instalando componentes por primera vez...
    call npm install
)

npm run app
