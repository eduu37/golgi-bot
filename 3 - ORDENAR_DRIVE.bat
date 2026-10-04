@echo off
chcp 65001 >nul
title Golgi Bot - Ordenador Inteligente de Drive
cd /d "%~dp0"

echo ============================================================
echo   📁 GOLGI BOT — CLASIFICADOR Y DEDUPLICADOR DE DRIVE
echo ============================================================
echo.

node ordenador.js

echo.
pause
