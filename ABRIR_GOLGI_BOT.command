#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
    echo "❌ [ERROR] No se encontró Node.js en tu Mac."
    echo "Abriendo la página oficial de descarga..."
    open https://nodejs.org/
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "📦 Instalando componentes por primera vez..."
    npm install
fi

npm run app
