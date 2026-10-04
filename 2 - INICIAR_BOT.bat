@echo off
chcp 65001 >nul
title Golgi Bot - Iniciador Principal
cd /d "%~dp0"

echo ============================================================
echo   🧬 GOLGI BOT — BIBLIOTECA DIGITAL PARA MEDICINA
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
    echo [1/2] Primera ejecución detectada.
    echo       Instalando componentes necesarios automáticamente...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Hubo un problema instalando las librerías. Revisa tu conexión a internet.
        pause
        exit /b
    )
    echo.
    echo [OK] Componentes instalados con éxito.
    echo.
)

if not exist ".env" (
    echo [AVISO] Aún no has configurado el bot para tu generación.
    echo         Abriendo el Asistente de Configuración...
    echo.
    node configurador.js
    pause
    exit /b
)

echo [2/2] Iniciando Golgi Bot...
echo       (Si te pide código QR, escanéalo con WhatsApp como WhatsApp Web)
echo.
node index.js

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] El bot se ha detenido.
)

echo.
pause
