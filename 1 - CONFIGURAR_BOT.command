#!/bin/bash
cd "$(dirname "$0")"

echo "============================================================"
echo "  🧬 GOLGI BOT — ASISTENTE DE CONFIGURACIÓN (macOS)"
echo "============================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "❌ [ERROR] No se encontró Node.js en tu Mac."
    echo ""
    echo "Node.js es necesario para ejecutar el bot."
    echo "Abriendo la página oficial de descarga..."
    echo "Por favor instala la versión recomendada (LTS) y vuelve a abrir este archivo."
    echo ""
    open https://nodejs.org/
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "📦 [1/2] Primera ejecución detectada. Instalando componentes..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ [ERROR] Hubo un problema instalando las librerías."
        read -p "Presiona Enter para cerrar..."
        exit 1
    fi
fi

node configurador.js

echo ""
read -p "Presiona Enter para cerrar esta ventana..."
