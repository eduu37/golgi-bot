#!/bin/bash
cd "$(dirname "$0")"

echo "============================================================"
echo "  🌐 GOLGI BOT — ACTUALIZADOR DE LA BIBLIOTECA DIGITAL (macOS)"
echo "============================================================"
echo ""

node indice.js

echo ""
read -p "Presiona Enter para cerrar esta ventana..."
