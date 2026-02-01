#!/usr/bin/env node

/**
 * Script para generar iconos en múltiples tamaños desde public/icon.png
 * Genera los tamaños necesarios para Linux AppImage: 32x32, 128x128, 256x256, 512x512
 */

import sharp from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const sourceIcon = join(projectRoot, 'public', 'icon.png');
const outputDir = join(projectRoot, 'src-tauri', 'icons');

// Tamaños requeridos para Linux AppImage
const sizes = [32, 128, 256, 512];

async function generateIcons() {
  try {
    // Verificar que el icono fuente existe
    if (!existsSync(sourceIcon)) {
      console.error(`❌ Error: No se encuentra el icono fuente en ${sourceIcon}`);
      process.exit(1);
    }

    console.log(`📦 Generando iconos desde: ${sourceIcon}`);
    console.log(`📁 Directorio de salida: ${outputDir}`);

    // Leer el icono fuente y obtener sus metadatos
    const sourceBuffer = readFileSync(sourceIcon);
    const sourceMetadata = await sharp(sourceBuffer).metadata();
    
    // Detectar si el icono tiene transparencia
    const hasAlpha = sourceMetadata.hasAlpha;
    
    // Configuración del fondo: usar fondo blanco para iconos con transparencia
    // Esto evita que las áreas transparentes se vean negras en algunos contextos
    // Si prefieres otro color, cambia los valores RGB (0-255)
    // Ejemplos:
    // - Blanco: { r: 255, g: 255, b: 255, alpha: 1 }
    // - Negro: { r: 0, g: 0, b: 0, alpha: 1 }
    // - Gris oscuro: { r: 30, g: 30, b: 30, alpha: 1 }
    // - Transparente: { r: 0, g: 0, b: 0, alpha: 0 } (puede verse negro en algunos contextos)
    const backgroundColor = { r: 255, g: 255, b: 255, alpha: 1 }; // Blanco
    
    // Para iconos con transparencia, usar fondo sólido
    // Para iconos sin transparencia, usar 'cover' para llenar todo el espacio
    const useBackground = hasAlpha;
    
    console.log(`ℹ️  Icono fuente: ${sourceMetadata.width}x${sourceMetadata.height}, Alpha: ${hasAlpha ? 'Sí' : 'No'}`);
    if (useBackground) {
      console.log(`ℹ️  Usando fondo blanco sólido para evitar áreas negras`);
    } else {
      console.log(`ℹ️  Usando 'cover' para llenar todo el espacio`);
    }
    
    // Generar cada tamaño
    for (const size of sizes) {
      const outputPath = join(outputDir, `icon-${size}x${size}.png`);
      
      const resizeOptions = useBackground
        ? {
            fit: 'contain', // Mantiene la proporción, rellena con fondo
            background: backgroundColor
          }
        : {
            fit: 'cover', // Llena todo el espacio, recorta si es necesario
            position: 'center'
          };
      
      await sharp(sourceBuffer)
        .resize(size, size, resizeOptions)
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generado: icon-${size}x${size}.png`);
    }

    // También copiar el icono original como icon.png (si no existe o es diferente)
    const mainIconPath = join(outputDir, 'icon.png');
    
    // Si el icono original no existe o tiene un tamaño diferente, actualizarlo
    if (!existsSync(mainIconPath) || sourceMetadata.width !== 256) {
      // Asegurar que el icono principal sea 256x256
      const mainResizeOptions = useBackground
        ? {
            fit: 'contain',
            background: backgroundColor
          }
        : {
            fit: 'cover',
            position: 'center'
          };
      
      await sharp(sourceBuffer)
        .resize(256, 256, mainResizeOptions)
        .png()
        .toFile(mainIconPath);
      console.log(`✅ Actualizado: icon.png (256x256)`);
    }

    console.log(`\n✨ Iconos generados exitosamente en ${outputDir}`);
    console.log(`\n📋 Iconos generados:`);
    sizes.forEach(size => {
      console.log(`   - icon-${size}x${size}.png`);
    });
    console.log(`   - icon.png (256x256)`);
    
  } catch (error) {
    console.error('❌ Error al generar iconos:', error.message);
    process.exit(1);
  }
}

generateIcons();
