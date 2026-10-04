@echo off
chcp 65001 >nul
title Golgi Bot - Actualizador de Biblioteca Web
cd /d "%~dp0"

echo ============================================================
echo   🌐 GOLGI BOT — ACTUALIZADOR DE LA BIBLIOTECA DIGITAL
echo ============================================================
echo.

node indice.js

echo.
pause
