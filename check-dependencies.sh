#!/bin/bash
# Script para verificar dependencias del sistema

echo "=== Verificando dependencias del sistema ==="
echo ""

check_pkg() {
    if pkg-config --exists "$1" 2>/dev/null; then
        echo "✓ $1 - OK"
        return 0
    else
        echo "✗ $1 - FALLO"
        return 1
    fi
}

# Verificar dependencias críticas
check_pkg "libsoup-2.4"
check_pkg "openssl"
check_pkg "libsecret-1"
check_pkg "libpq"
check_pkg "sqlite3"

echo ""
echo "=== Verificando paquetes instalados ==="
echo ""

check_installed() {
    if dpkg -l | grep -q "^ii.*$1"; then
        echo "✓ $1 instalado"
        return 0
    else
        echo "✗ $1 NO instalado"
        return 1
    fi
}

check_installed "libsoup2.4-dev"
check_installed "libssl-dev"
check_installed "libsecret-1-dev"
check_installed "libpq-dev"
check_installed "default-libmysqlclient-dev"

echo ""
echo "=== Resumen ==="
echo "Si todas las verificaciones muestran ✓, puedes compilar con: npm run tauri build"
