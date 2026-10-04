#!/bin/bash
cd "$(dirname "$0")"

echo "============================================================"
echo "  🧬 GOLGI BOT — BIBLIOTECA DIGITAL PARA MEDICINA (macOS)"
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
    echo "📦 [1/2] Primera ejecución detectada."
    echo "        Instalando componentes necesarios automáticamente..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ [ERROR] Hubo un problema instalando las librerías."
        read -p "Presiona Enter para cerrar..."
        exit 1
    fi
    echo ""
    echo "✅ [OK] Componentes instalados con éxito."
    echo ""
fi

if [ ! -f ".env" ]; then
    echo "⚠️ [AVISO] Aún no has configurado el bot para tu generación."
    echo "          Abriendo el Asistente de Configuración..."
    echo ""
    node configurador.js
    read -p "Presiona Enter para cerrar..."
    exit 0
fi

echo "🚀 [2/2] Iniciando Golgi Bot..."
echo "        (Si te pide código QR, escanéalo con WhatsApp como WhatsApp Web)"
echo ""
node index.js

echo ""
read -p "Presiona Enter para cerrar esta ventana..."
