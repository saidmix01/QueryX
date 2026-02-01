#!/bin/bash
# Script para crear symlink de javascriptcoregtk-4.1 a 4.0
# Esto es necesario porque Ubuntu 24.04 solo tiene 4.1 pero Tauri busca 4.0

PC_DIR="/usr/lib/x86_64-linux-gnu/pkgconfig"
SOURCE_FILE="$PC_DIR/javascriptcoregtk-4.1.pc"
TARGET_FILE="$PC_DIR/javascriptcoregtk-4.0.pc"

if [ ! -f "$SOURCE_FILE" ]; then
    echo "Error: No se encontró $SOURCE_FILE"
    echo "Asegúrate de tener instalado libjavascriptcoregtk-4.1-dev"
    exit 1
fi

if [ -f "$TARGET_FILE" ]; then
    echo "El archivo $TARGET_FILE ya existe."
    if [ -L "$TARGET_FILE" ]; then
        echo "Es un symlink. Verificando..."
        if [ "$(readlink $TARGET_FILE)" = "javascriptcoregtk-4.1.pc" ]; then
            echo "✓ El symlink ya está correctamente configurado."
            exit 0
        fi
    fi
    echo "Eliminando archivo existente..."
    sudo rm "$TARGET_FILE"
fi

echo "Creando symlink de javascriptcoregtk-4.1 a javascriptcoregtk-4.0..."
sudo ln -s javascriptcoregtk-4.1.pc "$TARGET_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Symlink creado exitosamente"
    echo ""
    echo "Verificando..."
    if pkg-config --exists javascriptcoregtk-4.0; then
        echo "✓ javascriptcoregtk-4.0 ahora está disponible"
    else
        echo "✗ Error: pkg-config aún no encuentra javascriptcoregtk-4.0"
        exit 1
    fi
else
    echo "✗ Error al crear el symlink"
    exit 1
fi
