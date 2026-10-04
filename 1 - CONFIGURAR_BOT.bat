@echo off
chcp 65001 >nul
title Golgi Bot - Asistente de Configuración
cd /d "%~dp0"

echo ============================================================
echo   🧬 GOLGI BOT — ASISTENTE DE CONFIGURACIÓN
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontró Node.js en tu computador.
    echo.
    echo Node.js es necesario para ejecutar el bot.
    echo Se abrirá la página oficial de descarga en tu navegador.
    echo Por favor instala la versión recomendada (LTS) y vuelve a abrir este archivo.
    echo.
    start https://nodejs.org/
    pause
    exit /b
)

if not exist "node_modules\" (
    echo [1/2] Primera ejecución detectada. Instalando componentes...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Hubo un problema instalando las librerías. Revisa tu conexión a internet.
        pause
        exit /b
    )
    echo.
)

node configurador.js

echo.
pause
