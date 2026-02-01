#!/bin/bash
# Script para crear symlinks de las bibliotecas webkit2gtk y javascriptcoregtk de 4.1 a 4.0
# Esto es necesario porque Ubuntu 24.04 solo tiene 4.1 pero Tauri busca 4.0

LIB_DIR="/usr/lib/x86_64-linux-gnu"

echo "=== Creando symlinks para bibliotecas WebKit ==="
echo ""

# Función para crear symlink si no existe
create_symlink() {
    local source=$1
    local target=$2
    
    if [ -L "$target" ]; then
        if [ "$(readlink $target)" = "$source" ]; then
            echo "✓ $target ya existe y apunta correctamente"
            return 0
        else
            echo "Eliminando symlink existente incorrecto: $target"
            sudo rm "$target"
        fi
    elif [ -e "$target" ]; then
        echo "⚠ $target existe pero no es un symlink. No se modificará."
        return 1
    fi
    
    if [ ! -e "$source" ]; then
        echo "✗ Error: No se encontró $source"
        return 1
    fi
    
    echo "Creando symlink: $target -> $source"
    sudo ln -s "$source" "$target"
    return $?
}

# Crear symlinks para webkit2gtk-4.0
echo "Creando symlinks para webkit2gtk-4.0..."
create_symlink "libwebkit2gtk-4.1.so.0" "$LIB_DIR/libwebkit2gtk-4.0.so.0"
create_symlink "libwebkit2gtk-4.1.so" "$LIB_DIR/libwebkit2gtk-4.0.so"

# Crear symlinks para javascriptcoregtk-4.0
echo ""
echo "Creando symlinks para javascriptcoregtk-4.0..."
create_symlink "libjavascriptcoregtk-4.1.so.0" "$LIB_DIR/libjavascriptcoregtk-4.0.so.0"
create_symlink "libjavascriptcoregtk-4.1.so" "$LIB_DIR/libjavascriptcoregtk-4.0.so"

echo ""
echo "=== Verificando symlinks ==="
echo ""

verify_lib() {
    if [ -L "$1" ] && [ -e "$1" ]; then
        echo "✓ $1 -> $(readlink $1)"
        return 0
    else
        echo "✗ $1 no existe o está roto"
        return 1
    fi
}

verify_lib "$LIB_DIR/libwebkit2gtk-4.0.so"
verify_lib "$LIB_DIR/libwebkit2gtk-4.0.so.0"
verify_lib "$LIB_DIR/libjavascriptcoregtk-4.0.so"
verify_lib "$LIB_DIR/libjavascriptcoregtk-4.0.so.0"

echo ""
echo "=== Actualizando caché del sistema ==="
sudo ldconfig

echo ""
echo "✓ Proceso completado. Intenta compilar nuevamente con: npm run tauri build"
