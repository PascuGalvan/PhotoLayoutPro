# 📸 PhotoLayout Pro

**Editor Profesional de Diseño de Impresión**

PhotoLayout Pro es una aplicación web que permite crear diseños de impresión profesionales con múltiples imágenes. Ideal para crear collages, diseños para impresión fotográfica, álbumes y más.

🌐 **[Ver Demo en Vivo](https://photolayoutpro.free.nf/)**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

---

## 🌐 Demo

**¡Prueba la aplicación ahora mismo!**

[![Demo](https://img.shields.io/badge/Demo-Ver%20Aplicación-brightgreen?style=for-the-badge)](https://photolayoutpro.free.nf/)

👉 [https://photolayoutpro.free.nf/](https://photolayoutpro.free.nf/)

---

## ✨ Características

### 📤 Carga de Imágenes
- **Arrastrar y soltar** imágenes directamente en la zona de carga
- **Selector de archivos** para selección múltiple
- **Cámara móvil** integrada para capturar fotos directamente (dispositivos móviles)
- Soporte para formatos: JPG, PNG, GIF, WebP

### 📄 Configuración de Papel
- **Tamaños disponibles:**
  - A4 (210 × 297 mm)
  - A3 (297 × 420 mm)
  - A5 (148 × 210 mm)
  - Carta (216 × 279 mm)
  - Legal (216 × 356 mm)
  - Tabloide (279 × 432 mm)
- **Orientación:** Vertical u Horizontal

### 🎨 Edición de Imágenes
- **Redimensionar** imágenes manualmente o con valores exactos
- **Mantener proporciones** opcional al redimensionar
- **Mover** imágenes libremente por el lienzo
- **Rotar** imágenes (90° izquierda/derecha)
- **Ordenar capas:** Traer al frente / Enviar atrás
- **Recortar** imágenes con área de selección ajustable

### 🎛️ Mejora de Imagen
- **Contraste:** Ajuste de 0.5x a 2.0x
- **Brillo:** Ajuste de 0.5x a 2.0x
- **Saturación:** Ajuste de 0.5x a 2.0x
- **Nitidez:** Ajuste de 0 a 5px
- **Previsualización** en alta calidad

### ↩️ Historial
- **Deshacer/Rehacer** acciones (hasta 50 estados)
- Recuperación de cambios accidentales

### 💾 Exportación
- **Imprimir** directamente desde el navegador
- **Guardar como PDF** con alta calidad
- **Guardar como imagen** PNG

### 📱 Responsive
- Interfaz adaptable a escritorio, tablet y móvil
- Controles táctiles optimizados para dispositivos móviles
- Handles de redimensionamiento ampliados en pantallas táctiles

---

## 🚀 Instalación

### Opción 1: Usar la demo online
Simplemente visita [https://photolayoutpro.free.nf/](https://photolayoutpro.free.nf/) - ¡No requiere instalación!

### Opción 2: Uso local
1. Descarga o clona el repositorio
2. Abre `index.html` en tu navegador

```bash
git clone https://github.com/PascuGalvan/PhotoLayoutPro.git
cd PhotoLayoutPro
# Abrir index.html en el navegador
```

### Opción 3: Servidor local
Para mejor rendimiento con algunas funciones:

```bash
# Con Python 3
python -m http.server 8000

# Con Node.js (http-server)
npx http-server

# Con PHP
php -S localhost:8000
```

Luego accede a `http://localhost:8000`

---

## 📁 Estructura del Proyecto

```
photolayout-pro/
│
├── index.html      # Estructura HTML principal
├── styles.css      # Estilos y diseño responsive
├── script.js       # Lógica de la aplicación
└── README.md       # Documentación
```

---

## 🎯 Uso

### Cargar imágenes
1. Arrastra imágenes a la zona de carga, o
2. Haz clic en "Cargar Imágenes" para seleccionar archivos
3. En móviles, usa el botón "Tomar Foto" para capturar con la cámara

### Editar imágenes
1. **Seleccionar:** Haz clic en una imagen para seleccionarla
2. **Mover:** Arrastra la imagen seleccionada
3. **Redimensionar:** Usa los handles en las esquinas o introduce valores exactos
4. **Rotar:** Usa los botones de rotación en el panel derecho
5. **Recortar:** Inicia el modo recorte, ajusta el área y aplica

### Ajustar mejoras
1. Selecciona una imagen
2. Mueve los sliders de contraste, brillo, saturación y nitidez
3. Los cambios se aplican en tiempo real
4. Usa "Restablecer" para volver a los valores originales

### Exportar
- **Imprimir:** Abre el diálogo de impresión del sistema
- **PDF:** Genera un archivo PDF descargable
- **Imagen:** Guarda como PNG de alta calidad

---

## ⌨️ Atajos

| Acción | Descripción |
|--------|-------------|
| Clic en imagen | Seleccionar imagen |
| Arrastrar | Mover imagen seleccionada |
| Esquinas | Redimensionar imagen |
| Clic en canvas | Deseleccionar imagen |

---

## 🛠️ Tecnologías

- **HTML5** - Estructura semántica
- **CSS3** - Estilos, animaciones, diseño responsive
- **JavaScript ES6+** - Lógica de la aplicación
- **[jsPDF](https://github.com/parallax/jsPDF)** - Generación de PDFs
- **[html2canvas](https://html2canvas.hertzen.com/)** - Captura del canvas para exportación

---

## 🌐 Compatibilidad

| Navegador | Versión mínima |
|-----------|----------------|
| Chrome | 60+ |
| Firefox | 55+ |
| Safari | 11+ |
| Edge | 79+ |
| Opera | 47+ |

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

---

## 👨‍💻 Autor

**JPGB** - [@PascuGalvan](https://github.com/PascuGalvan)

- Desarrollado con ❤️ para facilitar la creación de diseños de impresión
- 🌐 Demo: [photolayoutpro.free.nf](https://photolayoutpro.free.nf/)

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Para cambios importantes:

1. Haz fork del repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcion`)
3. Commit de tus cambios (`git commit -m 'Añadir nueva función'`)
4. Push a la rama (`git push origin feature/nueva-funcion`)
5. Abre un Pull Request

---

## 📋 Changelog

### v1.0.0 (2025)
- Lanzamiento inicial
- Carga de imágenes por arrastrar/soltar y selector
- Soporte para cámara móvil
- Edición: mover, redimensionar, rotar, recortar
- Mejoras de imagen: contraste, brillo, saturación, nitidez
- Sistema de deshacer/rehacer
- Exportación a PDF e imagen
- Controles visibles solo en imagen seleccionada
- Diseño responsive

---

## ❓ FAQ

**¿Por qué no se imprimen los bordes de selección?**
> Los bordes y handles son solo visuales para edición y se ocultan automáticamente al exportar.

**¿Puedo usar imágenes de cualquier tamaño?**
> Sí, las imágenes se escalan automáticamente al añadirlas al canvas.

**¿Se guardan mis imágenes en algún servidor?**
> No, todo el procesamiento es local en tu navegador. Ninguna imagen se sube a servidores externos.
