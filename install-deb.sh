#!/bin/bash
# Script para instalar el paquete .deb corregido

DEB_FILE="src-tauri/target/release/bundle/deb/query-x_1.0.0_amd64.deb"

if [ ! -f "$DEB_FILE" ]; then
    echo "✗ Error: No se encontró el paquete .deb"
    echo "Asegúrate de haber compilado el proyecto primero"
    exit 1
fi

echo "=== Verificando dependencias del paquete ==="
echo ""
dpkg-deb -I "$DEB_FILE" 2>/dev/null | grep "Depends:"
echo ""

# Verificar si hay dependencias incorrectas
if dpkg-deb -I "$DEB_FILE" 2>/dev/null | grep -q "libwebkit2gtk-4.0"; then
    echo "⚠ Advertencia: El paquete todavía tiene dependencias incorrectas"
    echo "Ejecutando fix-deb-dependencies.sh..."
    ./fix-deb-dependencies.sh
    if [ $? -ne 0 ]; then
        echo "✗ Error al corregir dependencias"
        exit 1
    fi
fi

echo "=== Desinstalando versión anterior (si existe) ==="
sudo dpkg -r query-x 2>/dev/null || true
sudo apt-get -f install -y 2>/dev/null || true

echo ""
echo "=== Instalando paquete corregido ==="
echo ""
sudo dpkg -i "$DEB_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Paquete instalado correctamente"
else
    echo ""
    echo "⚠ Intentando reparar dependencias..."
    sudo apt-get install -f -y
    echo ""
    echo "Si aún hay problemas, instala las dependencias manualmente:"
    echo "  sudo apt-get install libssl3 libsecret-1-0 libwebkit2gtk-4.1-0 libjavascriptcoregtk-4.1-0 libgtk-3-0 libsoup2.4-1"
fi
