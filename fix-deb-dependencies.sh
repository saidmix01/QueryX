#!/bin/bash
# Script para corregir las dependencias del paquete .deb después de la compilación
# Reemplaza libwebkit2gtk-4.0-37 con libwebkit2gtk-4.1-0

echo "=== Corrigiendo dependencias del paquete .deb ==="
echo ""

# Buscar el archivo de control generado
CONTROL_FILE=$(find src-tauri/target/release/bundle/deb -name "control" -type f 2>/dev/null | head -1)

if [ -z "$CONTROL_FILE" ]; then
    echo "✗ Error: No se encontró el archivo de control"
    echo "Asegúrate de haber compilado el proyecto primero con: npm run tauri build"
    exit 1
fi

echo "Archivo de control encontrado: $CONTROL_FILE"
echo ""

# Hacer backup del archivo original
cp "$CONTROL_FILE" "${CONTROL_FILE}.bak"
echo "✓ Backup creado: ${CONTROL_FILE}.bak"

# Leer la línea de Depends actual
DEPENDS_LINE=$(grep "^Depends:" "$CONTROL_FILE" | cut -d: -f2- | sed 's/^ *//')

# Eliminar dependencias incorrectas (4.0-37 y similares)
DEPENDS_LINE=$(echo "$DEPENDS_LINE" | sed 's/libwebkit2gtk-4\.0-[0-9]*//g')
DEPENDS_LINE=$(echo "$DEPENDS_LINE" | sed 's/libjavascriptcoregtk-4\.0-[0-9]*//g')

# Reemplazar con versiones correctas si no están presentes
if ! echo "$DEPENDS_LINE" | grep -q "libwebkit2gtk-4.1-0"; then
    DEPENDS_LINE="$DEPENDS_LINE, libwebkit2gtk-4.1-0"
fi
if ! echo "$DEPENDS_LINE" | grep -q "libjavascriptcoregtk-4.1-0"; then
    DEPENDS_LINE="$DEPENDS_LINE, libjavascriptcoregtk-4.1-0"
fi
if ! echo "$DEPENDS_LINE" | grep -q "libsoup2.4-1"; then
    DEPENDS_LINE="$DEPENDS_LINE, libsoup2.4-1"
fi

# Limpiar espacios y comas duplicadas
DEPENDS_LINE=$(echo "$DEPENDS_LINE" | sed 's/,\{2,\}/,/g' | sed 's/^,\|,$//g' | sed 's/  */ /g' | sed 's/^ *\| *$//g')

# Eliminar duplicados manteniendo el orden
DEPENDS_LINE=$(echo "$DEPENDS_LINE" | tr ',' '\n' | sed 's/^ *\| *$//g' | awk '!seen[$0]++' | tr '\n' ',' | sed 's/,$//' | sed 's/,/, /g')

# Actualizar la línea en el archivo
sed -i "s/^Depends:.*/Depends: $DEPENDS_LINE/" "$CONTROL_FILE"

# Verificar los cambios
echo ""
echo "=== Dependencias actualizadas ==="
echo ""
grep "^Depends:" "$CONTROL_FILE"

echo ""
echo "✓ Dependencias corregidas exitosamente"
echo ""
echo "Reconstruyendo el paquete .deb..."

# Reconstruir el archivo control.tar.gz
cd "$(dirname "$CONTROL_FILE")/.."
tar -czf control.tar.gz -C control control

# Reconstruir el paquete .deb
DEB_NAME=$(basename "$(pwd)")
DEB_FILE="../${DEB_NAME}.deb"
ar rcs "$DEB_FILE" debian-binary control.tar.gz data.tar.gz

if [ -f "$DEB_FILE" ]; then
    echo "✓ Paquete .deb reconstruido: $DEB_FILE"
    echo ""
    echo "Puedes instalarlo con:"
    echo "  sudo dpkg -i $DEB_FILE"
else
    echo "✗ Error al reconstruir el paquete .deb"
    exit 1
fi
