@echo off
title Golgi Bot - Actualizador de Biblioteca Web
cd /d "%~dp0"

if exist "C:\Program Files\nodejs" set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
if exist "C:\Program Files (x86)\nodejs" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\node" set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"

echo ============================================================
echo   GOLGI BOT - ACTUALIZADOR DE LA BIBLIOTECA DIGITAL
echo ============================================================
echo.

call node indice.js

echo.
pause
