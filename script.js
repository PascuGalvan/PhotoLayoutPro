// Dimensiones de papel en mm y su conversión a píxeles (96 DPI)
const paperSizes = {
    a4: { width: 210, height: 297 },
    a3: { width: 297, height: 420 },
    a5: { width: 148, height: 210 },
    letter: { width: 216, height: 279 },
    legal: { width: 216, height: 356 },
    tabloid: { width: 279, height: 432 }
};

let selectedImage = null;
let images = [];
let isDragging = false;
let isResizing = false;
let isRotating = false;
let isCropping = false;
let dragOffset = { x: 0, y: 0 };
let imageCounter = 0;
let longPressTimeout = null;
let cropHandles = {};

// Sistema de historial para deshacer/rehacer
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Variables para relación de aspecto del recorte
let cropAspectRatio = 'free'; // 'free', 'horizontal', 'vertical'
let cropAspectRatioValue = null;

// Botones de deshacer/rehacer
let undoBtn = document.createElement('button');
let redoBtn = document.createElement('button');

// Crear botones de deshacer/rehacer en la interfaz - FUNCIÓN ELIMINADA (ya existe en HTML)
// Los botones ya están creados en el HTML, solo necesitamos obtener las referencias
function initUndoRedoButtons() {
    undoBtn = document.getElementById('undoBtn');
    redoBtn = document.getElementById('redoBtn');
    updateUndoRedoButtons();
}

// Función para guardar estado en el historial
function saveToHistory() {
    // Limitar el tamaño del historial
    if (history.length >= MAX_HISTORY) {
        history.shift();
    }
    
    // Guardar el estado actual del canvas
    const canvasState = {
        html: canvas.innerHTML,
        images: images.map(img => ({
            src: img.src,
            width: parseInt(img.element.style.width),
            height: parseInt(img.element.style.height),
            left: parseInt(img.element.style.left),
            top: parseInt(img.element.style.top),
            rotation: parseInt(img.element.dataset.rotation) || 0,
            filter: img.element.style.filter
        }))
    };
    
    history.push(canvasState);
    historyIndex = history.length - 1;
    
    // Actualizar estado de botones
    updateUndoRedoButtons();
}

// Función para deshacer
function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreFromHistory();
    }
}

// Función para rehacer
function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreFromHistory();
    }
}

// Restaurar estado desde el historial
function restoreFromHistory() {
    const state = history[historyIndex];
    
    // Restaurar HTML del canvas
    canvas.innerHTML = state.html;
    
    // Reconstruir el array de imágenes
    images = [];
    const imageElements = canvas.querySelectorAll('.image-element');
    
    imageElements.forEach((imgElement, index) => {
        const imgData = state.images[index];
        if (imgData) {
            // Restaurar propiedades
            imgElement.style.width = imgData.width + 'px';
            imgElement.style.height = imgData.height + 'px';
            imgElement.style.left = imgData.left + 'px';
            imgElement.style.top = imgData.top + 'px';
            imgElement.style.transform = `rotate(${imgData.rotation}deg)`;
            imgElement.dataset.rotation = imgData.rotation;
            imgElement.style.filter = imgData.filter || '';
            
            // Reconstruir eventos
            setupImageEvents(imgElement);
            
            images.push({
                element: imgElement,
                src: imgData.src,
                originalWidth: imgData.width,
                originalHeight: imgData.height
            });
        }
    });
    
    // Limpiar selección después de restaurar
    selectedImage = null;
    imageWidthInput.value = '';
    imageHeightInput.value = '';
    hideSelectedImageControls();
    
    // Actualizar estado de botones
    updateUndoRedoButtons();
}

// Función para seleccionar imagen después de operaciones de deshacer/rehacer
function selectImageAfterUndoRedo(imgElement) {
    // Deseleccionar todas las imágenes
    document.querySelectorAll('.image-element').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Seleccionar la nueva imagen
    imgElement.classList.add('selected');
    selectedImage = imgElement;
    
    // Actualizar controles
    imageWidthInput.value = parseInt(imgElement.style.width);
    imageHeightInput.value = parseInt(imgElement.style.height);
}

// Actualizar estado de botones deshacer/rehacer
function updateUndoRedoButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
}

// Función para establecer relación de aspecto del recorte
function setCropAspectRatio(aspect) {
    cropAspectRatio = aspect;
    
    if (!isCropping || !selectedImage) return;
    
    const cropArea = selectedImage.querySelector('.crop-area');
    if (!cropArea) return;
    
    const imgWidth = selectedImage.offsetWidth;
    const imgHeight = selectedImage.offsetHeight;
    
    let cropWidth, cropHeight;
    
    switch (aspect) {
        case 'horizontal':
            // Relación 16:9 (horizontal)
            cropWidth = Math.min(imgWidth, imgHeight * 16/9);
            cropHeight = cropWidth * 9/16;
            break;
        case 'vertical':
            // Relación 9:16 (vertical)
            cropHeight = Math.min(imgHeight, imgWidth * 16/9);
            cropWidth = cropHeight * 9/16;
            break;
        case 'free':
        default:
            // Libre - usar tamaño actual
            cropWidth = parseInt(cropArea.style.width);
            cropHeight = parseInt(cropArea.style.height);
            break;
    }
    
    // Mantener posición central
    const left = (parseInt(cropArea.style.left) || 0) + (parseInt(cropArea.style.width) - cropWidth) / 2;
    const top = (parseInt(cropArea.style.top) || 0) + (parseInt(cropArea.style.height) - cropHeight) / 2;
    
    // Limitar dentro de la imagen
    cropArea.style.left = Math.max(0, Math.min(left, imgWidth - cropWidth)) + 'px';
    cropArea.style.top = Math.max(0, Math.min(top, imgHeight - cropHeight)) + 'px';
    cropArea.style.width = cropWidth + 'px';
    cropArea.style.height = cropHeight + 'px';
    
    // Actualizar posición de handles
    updateCropHandlesPosition(cropArea);
    
    // Mostrar feedback visual
    showAspectRatioFeedback(aspect);
}

// Mostrar feedback visual de la relación de aspecto seleccionada
function showAspectRatioFeedback(aspect) {
    // Remover feedback anterior si existe
    const existingFeedback = document.querySelector('.aspect-ratio-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    const feedback = document.createElement('div');
    feedback.className = 'aspect-ratio-feedback';
    feedback.style.position = 'fixed';
    feedback.style.top = '50%';
    feedback.style.left = '50%';
    feedback.style.transform = 'translate(-50%, -50%)';
    feedback.style.backgroundColor = 'rgba(0,0,0,0.8)';
    feedback.style.color = 'white';
    feedback.style.padding = '10px 20px';
    feedback.style.borderRadius = '5px';
    feedback.style.zIndex = '10000';
    feedback.style.fontSize = '16px';
    
    let message = '';
    switch (aspect) {
        case 'horizontal':
            message = '📏 Modo Horizontal (16:9)';
            break;
        case 'vertical':
            message = '📏 Modo Vertical (9:16)';
            break;
        case 'free':
            message = '🆓 Modo Libre';
            break;
    }
    
    feedback.textContent = message;
    document.body.appendChild(feedback);
    
    // Auto-remover después de 2 segundos
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 2000);
}

// Configurar eventos para una imagen
function setupImageEvents(imgElement) {
    const resizeHandle = imgElement.querySelector('.resize-handle');
    const rotateHandle = imgElement.querySelector('.rotate-handle');
    const touchHandles = imgElement.querySelectorAll('.touch-handle');
    
    // Eventos para ratón
    imgElement.addEventListener('mousedown', startDrag);
    resizeHandle.addEventListener('mousedown', startResize);
    rotateHandle.addEventListener('mousedown', startRotate);
    
    // Eventos para presión prolongada (recorte)
  //  imgElement.addEventListener('mousedown', handleLongPressStart);
    imgElement.addEventListener('mouseup', handleLongPressEnd);
    imgElement.addEventListener('mouseleave', handleLongPressEnd);
    
    // Eventos para touch
    imgElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    imgElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    imgElement.addEventListener('touchend', handleTouchEnd);
    
    // Eventos para presión prolongada táctil
   // imgElement.addEventListener('touchstart', handleLongPressStart, { passive: false });
    imgElement.addEventListener('touchend', handleLongPressEnd);
    imgElement.addEventListener('touchcancel', handleLongPressEnd);
    
    // Eventos para handles táctiles
    touchHandles.forEach(handle => {
        if (handle.classList.contains('rotate-handle')) {
            handle.addEventListener('touchstart', handleTouchRotateStart, { passive: false });
            handle.addEventListener('touchmove', handleTouchRotateMobile, { passive: false });
            handle.addEventListener('touchend', handleTouchEnd);
        } else {
            handle.addEventListener('touchstart', handleTouchResizeStart, { passive: false });
            handle.addEventListener('touchmove', handleTouchResize, { passive: false });
            handle.addEventListener('touchend', handleTouchEnd);
        }
    });
    
    // Evento de selección
    imgElement.addEventListener('mousedown', function(e) {
        if (!e.target.classList.contains('resize-handle') && 
            !e.target.classList.contains('touch-handle')) {
            selectImage(imgElement);
        }
    });
}

const canvas = document.getElementById('canvas');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const imageList = document.getElementById('imageList');
const paperSizeSelect = document.getElementById('paperSize');
const orientationSelect = document.getElementById('orientation');
const imageWidthInput = document.getElementById('imageWidth');
const imageHeightInput = document.getElementById('imageHeight');

// Detectar dispositivo móvil
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Detectar soporte para eventos táctiles
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Inicializar canvas y funcionalidad de cámara
function initCanvas() {
    updateCanvasSize();
    initCameraFunctionality();
    
    // Evento para deseleccionar al hacer clic en el canvas (fuera de una imagen)
    canvas.addEventListener('click', function(e) {
        // Solo deseleccionar si el clic fue directamente en el canvas, no en una imagen
        if (e.target === canvas || e.target.classList.contains('canvas-wrapper')) {
            deselectImage();
        }
    });
}

// Inicializar funcionalidad de cámara
function initCameraFunctionality() {
    const cameraSection = document.getElementById('cameraSection');
    const cameraBtn = document.getElementById('cameraBtn');
    const cameraPreview = document.getElementById('cameraPreview');
    const cameraVideo = document.getElementById('cameraVideo');
    const cameraCanvas = document.getElementById('cameraCanvas');
    const captureBtn = document.getElementById('captureBtn');
    const cancelCameraBtn = document.getElementById('cancelCameraBtn');
    
    // Mostrar sección de cámara solo en dispositivos móviles
    if (isMobileDevice()) {
        cameraSection.style.display = 'block';
        
        // Verificar si hay acceso a la cámara
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            cameraBtn.disabled = true;
            cameraBtn.textContent = '📷 Cámara no disponible';
            cameraBtn.style.opacity = '0.6';
            cameraBtn.style.cursor = 'not-allowed';
            
            // Añadir mensaje informativo
            const infoText = document.createElement('p');
            infoText.style.fontSize = '12px';
            infoText.style.color = '#666';
            infoText.style.marginTop = '8px';
            infoText.textContent = 'La cámara no está disponible en este dispositivo o navegador.';
            cameraSection.appendChild(infoText);
        }
    } else {
        cameraSection.style.display = 'none';
        return;
    }

    let stream = null;

    // Evento para abrir la cámara
    cameraBtn.addEventListener('click', async function() {
        try {
            // Solicitar acceso a la cámara
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment', // Usar cámara trasera por defecto
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false 
            });
            
            // Mostrar vista previa
            cameraVideo.srcObject = stream;
            cameraVideo.style.display = 'block';
            cameraPreview.style.display = 'block';
            cameraBtn.style.display = 'none';
            
            // Reproducir el video
            await cameraVideo.play();
            
        } catch (error) {
            console.error('Error accediendo a la cámara:', error);
            alert('No se pudo acceder a la cámara. Asegúrate de que la aplicación tenga permisos para usar la cámara.');
        }
    });

    // Evento para capturar foto
    captureBtn.addEventListener('click', function() {
        if (!stream) return;
        
        // Configurar canvas con las dimensiones del video
        const videoWidth = cameraVideo.videoWidth;
        const videoHeight = cameraVideo.videoHeight;
        cameraCanvas.width = videoWidth;
        cameraCanvas.height = videoHeight;
        
        // Dibujar el frame actual del video en el canvas
        const ctx = cameraCanvas.getContext('2d');
        ctx.drawImage(cameraVideo, 0, 0, videoWidth, videoHeight);
        
        // Convertir a data URL
        const imageDataUrl = cameraCanvas.toDataURL('image/jpeg', 0.9);
        
        // Procesar la imagen capturada
        processCapturedImage(imageDataUrl);
        
        // Cerrar la cámara
        closeCamera();
    });

    // Evento para cancelar
    cancelCameraBtn.addEventListener('click', function() {
        closeCamera();
    });

    // Función para cerrar la cámara
    function closeCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraVideo.style.display = 'none';
        cameraPreview.style.display = 'none';
        cameraBtn.style.display = 'block';
        cameraVideo.srcObject = null;
    }

    // Cerrar la cámara si el usuario navega fuera de la página
    window.addEventListener('beforeunload', closeCamera);
}

// Procesar imagen capturada desde la cámara
function processCapturedImage(imageDataUrl) {
    const img = new Image();
    img.onload = function() {
        addImageToCanvas(this.src, this.width, this.height);
        addImageToList(this.src, 'Foto desde cámara ' + new Date().toLocaleTimeString());
    };
    img.src = imageDataUrl;
}

// Variables para manejo táctil
let touchStartX = 0;
let touchStartY = 0;
let touchStartWidth = 0;
let touchStartHeight = 0;
let touchStartLeft = 0;
let touchStartTop = 0;
let isTouchDragging = false;
let isTouchResizing = false;
let touchResizePosition = null;

// Manejo de eventos táctiles para arrastrar
function handleTouchStart(e) {
    if (e.target.classList.contains('touch-handle') || e.target.classList.contains('resize-handle')) {
        return;
    }
    
    selectImage(e.currentTarget);
    isTouchDragging = true;
    
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartLeft = parseInt(e.currentTarget.style.left) || 0;
    touchStartTop = parseInt(e.currentTarget.style.top) || 0;
    
    e.preventDefault();
}

function handleTouchMove(e) {
    if (!isTouchDragging || !selectedImage) return;
    
    const touch = e.touches[0];
    const canvasRect = canvas.getBoundingClientRect();
    
    let x = touchStartLeft + (touch.clientX - touchStartX);
    let y = touchStartTop + (touch.clientY - touchStartY);
    
    // Limitar dentro del canvas
    x = Math.max(0, Math.min(x, canvasRect.width - selectedImage.offsetWidth));
    y = Math.max(0, Math.min(y, canvasRect.height - selectedImage.offsetHeight));
    
    selectedImage.style.left = x + 'px';
    selectedImage.style.top = y + 'px';
    
    e.preventDefault();
}

function handleTouchEnd() {
    isTouchDragging = false;
    isTouchResizing = false;
    touchResizePosition = null;
}

// Manejo de eventos táctiles para redimensionar
function handleTouchResizeStart(e) {
    isTouchResizing = true;
    selectImage(e.currentTarget.parentElement);
    touchResizePosition = e.currentTarget.dataset.position;
    
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartWidth = parseInt(selectedImage.style.width) || 0;
    touchStartHeight = parseInt(selectedImage.style.height) || 0;
    touchStartLeft = parseInt(selectedImage.style.left) || 0;
    touchStartTop = parseInt(selectedImage.style.top) || 0;
    
    e.preventDefault();
}

// Manejo de eventos táctiles para rotar
function handleTouchRotateStart(e) {
    isRotating = true;
    selectImage(e.currentTarget.parentElement);
    
    const touch = e.touches[0];
    const rect = selectedImage.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    dragOffset.startAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
    dragOffset.startRotation = parseInt(selectedImage.dataset.rotation) || 0;
    
    e.preventDefault();
}

function handleTouchRotate(e) {
    if (!isRotating || !selectedImage) return;
    
    const touch = e.touches[0];
    const rect = selectedImage.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const currentAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
    const angleDiff = currentAngle - dragOffset.startAngle;
    const degreesDiff = angleDiff * (180 / Math.PI);
    const newRotation = (dragOffset.startRotation + degreesDiff) % 360;
    
    selectedImage.style.transform = `rotate(${newRotation}deg)`;
    selectedImage.dataset.rotation = newRotation;
    
    e.preventDefault();
}

// Función mejorada para rotación táctil que funciona en móviles
function handleTouchRotateMobile(e) {
    if (!isRotating || !selectedImage) return;
    
    const touch = e.touches[0];
    const rect = selectedImage.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const currentAngle = Math.atan2(touch.clientY - centerY, touch.clientX - centerX);
    const angleDiff = currentAngle - dragOffset.startAngle;
    const degreesDiff = angleDiff * (180 / Math.PI);
    const newRotation = (dragOffset.startRotation + degreesDiff) % 360;
    
    selectedImage.style.transform = `rotate(${newRotation}deg)`;
    selectedImage.dataset.rotation = newRotation;
    
    // Para móviles, también intercambiar dimensiones cuando sea necesario
    if (newRotation === 90 || newRotation === 270) {
        const currentWidth = parseInt(selectedImage.style.width);
        const currentHeight = parseInt(selectedImage.style.height);
        selectedImage.style.width = currentHeight + 'px';
        selectedImage.style.height = currentWidth + 'px';
        
        // Actualizar controles
        imageWidthInput.value = currentHeight;
        imageHeightInput.value = currentWidth;
    }
    
    e.preventDefault();
}

// Manejo de presión prolongada para recorte
function handleLongPressStart(e) {
    if (e.type === 'mousedown' || e.type === 'touchstart') {
        longPressTimeout = setTimeout(() => {
            if (selectedImage) {
                startCropMode();
            }
        }, 3000); // 3 segundos
    }
}

function handleLongPressEnd() {
    if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
    }
}

// Función para iniciar modo de recorte
function startCropMode() {
    if (!selectedImage) {
        alert('Por favor, selecciona una imagen primero para poder recortarla.');
        return;
    }
    
    isCropping = true;
    
    // Deshabilitar eventos de arrastre de la imagen durante el recorte
    selectedImage.style.pointerEvents = 'none';
    
    // Verificar si ya existe un overlay de recorte y limpiarlo
    const existingOverlay = selectedImage.querySelector('.crop-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Crear overlay de recorte
    const cropOverlay = document.createElement('div');
    cropOverlay.className = 'crop-overlay';
    cropOverlay.style.position = 'absolute';
    cropOverlay.style.top = '0';
    cropOverlay.style.left = '0';
    cropOverlay.style.width = '100%';
    cropOverlay.style.height = '100%';
    cropOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    cropOverlay.style.zIndex = '1000';
    
    // Crear área de recorte
    const cropArea = document.createElement('div');
    cropArea.className = 'crop-area';
    cropArea.style.position = 'absolute';
    cropArea.style.border = '2px dashed #fff';
    cropArea.style.backgroundColor = 'rgba(255,255,255,0.1)';
    cropArea.style.cursor = 'move';
    cropArea.style.zIndex = '1001';
    
    // Crear handles de recorte con mejor visibilidad y funcionalidad
    const cropHandlePositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    cropHandles = {};
    
    cropHandlePositions.forEach(position => {
        const handle = document.createElement('div');
        handle.className = `crop-handle ${position}`;
        handle.style.position = 'absolute';
        handle.style.width = '20px';
        handle.style.height = '20px';
        handle.style.backgroundColor = '#764ba2';
        handle.style.border = '2px solid white';
        handle.style.borderRadius = '50%';
        handle.style.cursor = position + '-resize';
        handle.style.zIndex = '1002';
        handle.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)';
        handle.style.transition = 'transform 0.1s ease, background-color 0.1s ease';
        
        // Añadir efecto hover para mejor feedback visual
        handle.addEventListener('mouseenter', () => {
            handle.style.transform = 'scale(1.2)';
            handle.style.backgroundColor = '#8a5cb8';
        });
        
        handle.addEventListener('mouseleave', () => {
            handle.style.transform = 'scale(1)';
            handle.style.backgroundColor = '#764ba2';
        });
        
        cropArea.appendChild(handle);
        cropHandles[position] = handle;
        
        // Añadir eventos de forma robusta
        setupCropHandleEvents(handle, position);
    });
    
    cropOverlay.appendChild(cropArea);
    selectedImage.appendChild(cropOverlay);
    
    // Posicionar área de recorte inicialmente
    updateCropAreaPosition();
    
    // Añadir eventos al área de recorte
    setupCropAreaEvents(cropArea);
    
    // Añadir botones de control de recorte
    addCropControls();
    
    // Verificar y asegurar que los handles estén funcionando correctamente inmediatamente
    setTimeout(() => {
        checkAndFixCropHandles();
        ensureCropHandlesVisibility();
        updateCropHandlesPosition(cropArea);
    }, 50);
    
    // Iniciar monitoreo periódico de handles
    startCropHandlesMonitoring();
    
    // Feedback visual para el usuario
    showCropModeFeedback();
}

// Configurar eventos para handles de recorte de forma robusta
function setupCropHandleEvents(handle, position) {
    if (!handle) return;
    
    // Limpiar eventos existentes primero
    const parent = handle.parentElement;
    const newHandle = handle.cloneNode(true);
    handle.replaceWith(newHandle);
    
    // Configurar eventos de mouse
    newHandle.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        startCropResize(e);
    });
    
    // Configurar eventos táctiles
    newHandle.addEventListener('touchstart', function(e) {
        e.stopPropagation();
        handleCropResizeStart(e);
    }, { passive: false });
    
    // Prevenir eventos por defecto
    newHandle.addEventListener('mousedown', e => e.preventDefault());
    newHandle.addEventListener('touchstart', e => e.preventDefault());
}

// Configurar eventos para área de recorte
function setupCropAreaEvents(cropArea) {
    if (!cropArea) return;
    
    // Limpiar eventos existentes primero
    const parent = cropArea.parentElement;
    const newCropArea = cropArea.cloneNode(true);
    cropArea.replaceWith(newCropArea);
    
    // Configurar eventos de mouse
    newCropArea.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        startCropMove(e);
    });
    
    // Configurar eventos táctiles
    newCropArea.addEventListener('touchstart', function(e) {
        e.stopPropagation();
        handleCropTouchStart(e);
    }, { passive: false });
}

// Mostrar feedback visual cuando se inicia el modo de recorte
function showCropModeFeedback() {
    const feedback = document.createElement('div');
    feedback.className = 'crop-mode-feedback';
    feedback.style.position = 'fixed';
    feedback.style.top = '20px';
    feedback.style.left = '50%';
    feedback.style.transform = 'translateX(-50%)';
    feedback.style.backgroundColor = 'rgba(118, 75, 162, 0.9)';
    feedback.style.color = 'white';
    feedback.style.padding = '10px 20px';
    feedback.style.borderRadius = '5px';
    feedback.style.zIndex = '10000';
    feedback.style.fontSize = '14px';
    feedback.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    feedback.innerHTML = '✂️ <strong>Modo Recorte Activado</strong><br>Usa los handles para redimensionar el área de recorte';
    
    document.body.appendChild(feedback);
    
    // Auto-remover después de 3 segundos
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 3000);
}

function updateCropAreaPosition() {
    const cropArea = selectedImage.querySelector('.crop-area');
    if (!cropArea) return;
    
    // Posicionar área de recorte inicialmente en el centro
    const imgWidth = selectedImage.offsetWidth;
    const imgHeight = selectedImage.offsetHeight;
    
    const cropWidth = Math.min(imgWidth, imgHeight) * 0.8;
    const cropHeight = cropWidth;
    
    const left = (imgWidth - cropWidth) / 2;
    const top = (imgHeight - cropHeight) / 2;
    
    cropArea.style.left = left + 'px';
    cropArea.style.top = top + 'px';
    cropArea.style.width = cropWidth + 'px';
    cropArea.style.height = cropHeight + 'px';
    
    // Actualizar posición de handles
    updateCropHandlesPosition(cropArea);
}

function handleCropTouchStart(e) {
    if (!isCropping) return;
    
    const cropArea = e.currentTarget;
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const startLeft = parseInt(cropArea.style.left) || 0;
    const startTop = parseInt(cropArea.style.top) || 0;
    
    function moveCropAreaTouch(e) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        
        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;
        
        // Limitar dentro de la imagen
        const imgRect = selectedImage.getBoundingClientRect();
        const cropRect = cropArea.getBoundingClientRect();
        
        newLeft = Math.max(0, Math.min(newLeft, imgRect.width - cropRect.width));
        newTop = Math.max(0, Math.min(newTop, imgRect.height - cropRect.height));
        
        cropArea.style.left = newLeft + 'px';
        cropArea.style.top = newTop + 'px';
        
        e.preventDefault();
    }
    
    function stopMovingTouch() {
        document.removeEventListener('touchmove', moveCropAreaTouch);
        document.removeEventListener('touchend', stopMovingTouch);
    }
    
    document.addEventListener('touchmove', moveCropAreaTouch, { passive: false });
    document.addEventListener('touchend', stopMovingTouch);
    
    e.preventDefault();
}

function handleCropResizeStart(e) {
    if (!isCropping) return;
    
    const handle = e.currentTarget;
    const position = handle.className.split(' ')[1];
    const cropArea = handle.parentElement;
    const touch = e.touches[0];
    
    const startX = touch.clientX;
    const startY = touch.clientY;
    const startLeft = parseInt(cropArea.style.left) || 0;
    const startTop = parseInt(cropArea.style.top) || 0;
    const startWidth = parseInt(cropArea.style.width) || 100;
    const startHeight = parseInt(cropArea.style.height) || 100;
    
    function resizeCropAreaTouch(e) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        
        let newLeft = startLeft;
        let newTop = startTop;
        let newWidth = startWidth;
        let newHeight = startHeight;
        
        switch (position) {
            case 'top-left':
                newLeft = startLeft + deltaX;
                newTop = startTop + deltaY;
                newWidth = startWidth - deltaX;
                newHeight = startHeight - deltaY;
                break;
            case 'top-right':
                newTop = startTop + deltaY;
                newWidth = startWidth + deltaX;
                newHeight = startHeight - deltaY;
                break;
            case 'bottom-left':
                newLeft = startLeft + deltaX;
                newWidth = startWidth - deltaX;
                newHeight = startHeight + deltaY;
                break;
            case 'bottom-right':
                newWidth = startWidth + deltaX;
                newHeight = startHeight + deltaY;
                break;
        }
        
        // Limitar dimensiones mínimas
        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);
        
        // Limitar dentro de la imagen
        const imgRect = selectedImage.getBoundingClientRect();
        
        if (position === 'top-left' || position === 'bottom-left') {
            newLeft = Math.max(0, Math.min(newLeft, imgRect.width - newWidth));
        }
        if (position === 'top-left' || position === 'top-right') {
            newTop = Math.max(0, Math.min(newTop, imgRect.height - newHeight));
        }
        
        cropArea.style.left = newLeft + 'px';
        cropArea.style.top = newTop + 'px';
        cropArea.style.width = newWidth + 'px';
        cropArea.style.height = newHeight + 'px';
        
        // Actualizar posición de handles
        updateCropHandlesPosition(cropArea);
        
        e.preventDefault();
    }
    
    function stopResizingTouch() {
        document.removeEventListener('touchmove', resizeCropAreaTouch);
        document.removeEventListener('touchend', stopResizingTouch);
    }
    
    document.addEventListener('touchmove', resizeCropAreaTouch, { passive: false });
    document.addEventListener('touchend', stopResizingTouch);
    
    e.preventDefault();
}

function addCropControls() {
    // Añadir controles de recorte al panel
    const cropControls = document.createElement('div');
    cropControls.className = 'crop-controls';
    cropControls.style.position = 'absolute';
    cropControls.style.top = '10px';
    cropControls.style.right = '10px';
    cropControls.style.zIndex = '1002';
    cropControls.style.backgroundColor = 'rgba(255,255,255,0.9)';
    cropControls.style.padding = '10px';
    cropControls.style.borderRadius = '5px';
    cropControls.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
    
    cropControls.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold; color: #333;">✂️ Modo Recorte</div>
        <button onclick="applyCrop()" style="background: #4CAF50; color: white; border: none; padding: 8px 12px; border-radius: 3px; cursor: pointer; margin-right: 5px;">✅ Aplicar</button>
        <button onclick="cancelCrop()" style="background: #f44336; color: white; border: none; padding: 8px 12px; border-radius: 3px; cursor: pointer;">❌ Cancelar</button>
    `;
    
    document.body.appendChild(cropControls);
}

function applyCrop() {
    if (!isCropping || !selectedImage) return;
    
    // Obtener área de recorte
    const cropArea = selectedImage.querySelector('.crop-area');
    const cropOverlay = selectedImage.querySelector('.crop-overlay');
    const cropControls = document.querySelector('.crop-controls');
    
    if (cropArea && cropOverlay) {
        // Calcular coordenadas de recorte relativas a la imagen
        const cropX = parseInt(cropArea.style.left) || 0;
        const cropY = parseInt(cropArea.style.top) || 0;
        const cropWidth = parseInt(cropArea.style.width) || 100;
        const cropHeight = parseInt(cropArea.style.height) || 100;
        
        // Crear canvas para recortar
        const cropCanvas = document.createElement('canvas');
        const ctx = cropCanvas.getContext('2d');
        
        // Crear imagen temporal para procesar el recorte
        const tempImg = new Image();
        tempImg.onload = function() {
            // Establecer tamaño del canvas igual al área de recorte
            cropCanvas.width = cropWidth;
            cropCanvas.height = cropHeight;
            
            // Dibujar la porción recortada con alta calidad
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Calcular las coordenadas correctas considerando la relación de aspecto
            const imgWidth = this.width;
            const imgHeight = this.height;
            const containerWidth = selectedImage.offsetWidth;
            const containerHeight = selectedImage.offsetHeight;
            
            // Calcular relación de escala entre imagen original y contenedor
            const scaleX = imgWidth / containerWidth;
            const scaleY = imgHeight / containerHeight;
            
            // Calcular coordenadas reales en la imagen original
            const realCropX = cropX * scaleX;
            const realCropY = cropY * scaleY;
            const realCropWidth = cropWidth * scaleX;
            const realCropHeight = cropHeight * scaleY;
            
            // Dibujar la porción recortada correctamente
            ctx.drawImage(
                tempImg,
                realCropX, realCropY, realCropWidth, realCropHeight,
                0, 0, cropWidth, cropHeight
            );
            
            // Actualizar la imagen con el recorte
            selectedImage.style.backgroundImage = `url(${cropCanvas.toDataURL('image/jpeg', 0.95)})`;
            selectedImage.style.width = cropWidth + 'px';
            selectedImage.style.height = cropHeight + 'px';
            
            // Actualizar controles
            imageWidthInput.value = cropWidth;
            imageHeightInput.value = cropHeight;
            
            // Limpiar modo de recorte
            cleanupCropMode();
            
            // Guardar en historial
            saveToHistory();
        };
        
        tempImg.src = selectedImage.style.backgroundImage.slice(5, -2);
    }
}

function cancelCrop() {
    cleanupCropMode();
}

function cleanupCropMode() {
    isCropping = false;
    
    // Detener monitoreo de handles
    stopCropHandlesMonitoring();
    
    // Remover overlay de recorte
    const cropOverlay = selectedImage.querySelector('.crop-overlay');
    const cropControls = document.querySelector('.crop-controls');
    
    if (cropOverlay) cropOverlay.remove();
    if (cropControls) cropControls.remove();
    
    // Restaurar eventos de puntero después del recorte
    if (selectedImage) {
        selectedImage.style.pointerEvents = 'auto';
    }
}

function startCropMove(e) {
    if (!isCropping) return;
    
    const cropArea = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(cropArea.style.left) || 0;
    const startTop = parseInt(cropArea.style.top) || 0;
    
    function moveCropArea(e) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;
        
        // Limitar dentro de la imagen (usando offsetWidth/Height en lugar de getBoundingClientRect)
        const imgWidth = selectedImage.offsetWidth;
        const imgHeight = selectedImage.offsetHeight;
        const cropWidth = cropArea.offsetWidth;
        const cropHeight = cropArea.offsetHeight;
        
        newLeft = Math.max(0, Math.min(newLeft, imgWidth - cropWidth));
        newTop = Math.max(0, Math.min(newTop, imgHeight - cropHeight));
        
        cropArea.style.left = newLeft + 'px';
        cropArea.style.top = newTop + 'px';
    }
    
    function stopMoving() {
        document.removeEventListener('mousemove', moveCropArea);
        document.removeEventListener('mouseup', stopMoving);
    }
    
    document.addEventListener('mousemove', moveCropArea);
    document.addEventListener('mouseup', stopMoving);
    
    e.preventDefault();
}

function startCropResize(e) {
    if (!isCropping) return;
    
    const handle = e.currentTarget;
    const position = handle.className.split(' ')[1];
    const cropArea = handle.parentElement;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(cropArea.style.left) || 0;
    const startTop = parseInt(cropArea.style.top) || 0;
    const startWidth = parseInt(cropArea.style.width) || 100;
    const startHeight = parseInt(cropArea.style.height) || 100;
    
    function resizeCropArea(e) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newLeft = startLeft;
        let newTop = startTop;
        let newWidth = startWidth;
        let newHeight = startHeight;
        
        switch (position) {
            case 'top-left':
                newLeft = startLeft + deltaX;
                newTop = startTop + deltaY;
                newWidth = startWidth - deltaX;
                newHeight = startHeight - deltaY;
                break;
            case 'top-right':
                newTop = startTop + deltaY;
                newWidth = startWidth + deltaX;
                newHeight = startHeight - deltaY;
                break;
            case 'bottom-left':
                newLeft = startLeft + deltaX;
                newWidth = startWidth - deltaX;
                newHeight = startHeight + deltaY;
                break;
            case 'bottom-right':
                newWidth = startWidth + deltaX;
                newHeight = startHeight + deltaY;
                break;
        }
        
        // Limitar dimensiones mínimas
        newWidth = Math.max(20, newWidth);
        newHeight = Math.max(20, newHeight);
        
        // Limitar dentro de la imagen
        const imgRect = selectedImage.getBoundingClientRect();
        
        if (position === 'top-left' || position === 'bottom-left') {
            newLeft = Math.max(0, Math.min(newLeft, imgRect.width - newWidth));
        }
        if (position === 'top-left' || position === 'top-right') {
            newTop = Math.max(0, Math.min(newTop, imgRect.height - newHeight));
        }
        
        cropArea.style.left = newLeft + 'px';
        cropArea.style.top = newTop + 'px';
        cropArea.style.width = newWidth + 'px';
        cropArea.style.height = newHeight + 'px';
        
        // Actualizar posición de handles
        updateCropHandlesPosition(cropArea);
    }
    
    function stopResizing() {
        document.removeEventListener('mousemove', resizeCropArea);
        document.removeEventListener('mouseup', stopResizing);
    }
    
    document.addEventListener('mousemove', resizeCropArea);
    document.addEventListener('mouseup', stopResizing);
    
    e.preventDefault();
}

function updateCropHandlesPosition(cropArea) {
    const handles = cropArea.querySelectorAll('.crop-handle');
    handles.forEach(handle => {
        const position = handle.className.split(' ')[1];
        switch (position) {
            case 'top-left':
                handle.style.left = '-10px';
                handle.style.top = '-10px';
                break;
            case 'top-right':
                handle.style.right = '-10px';
                handle.style.top = '-10px';
                break;
            case 'bottom-left':
                handle.style.left = '-10px';
                handle.style.bottom = '-10px';
                break;
            case 'bottom-right':
                handle.style.right = '-10px';
                handle.style.bottom = '-10px';
                break;
        }
    });
}

// Función mejorada para asegurar que los handles de recorte sean visibles y funcionales
function ensureCropHandlesVisibility() {
    if (!isCropping || !selectedImage) return;
    
    const cropArea = selectedImage.querySelector('.crop-area');
    if (!cropArea) return;
    
    const handles = cropArea.querySelectorAll('.crop-handle');
    handles.forEach(handle => {
        // Asegurar que los handles sean visibles y tengan el z-index correcto
        handle.style.display = 'block';
        handle.style.zIndex = '1002';
        handle.style.pointerEvents = 'auto';
        handle.style.opacity = '1';
        handle.style.visibility = 'visible';
        
        // Verificar que los eventos estén correctamente configurados
        if (!handle.hasAttribute('data-events-set')) {
            // Limpiar eventos existentes primero
            handle.replaceWith(handle.cloneNode(true));
            const newHandle = cropArea.querySelector(`.crop-handle.${handle.className.split(' ')[1]}`);
            
            // Configurar eventos de forma robusta
            newHandle.addEventListener('mousedown', function(e) {
                e.stopPropagation();
                startCropResize(e);
            });
            
            newHandle.addEventListener('touchstart', function(e) {
                e.stopPropagation();
                handleCropResizeStart(e);
            }, { passive: false });
            
            newHandle.setAttribute('data-events-set', 'true');
        }
    });
    
    // Forzar reflow para asegurar que los cambios se apliquen
    cropArea.offsetHeight;
}

// Función mejorada para verificar y corregir problemas con los handles de recorte
function checkAndFixCropHandles() {
    if (!isCropping || !selectedImage) return;
    
    const cropArea = selectedImage.querySelector('.crop-area');
    if (!cropArea) return;
    
    // Verificar que todos los handles existan y estén funcionando
    const handlePositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    handlePositions.forEach(position => {
        let handle = cropArea.querySelector(`.crop-handle.${position}`);
        if (!handle) {
            // Crear handle si no existe
            handle = document.createElement('div');
            handle.className = `crop-handle ${position}`;
            handle.style.position = 'absolute';
            handle.style.width = '20px';
            handle.style.height = '20px';
            handle.style.backgroundColor = '#764ba2';
            handle.style.border = '2px solid white';
            handle.style.borderRadius = '50%';
            handle.style.cursor = position + '-resize';
            handle.style.zIndex = '1002';
            handle.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)';
            handle.style.transition = 'transform 0.1s ease, background-color 0.1s ease';
            
            // Añadir efecto hover
            handle.addEventListener('mouseenter', () => {
                handle.style.transform = 'scale(1.2)';
                handle.style.backgroundColor = '#8a5cb8';
            });
            
            handle.addEventListener('mouseleave', () => {
                handle.style.transform = 'scale(1)';
                handle.style.backgroundColor = '#764ba2';
            });
            
            cropArea.appendChild(handle);
            
            // Añadir eventos de forma robusta
            setupCropHandleEvents(handle, position);
        } else {
            // Verificar que el handle tenga eventos configurados
            if (!handle.hasAttribute('data-events-set')) {
                setupCropHandleEvents(handle, position);
            }
            
            // Verificar que el handle sea visible
            handle.style.display = 'block';
            handle.style.opacity = '1';
            handle.style.visibility = 'visible';
        }
    });
    
    // Actualizar posición de handles
    updateCropHandlesPosition(cropArea);
    
    // Forzar reflow para asegurar que los cambios se apliquen
    cropArea.offsetHeight;
}

// Función para verificar el estado de los handles periódicamente
function monitorCropHandles() {
    if (isCropping && selectedImage) {
        checkAndFixCropHandles();
        ensureCropHandlesVisibility();
    }
}

// Iniciar monitorización periódica de handles durante el modo de recorte
let cropMonitorInterval = null;

function startCropHandlesMonitoring() {
    if (cropMonitorInterval) {
        clearInterval(cropMonitorInterval);
    }
    
    cropMonitorInterval = setInterval(() => {
        monitorCropHandles();
    }, 1000); // Verificar cada segundo
}

function stopCropHandlesMonitoring() {
    if (cropMonitorInterval) {
        clearInterval(cropMonitorInterval);
        cropMonitorInterval = null;
    }
}

function handleTouchResize(e) {
    if (!isTouchResizing || !selectedImage) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    let newWidth = touchStartWidth;
    let newHeight = touchStartHeight;
    let newLeft = touchStartLeft;
    let newTop = touchStartTop;
    
    // Obtener la rotación actual para manejar correctamente el redimensionamiento
    const currentRotation = parseInt(selectedImage.dataset.rotation) || 0;
    
    // Para imágenes rotadas 90° o 270°, invertir el comportamiento de los handles
    if (currentRotation === 90 || currentRotation === 270) {
        switch (touchResizePosition) {
            case 'top-left':
                newWidth = Math.max(20, touchStartWidth - deltaY);
                newHeight = Math.max(20, touchStartHeight - deltaX);
                newLeft = touchStartLeft + deltaY;
                newTop = touchStartTop + deltaX;
                break;
            case 'top-right':
                newWidth = Math.max(20, touchStartWidth + deltaY);
                newHeight = Math.max(20, touchStartHeight - deltaX);
                newTop = touchStartTop + deltaX;
                break;
            case 'bottom-left':
                newWidth = Math.max(20, touchStartWidth - deltaY);
                newHeight = Math.max(20, touchStartHeight + deltaX);
                newLeft = touchStartLeft + deltaY;
                break;
            case 'bottom-right':
                newWidth = Math.max(20, touchStartWidth + deltaY);
                newHeight = Math.max(20, touchStartHeight + deltaX);
                break;
        }
    } else {
        // Comportamiento normal para rotación 0° o 180°
        switch (touchResizePosition) {
            case 'top-left':
                newWidth = Math.max(20, touchStartWidth - deltaX);
                newHeight = Math.max(20, touchStartHeight - deltaY);
                newLeft = touchStartLeft + deltaX;
                newTop = touchStartTop + deltaY;
                break;
            case 'top-right':
                newWidth = Math.max(20, touchStartWidth + deltaX);
                newHeight = Math.max(20, touchStartHeight - deltaY);
                newTop = touchStartTop + deltaY;
                break;
            case 'bottom-left':
                newWidth = Math.max(20, touchStartWidth - deltaX);
                newHeight = Math.max(20, touchStartHeight + deltaY);
                newLeft = touchStartLeft + deltaX;
                break;
            case 'bottom-right':
                newWidth = Math.max(20, touchStartWidth + deltaX);
                newHeight = Math.max(20, touchStartHeight + deltaY);
                break;
        }
    }
    
    selectedImage.style.width = newWidth + 'px';
    selectedImage.style.height = newHeight + 'px';
    selectedImage.style.left = newLeft + 'px';
    selectedImage.style.top = newTop + 'px';
    
    // Actualizar controles
    imageWidthInput.value = newWidth;
    imageHeightInput.value = newHeight;
    
    e.preventDefault();
}

// Actualizar tamaño del canvas y paneles de controles
function updateCanvasSize() {
    const paperType = paperSizeSelect.value;
    const orientation = orientationSelect.value;
    const size = paperSizes[paperType];
    
    // Convertir mm a píxeles (usando 96 DPI)
    let width = Math.round(size.width * 3.7795275591);
    let height = Math.round(size.height * 3.7795275591);
    
    if (orientation === 'landscape') {
        [width, height] = [height, width];
    }
    
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // Actualizar altura de los paneles de controles para que coincida con el tamaño del papel
    updateControlPanelsHeight();
}

// Función para actualizar la altura de los paneles de controles
function updateControlPanelsHeight() {
    const canvasHeight = parseInt(canvas.style.height);
    const leftPanel = document.querySelector('.controls-panel-left');
    const rightPanel = document.querySelector('.controls-panel-right');
    
    if (leftPanel && rightPanel) {
        // Establecer altura máxima igual a la altura del canvas + padding
        const panelHeight = canvasHeight + 40; // +40px para el padding
        leftPanel.style.maxHeight = panelHeight + 'px';
        rightPanel.style.maxHeight = panelHeight + 'px';
        
        // Ajustar también la altura del contenedor del workspace
        const workspace = document.querySelector('.workspace-container');
        if (workspace) {
            workspace.style.minHeight = (canvasHeight + 40) + 'px';
        }
    }
}

// Manejo de archivos
fileInput.addEventListener('change', handleFileSelect);
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
paperSizeSelect.addEventListener('change', updateCanvasSize);
orientationSelect.addEventListener('change', updateCanvasSize);

// Manejo de pegado
document.addEventListener('paste', handlePaste);

function handlePaste(e) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            processImageFile(file);
        }
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    for (let file of files) {
        processImageFile(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            processImageFile(file);
        }
    }
}

function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            addImageToCanvas(this.src, this.width, this.height);
            addImageToList(this.src, file.name);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function addImageToList(src, name) {
    const item = document.createElement('div');
    item.className = 'image-item';
    item.innerHTML = `
        <img src="${src}" alt="${name}">
        <span>${name || 'Imagen ' + (imageList.children.length + 1)}</span>
    `;
    item.onclick = () => addImageToCanvas(src);
    imageList.appendChild(item);
}

function addImageToCanvas(src, originalWidth, originalHeight) {
    const imgElement = document.createElement('div');
    imgElement.className = 'image-element';
    imgElement.id = 'img-' + imageCounter++;
    
    // Escalar imagen manteniendo mejor calidad
    let width = originalWidth || 200;
    let height = originalHeight || 200;
    const maxSize = 600; // Aumentado de 300 a 600 para mejor calidad
    
    // Escalar solo si es necesario, manteniendo relación de aspecto
    if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }
    
    imgElement.style.width = width + 'px';
    imgElement.style.height = height + 'px';
    imgElement.style.left = '50px';
    imgElement.style.top = '50px';
    imgElement.style.backgroundImage = `url(${src})`;
    imgElement.style.backgroundSize = 'cover'; // Cambiado de 'contain' a 'cover' para mejor calidad
    imgElement.style.backgroundRepeat = 'no-repeat';
    imgElement.style.backgroundPosition = 'center';
    
    // Añadir handles de redimensionamiento
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    imgElement.appendChild(resizeHandle);

    // Añadir indicador visual de área de redimensionamiento
    const resizeCorner = document.createElement('div');
    resizeCorner.className = 'resize-corner';
    imgElement.appendChild(resizeCorner);
    
    // Añadir handles táctiles adicionales para mejor usabilidad móvil
    const handles = [
        { position: 'top-left', class: 'touch-handle top-left' },
        { position: 'top-right', class: 'touch-handle top-right' },
        { position: 'bottom-left', class: 'touch-handle bottom-left' },
        { position: 'bottom-right', class: 'touch-handle bottom-right' },
        { position: 'rotate', class: 'touch-handle rotate-handle' }
    ];
    
    handles.forEach(handle => {
        const handleElement = document.createElement('div');
        handleElement.className = handle.class;
        handleElement.dataset.position = handle.position;
        imgElement.appendChild(handleElement);
    });
    
    // Eventos para ratón
    imgElement.addEventListener('mousedown', startDrag);
    resizeHandle.addEventListener('mousedown', startResize);
    
    // Evento para rotación con ratón
    const rotateHandle = imgElement.querySelector('.rotate-handle');
    rotateHandle.addEventListener('mousedown', startRotate);
    
    // Eventos para presión prolongada (recorte)
  //  imgElement.addEventListener('mousedown', handleLongPressStart);
    imgElement.addEventListener('mouseup', handleLongPressEnd);
    imgElement.addEventListener('mouseleave', handleLongPressEnd);
    
    // Eventos para touch
    imgElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    imgElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    imgElement.addEventListener('touchend', handleTouchEnd);
    
    // Eventos para presión prolongada táctil
  //  imgElement.addEventListener('touchstart', handleLongPressStart, { passive: false });
    imgElement.addEventListener('touchend', handleLongPressEnd);
    imgElement.addEventListener('touchcancel', handleLongPressEnd);
    
    // Eventos para handles táctiles
    const touchHandles = imgElement.querySelectorAll('.touch-handle');
    touchHandles.forEach(handle => {
        if (handle.classList.contains('rotate-handle')) {
            // Usar la función mejorada para rotación en móviles
            handle.addEventListener('touchstart', handleTouchRotateStart, { passive: false });
            handle.addEventListener('touchmove', handleTouchRotateMobile, { passive: false });
            handle.addEventListener('touchend', handleTouchEnd);
        } else {
            handle.addEventListener('touchstart', handleTouchResizeStart, { passive: false });
            handle.addEventListener('touchmove', handleTouchResize, { passive: false });
            handle.addEventListener('touchend', handleTouchEnd);
        }
    });
    
    canvas.appendChild(imgElement);
    selectImage(imgElement);
    
    images.push({
        element: imgElement,
        src: src,
        originalWidth: originalWidth,
        originalHeight: originalHeight
    });
}

function selectImage(img) {
    // Deseleccionar todas las imágenes
    document.querySelectorAll('.image-element').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Seleccionar la nueva imagen
    img.classList.add('selected');
    selectedImage = img;
    
    // Actualizar controles
    imageWidthInput.value = parseInt(img.style.width);
    imageHeightInput.value = parseInt(img.style.height);
    
    // Mostrar panel de controles de imagen seleccionada
    showSelectedImageControls();
}

// Función para mostrar los controles de imagen seleccionada
function showSelectedImageControls() {
    const controlsPanel = document.getElementById('selectedImageControls');
    if (controlsPanel) {
        controlsPanel.style.display = 'block';
    }
}

// Función para ocultar los controles de imagen seleccionada
function hideSelectedImageControls() {
    const controlsPanel = document.getElementById('selectedImageControls');
    if (controlsPanel) {
        controlsPanel.style.display = 'none';
    }
}

// Función para deseleccionar imagen
function deselectImage() {
    if (selectedImage) {
        selectedImage.classList.remove('selected');
        selectedImage = null;
        imageWidthInput.value = '';
        imageHeightInput.value = '';
        hideSelectedImageControls();
    }
}

function startDrag(e) {
    if (e.target.classList.contains('resize-handle')) return;
    
    selectImage(e.currentTarget);
    
    // Verificar si es clic en el borde para redimensionar (últimos 20px)
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Calcular distancia desde los bordes
    const distFromRight = rect.right - mouseX;
    const distFromBottom = rect.bottom - mouseY;
    
    // Si el cursor está cerca del borde inferior derecho (dentro de 20px), redimensionar
    if (distFromRight <= 20 && distFromBottom <= 20) {
        startResize(e);
        return;
    }
    
    // Si no es redimensionamiento, es arrastre normal
    isDragging = true;
    
    const canvasRect = canvas.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    e.preventDefault();
}

function startResize(e) {
    isResizing = true;
    // Asegurarse de que estamos seleccionando la imagen correcta
    const imageElement = e.currentTarget.closest('.image-element');
    if (imageElement) {
        selectImage(imageElement);
    }
    
    // Guardar posición inicial del ratón y dimensiones iniciales
    dragOffset.startX = e.clientX;
    dragOffset.startY = e.clientY;
    dragOffset.startWidth = parseInt(selectedImage.style.width);
    dragOffset.startHeight = parseInt(selectedImage.style.height);
    
    e.stopPropagation();
    e.preventDefault();
}

document.addEventListener('mousemove', function(e) {
    if (isDragging && selectedImage) {
        const canvasRect = canvas.getBoundingClientRect();
        let x = e.clientX - canvasRect.left - dragOffset.x;
        let y = e.clientY - canvasRect.top - dragOffset.y;
        
        // Limitar dentro del canvas
        x = Math.max(0, Math.min(x, canvasRect.width - selectedImage.offsetWidth));
        y = Math.max(0, Math.min(y, canvasRect.height - selectedImage.offsetHeight));
        
        selectedImage.style.left = x + 'px';
        selectedImage.style.top = y + 'px';
    }
    
    if (isResizing && selectedImage) {
        // Calcular nuevas dimensiones
        const deltaX = e.clientX - dragOffset.startX;
        const deltaY = e.clientY - dragOffset.startY;
        
        let newWidth, newHeight;
        
        if (e.shiftKey) {
            // Mantener proporción
            const aspectRatio = dragOffset.startWidth / dragOffset.startHeight;
            const delta = Math.max(deltaX, deltaY);
            newWidth = Math.max(20, dragOffset.startWidth + delta);
            newHeight = Math.max(20, newWidth / aspectRatio);
        } else {
            // Redimensionamiento libre
            newWidth = Math.max(20, dragOffset.startWidth + deltaX);
            newHeight = Math.max(20, dragOffset.startHeight + deltaY);
        }
        
        // Aplicar nuevas dimensiones al contenedor de imagen
        selectedImage.style.width = Math.round(newWidth) + 'px';
        selectedImage.style.height = Math.round(newHeight) + 'px';
        
        // Actualizar controles
        imageWidthInput.value = Math.round(newWidth);
        imageHeightInput.value = Math.round(newHeight);
        
        e.preventDefault();
    }
    
    if (isRotating && selectedImage) {
        const rect = selectedImage.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const angleDiff = currentAngle - dragOffset.startAngle;
        const degreesDiff = angleDiff * (180 / Math.PI);
        const newRotation = (dragOffset.startRotation + degreesDiff) % 360;
        
        selectedImage.style.transform = `rotate(${newRotation}deg)`;
        selectedImage.dataset.rotation = newRotation;
        
        e.preventDefault();
    }
});

document.addEventListener('mouseup', function() {
    if (isDragging || isResizing || isRotating) {
        saveToHistory(); // Guardar en historial al soltar después de arrastrar, redimensionar o rotar
    }
    isDragging = false;
    isResizing = false;
    isRotating = false;
});

// Actualizar tamaño desde inputs con mantenimiento de proporciones
imageWidthInput.addEventListener('change', function() {
    if (selectedImage) {
        const maintainRatio = document.getElementById('maintainAspectRatio').checked;
        const newWidth = parseInt(this.value);
        
        if (maintainRatio) {
            const currentHeight = parseInt(selectedImage.style.height);
            const currentWidth = parseInt(selectedImage.style.width);
            const aspectRatio = currentHeight / currentWidth;
            const newHeight = Math.round(newWidth * aspectRatio);
            
            selectedImage.style.width = newWidth + 'px';
            selectedImage.style.height = newHeight + 'px';
            imageHeightInput.value = newHeight;
        } else {
            selectedImage.style.width = newWidth + 'px';
        }
    }
});

imageHeightInput.addEventListener('change', function() {
    if (selectedImage) {
        const maintainRatio = document.getElementById('maintainAspectRatio').checked;
        const newHeight = parseInt(this.value);
        
        if (maintainRatio) {
            const currentWidth = parseInt(selectedImage.style.width);
            const currentHeight = parseInt(selectedImage.style.height);
            const aspectRatio = currentWidth / currentHeight;
            const newWidth = Math.round(newHeight * aspectRatio);
            
            selectedImage.style.height = newHeight + 'px';
            selectedImage.style.width = newWidth + 'px';
            imageWidthInput.value = newWidth;
        } else {
            selectedImage.style.height = newHeight + 'px';
        }
    }
});

// Funciones de control
function bringToFront() {
    if (selectedImage) {
        selectedImage.style.zIndex = Date.now();
    }
}

function sendToBack() {
    if (selectedImage) {
        selectedImage.style.zIndex = 1;
    }
}

function deleteSelected() {
    if (selectedImage) {
        // Guardar referencia al elemento antes de eliminarlo
        const imageToDelete = selectedImage;
        const imageSrc = images.find(img => img.element === selectedImage)?.src;
        
        // Eliminar de la lista de imágenes
        images = images.filter(img => img.element !== selectedImage);
        
        // Eliminar el elemento del DOM
        selectedImage.remove();
        
        // Limpiar selección
        selectedImage = null;
        
        // Limpiar controles
        imageWidthInput.value = '';
        imageHeightInput.value = '';
        hideSelectedImageControls();
        
        // Limpiar historial de referencias a esta imagen
        cleanHistoryFromDeletedImages();
        
        // Limpiar caché de la imagen eliminada para evitar problemas de recarga
        if (imageSrc && imageSrc.startsWith('blob:')) {
            URL.revokeObjectURL(imageSrc);
        }
        
        // Guardar en historial
        saveToHistory();
    }
}

// Función mejorada para limpiar el historial de imágenes eliminadas
function cleanHistoryFromDeletedImages() {
    const currentImagesSrc = images.map(img => img.src);
    
    // Filtrar el historial para eliminar estados que contengan imágenes eliminadas
    history = history.filter(state => {
        // Verificar si todas las imágenes en este estado todavía existen
        return state.images.every(imgState => currentImagesSrc.includes(imgState.src));
    });
    
    // Ajustar el índice del historial
    historyIndex = Math.min(historyIndex, history.length - 1);
    if (historyIndex < 0 && history.length > 0) {
        historyIndex = 0;
    }
    
    // Actualizar botones de deshacer/rehacer
    updateUndoRedoButtons();
}

// Función para procesar imágenes cuando se vuelven a cargar
function processImageFile(file, isReload = false) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Si es una recarga, buscar si ya existe esta imagen en el historial
            if (isReload) {
                const existingImage = images.find(imgData => {
                    // Para imágenes blob, comparar por tamaño y nombre
                    if (imgData.src.startsWith('blob:') && e.target.result.startsWith('blob:')) {
                        return imgData.originalWidth === this.width && 
                               imgData.originalHeight === this.height;
                    }
                    // Para imágenes normales, comparar por URL
                    return imgData.src === e.target.result;
                });
                
                if (existingImage) {
                    // Si ya existe, usar la imagen existente en lugar de crear una nueva
                    selectImage(existingImage.element);
                    return;
                }
            }
            
            addImageToCanvas(this.src, this.width, this.height);
            addImageToList(this.src, file.name);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Función para manejar la selección de archivos con mejor gestión de recargas
function handleFileSelect(e) {
    const files = e.target.files;
    for (let file of files) {
        processImageFile(file, true); // Pasar true para indicar que puede ser una recarga
    }
    // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
    e.target.value = '';
}

// Función para limpiar todas las URLs de blob al limpiar el canvas
function cleanupBlobURLs() {
    images.forEach(img => {
        if (img.src && img.src.startsWith('blob:')) {
            URL.revokeObjectURL(img.src);
        }
    });
}

// Función para limpiar el historial de imágenes eliminadas
function cleanHistoryFromDeletedImages() {
    // Filtrar el historial para eliminar estados que contengan imágenes eliminadas
    const currentImagesSrc = images.map(img => img.src);
    
    history = history.filter(state => {
        // Verificar si todas las imágenes en este estado todavía existen
        return state.images.every(imgState => currentImagesSrc.includes(imgState.src));
    });
    
    // Ajustar el índice del historial
    historyIndex = Math.min(historyIndex, history.length - 1);
    if (historyIndex < 0 && history.length > 0) {
        historyIndex = 0;
    }
    
    // Actualizar botones de deshacer/rehacer
    updateUndoRedoButtons();
}

// Función para rotar imagen con el ratón
function startRotate(e) {
    if (!selectedImage) return;
    
    isRotating = true;
    const rect = selectedImage.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    dragOffset.startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    dragOffset.startRotation = parseInt(selectedImage.dataset.rotation) || 0;
    
    e.stopPropagation();
    e.preventDefault();
}

// Función para rotar imagen 90° a la izquierda
function rotateLeft() {
    if (!selectedImage) {
        alert('Por favor, selecciona una imagen primero.');
        return;
    }
    
    const currentRotation = parseInt(selectedImage.dataset.rotation) || 0;
    const newRotation = (currentRotation - 90) % 360;
    
    selectedImage.style.transform = `rotate(${newRotation}deg)`;
    selectedImage.dataset.rotation = newRotation;
    
    // Para rotaciones de 90° o 270°, intercambiar dimensiones
    if (newRotation === 90 || newRotation === 270) {
        const currentWidth = parseInt(selectedImage.style.width);
        const currentHeight = parseInt(selectedImage.style.height);
        selectedImage.style.width = currentHeight + 'px';
        selectedImage.style.height = currentWidth + 'px';
        
        // Actualizar controles
        imageWidthInput.value = currentHeight;
        imageHeightInput.value = currentWidth;
    }
    
    // Guardar en historial
    saveToHistory();
}

// Función para rotar imagen 90° a la derecha
function rotateRight() {
    if (!selectedImage) {
        alert('Por favor, selecciona una imagen primero.');
        return;
    }
    
    const currentRotation = parseInt(selectedImage.dataset.rotation) || 0;
    const newRotation = (currentRotation + 90) % 360;
    
    selectedImage.style.transform = `rotate(${newRotation}deg)`;
    selectedImage.dataset.rotation = newRotation;
    
    // Para rotaciones de 90° o 270°, intercambiar dimensiones
    if (newRotation === 90 || newRotation === 270) {
        const currentWidth = parseInt(selectedImage.style.width);
        const currentHeight = parseInt(selectedImage.style.height);
        selectedImage.style.width = currentHeight + 'px';
        selectedImage.style.height = currentWidth + 'px';
        
        // Actualizar controles
        imageWidthInput.value = currentHeight;
        imageHeightInput.value = currentWidth;
    }
    
    // Guardar en historial
    saveToHistory();
}

function clearCanvas() {
    if (confirm('¿Estás seguro de que quieres eliminar todas las imágenes?')) {
        // Limpiar todas las URLs blob antes de eliminar las imágenes
        cleanupBlobURLs();
        canvas.innerHTML = '';
        images = [];
        selectedImage = null;
        imageList.innerHTML = '';
        hideSelectedImageControls();
        // Limpiar también el historial
        history = [];
        historyIndex = -1;
        updateUndoRedoButtons();
    }
}

// Funciones de exportación
// SOLUCIÓN COMPLETA DE IMPRESIÓN - Reemplaza la función printCanvas() con esta versión

function printCanvas() {
    // Verificar que hay contenido
    if (!canvas || canvas.children.length === 0) {
        alert('No hay contenido para imprimir. Por favor, añade imágenes primero.');
        return;
    }
    
    console.log('Iniciando proceso de impresión...');
    
    // Guardar estado actual
    const wasSelected = selectedImage;
    if (selectedImage) {
        selectedImage.classList.remove('selected');
    }
    
    // Método 1: Convertir a Canvas real y luego imprimir
    convertToCanvasAndPrint();
}

async function convertToCanvasAndPrint() {
    try {
        // Ocultar todos los handles temporalmente
        const allHandles = document.querySelectorAll('.resize-handle, .resize-corner, .touch-handle, .rotate-handle, .crop-overlay, .crop-area, .crop-handle');
        allHandles.forEach(handle => {
            handle.style.visibility = 'hidden';
        });
        
        // Remover bordes de selección
        document.querySelectorAll('.image-element').forEach(img => {
            img.classList.remove('selected');
            img.style.border = 'none';
        });
        
        // Esperar un momento para que se apliquen los cambios
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Usar html2canvas para capturar el contenido
        const canvasElement = await html2canvas(canvas, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: true, // Activar para debugging
            onclone: function(clonedDoc) {
                // Procesar el documento clonado
                const clonedCanvas = clonedDoc.getElementById('canvas');
                if (clonedCanvas) {
                    // Asegurar que las imágenes se muestren
                    const images = clonedCanvas.querySelectorAll('.image-element');
                    images.forEach(img => {
                        // Remover todos los controles del clon
                        const controls = img.querySelectorAll('.resize-handle, .resize-corner, .touch-handle, .rotate-handle');
                        controls.forEach(c => c.remove());
                        
                        img.style.border = 'none';
                        img.style.boxShadow = 'none';
                    });
                }
            }
        });
        
        // Crear una nueva ventana para impresión
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        
        if (!printWindow) {
            throw new Error('No se pudo abrir la ventana de impresión. Verifica los bloqueadores de popups.');
        }
        
        // Escribir el HTML para la ventana de impresión
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Imprimir - PhotoLayout Pro</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        margin: 0;
                        padding: 20px;
                        background: white;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                        display: block;
                    }
                    @media print {
                        body {
                            padding: 0;
                            margin: 0;
                        }
                        img {
                            max-width: 100%;
                            page-break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <img id="printImage" src="${canvasElement.toDataURL('image/png')}" alt="Diseño para imprimir">
            </body>
            </html>
        `);
        
        printWindow.document.close();
        
        // Esperar a que la imagen se cargue y luego imprimir
        printWindow.onload = function() {
            setTimeout(() => {
                printWindow.print();
                // No cerrar automáticamente para que el usuario pueda revisar
                // printWindow.close();
            }, 500);
        };
        
    } catch (error) {
        console.error('Error en la impresión:', error);
        alert('Error al preparar la impresión. Intentando método alternativo...');
        
        // Intentar método alternativo
        printCanvasAlternative();
        
    } finally {
        // Restaurar visibilidad de handles
        const allHandles = document.querySelectorAll('.resize-handle, .resize-corner, .touch-handle, .rotate-handle');
        allHandles.forEach(handle => {
            handle.style.visibility = '';
        });
        
        // Restaurar selección si existía
        if (window.selectedImage) {
            window.selectedImage.classList.add('selected');
        }
    }
}

// Método alternativo usando conversión directa a imagen
function printCanvasAlternative() {
    console.log('Usando método alternativo de impresión...');
    
    // Crear un canvas HTML5 real
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    
    // Establecer dimensiones del canvas temporal
    const canvasRect = canvas.getBoundingClientRect();
    tempCanvas.width = parseInt(canvas.style.width) || canvasRect.width;
    tempCanvas.height = parseInt(canvas.style.height) || canvasRect.height;
    
    // Fondo blanco
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Procesar cada imagen
    const images = canvas.querySelectorAll('.image-element');
    let imagesLoaded = 0;
    const totalImages = images.length;
    
    if (totalImages === 0) {
        alert('No hay imágenes para imprimir');
        return;
    }
    
    images.forEach((imageElement, index) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = function() {
            // Obtener posición y dimensiones
            const left = parseInt(imageElement.style.left) || 0;
            const top = parseInt(imageElement.style.top) || 0;
            const width = parseInt(imageElement.style.width) || 100;
            const height = parseInt(imageElement.style.height) || 100;
            const rotation = parseInt(imageElement.dataset.rotation) || 0;
            
            // Guardar contexto
            ctx.save();
            
            // Aplicar transformaciones
            if (rotation !== 0) {
                ctx.translate(left + width/2, top + height/2);
                ctx.rotate(rotation * Math.PI / 180);
                ctx.translate(-(left + width/2), -(top + height/2));
            }
            
            // Dibujar imagen
            ctx.drawImage(img, left, top, width, height);
            
            // Restaurar contexto
            ctx.restore();
            
            imagesLoaded++;
            
            // Si todas las imágenes se cargaron, imprimir
            if (imagesLoaded === totalImages) {
                printCanvasImage(tempCanvas);
            }
        };
        
        img.onerror = function() {
            console.error('Error cargando imagen:', index);
            imagesLoaded++;
            if (imagesLoaded === totalImages) {
                printCanvasImage(tempCanvas);
            }
        };
        
        // Extraer URL de la imagen del background-image
        const bgImage = imageElement.style.backgroundImage;
        const urlMatch = bgImage.match(/url\(["']?(.+?)["']?\)/);
        if (urlMatch && urlMatch[1]) {
            img.src = urlMatch[1];
        } else {
            console.error('No se pudo extraer URL de imagen:', bgImage);
            imagesLoaded++;
            if (imagesLoaded === totalImages) {
                printCanvasImage(tempCanvas);
            }
        }
    });
}

// Función auxiliar para imprimir el canvas convertido
function printCanvasImage(canvasElement) {
    // Convertir a data URL
    const dataUrl = canvasElement.toDataURL('image/png');
    
    // Crear ventana de impresión
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        // Si no se puede abrir ventana, usar iframe
        printWithIframe(dataUrl);
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Imprimir Diseño</title>
            <style>
                body { 
                    margin: 0; 
                    padding: 0; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    min-height: 100vh;
                    background: white;
                }
                img { 
                    max-width: 100%; 
                    height: auto; 
                    display: block;
                }
                @media print {
                    body { margin: 0; padding: 0; }
                    img { max-width: 100%; }
                }
            </style>
        </head>
        <body>
            <img src="${dataUrl}" onload="window.print();" />
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Método con iframe si falla la ventana
function printWithIframe(dataUrl) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = 'white';
    iframe.style.zIndex = '99999';
    
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { 
                    margin: 0; 
                    padding: 20px; 
                    background: white;
                    text-align: center;
                }
                img { 
                    max-width: 100%; 
                    height: auto;
                }
                button {
                    margin: 20px;
                    padding: 10px 20px;
                    font-size: 16px;
                    cursor: pointer;
                }
                @media print {
                    button { display: none; }
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <button onclick="window.print()">🖨️ Imprimir</button>
            <button onclick="parent.document.body.removeChild(parent.document.querySelector('iframe'))">❌ Cerrar</button>
            <br>
            <img src="${dataUrl}" />
        </body>
        </html>
    `);
    iframeDoc.close();
}

// IMPORTANTE: También añade esta función para verificar si html2canvas está cargado
function checkDependencies() {
    if (typeof html2canvas === 'undefined') {
        console.error('html2canvas no está cargado. Verificando...');
        // Intentar cargar html2canvas si no está presente
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = function() {
            console.log('html2canvas cargado exitosamente');
        };
        document.head.appendChild(script);
        return false;
    }
    return true;
}

// Verificar dependencias al cargar la página
window.addEventListener('load', function() {
    if (!checkDependencies()) {
        console.warn('Algunas dependencias no están cargadas. Intentando cargarlas...');
    }
});

async function saveAsPDF() {
    const { jsPDF } = window.jspdf;
    
    // Deseleccionar imagen antes de guardar
    const wasSelected = selectedImage;
    if (selectedImage) {
        selectedImage.classList.remove('selected');
    }
    
    try {
        // Crear un clon del canvas sin los handles y controles
        const canvasClone = canvas.cloneNode(true);
        const images = canvasClone.querySelectorAll('.image-element');
        
        // Remover todos los handles y controles de las imágenes
        images.forEach(img => {
            const handles = img.querySelectorAll('.resize-handle, .resize-corner, .touch-handle, .crop-overlay, .crop-area, .crop-handle');
            handles.forEach(handle => handle.remove());
            img.style.border = 'none';
            img.style.outline = 'none';
        });
        
        // Ocultar temporalmente el canvas original y mostrar el clon
        canvas.style.display = 'none';
        document.body.appendChild(canvasClone);
        canvasClone.style.position = 'absolute';
        canvasClone.style.left = '-9999px';
        
        // Usar html2canvas con configuración optimizada para máxima calidad
        const canvasElement = await html2canvas(canvasClone, {
            scale: 3,
            useCORS: true,
            logging: false,
            allowTaint: true,
            backgroundColor: '#ffffff',
            imageTimeout: 0
        });
        
        // Limpiar el clon temporal
        document.body.removeChild(canvasClone);
        canvas.style.display = 'block';
        
        const paperType = paperSizeSelect.value;
        const orientation = orientationSelect.value;
        const size = paperSizes[paperType];
        
        let width = size.width;
        let height = size.height;
        
        if (orientation === 'landscape') {
            [width, height] = [height, width];
        }
        
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: [width, height],
            compress: true
        });
        
        // Usar JPEG para reducir tamaño
        const imgData = canvasElement.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, width, height);
        
        // Crear blob y abrir diálogo de descarga
        const pdfBlob = pdf.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'PhotoLayout_' + new Date().getTime() + '.pdf';
        
        // Intentar usar showSaveFilePicker si está disponible
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: link.download,
                    types: [{
                        description: 'PDF Files',
                        accept: { 'application/pdf': ['.pdf'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(pdfBlob);
                await writable.close();
            } catch (err) {
                if (err.name !== 'AbortError') {
                    link.click();
                }
            }
        } else {
            link.click();
        }
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        if (wasSelected) {
            wasSelected.classList.add('selected');
            selectedImage = wasSelected;
        }
    } catch (error) {
        alert('Error al generar el PDF. Por favor, intenta de nuevo.');
        console.error(error);
        if (wasSelected) {
            wasSelected.classList.add('selected');
            selectedImage = wasSelected;
        }
    }
}

async function saveAsImage() {
    // Deseleccionar imagen antes de guardar
    const wasSelected = selectedImage;
    if (selectedImage) {
        selectedImage.classList.remove('selected');
    }
    
    try {
        // Crear un clon del canvas sin los handles y controles
        const canvasClone = canvas.cloneNode(true);
        const images = canvasClone.querySelectorAll('.image-element');
        
        // Remover todos los handles y controles de las imágenes
        images.forEach(img => {
            const handles = img.querySelectorAll('.resize-handle, .resize-corner, .touch-handle, .crop-overlay, .crop-area, .crop-handle');
            handles.forEach(handle => handle.remove());
            img.style.border = 'none';
            img.style.outline = 'none';
        });
        
        // Ocultar temporalmente el canvas original y mostrar el clon
        canvas.style.display = 'none';
        document.body.appendChild(canvasClone);
        canvasClone.style.position = 'absolute';
        canvasClone.style.left = '-9999px';
        
        // Usar html2canvas con configuración optimizada para máxima calidad
        const canvasElement = await html2canvas(canvasClone, {
            scale: 3,
            useCORS: true,
            logging: false,
            allowTaint: true,
            backgroundColor: '#ffffff',
            imageTimeout: 0
        });
        
        // Limpiar el clon temporal
        document.body.removeChild(canvasClone);
        canvas.style.display = 'block';
        
        // Convertir a blob
        canvasElement.toBlob(async function(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'PhotoLayout_' + new Date().getTime() + '.png';
            
            // Intentar usar showSaveFilePicker si está disponible
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: link.download,
                        types: [{
                            description: 'PNG Images',
                            accept: { 'image/png': ['.png'] }
                        }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        link.click();
                    }
                }
            } else {
                link.click();
            }
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            if (wasSelected) {
                wasSelected.classList.add('selected');
                selectedImage = wasSelected;
            }
        }, 'image/png', 0.95);
    } catch (error) {
        alert('Error al generar la imagen. Por favor, intenta de nuevo.');
        console.error(error);
        if (wasSelected) {
            wasSelected.classList.add('selected');
            selectedImage = wasSelected;
        }
    }
}

// Funciones de mejora de imagen
function applyImageEnhancements() {
    if (!selectedImage) {
        alert('Por favor, selecciona una imagen primero.');
        return;
    }
    
    const contrast = document.getElementById('contrastSlider').value;
    const brightness = document.getElementById('brightnessSlider').value;
    const saturation = document.getElementById('saturationSlider').value;
    const sharpness = document.getElementById('sharpnessSlider').value;
    
    // Aplicar filtros CSS
    let filterString = `contrast(${contrast}) brightness(${brightness}) saturate(${saturation})`;
    
    // Añadir efecto de nitidez usando sombra si es mayor que 0
    if (sharpness > 0) {
        filterString += ` drop-shadow(0 0 ${sharpness}px rgba(0,0,0,0.3))`;
    }
    
    selectedImage.style.filter = filterString;
    
    // Actualizar también el filtro por defecto para nuevas imágenes
    document.querySelectorAll('.image-element').forEach(img => {
        if (!img.style.filter || img.style.filter === 'none') {
            img.style.filter = filterString;
        }
    });
}

function resetImageEnhancements() {
    if (!selectedImage) {
        alert('Por favor, selecciona una imagen primero.');
        return;
    }
    
    // Restablecer valores por defecto
    document.getElementById('contrastSlider').value = 1.05;
    document.getElementById('brightnessSlider').value = 1.02;
    document.getElementById('saturationSlider').value = 1.05;
    document.getElementById('sharpnessSlider').value = 0;
    
    // Aplicar valores por defecto
    selectedImage.style.filter = 'contrast(1.05) brightness(1.02) saturate(1.05)';
}

// Event listeners para los sliders - aplicación automática
const contrastSlider = document.getElementById('contrastSlider');
const brightnessSlider = document.getElementById('brightnessSlider');
const saturationSlider = document.getElementById('saturationSlider');
const sharpnessSlider = document.getElementById('sharpnessSlider');

if (contrastSlider) {
    contrastSlider.addEventListener('input', function() {
        const label = document.querySelector('label[for="contrastSlider"]');
        if (label) label.textContent = `Contraste (${this.value}):`;
        applyImageEnhancements();
    });
}

if (brightnessSlider) {
    brightnessSlider.addEventListener('input', function() {
        const label = document.querySelector('label[for="brightnessSlider"]');
        if (label) label.textContent = `Brillo (${this.value}):`;
        applyImageEnhancements();
    });
}

if (saturationSlider) {
    saturationSlider.addEventListener('input', function() {
        const label = document.querySelector('label[for="saturationSlider"]');
        if (label) label.textContent = `Saturación (${this.value}):`;
        applyImageEnhancements();
    });
}

if (sharpnessSlider) {
    sharpnessSlider.addEventListener('input', function() {
        const label = document.querySelector('label[for="sharpnessSlider"]');
        if (label) label.textContent = `Nitidez (${this.value}px):`;
        applyImageEnhancements();
    });
}

// Función de previsualización de alta calidad
function showHighQualityPreview() {
    if (!selectedImage) {
        alert('Por favor, selecciona una imagen primero.');
        return;
    }
    
    // Crear overlay de previsualización
    const previewOverlay = document.createElement('div');
    previewOverlay.style.position = 'fixed';
    previewOverlay.style.top = '0';
    previewOverlay.style.left = '0';
    previewOverlay.style.width = '100%';
    previewOverlay.style.height = '100%';
    previewOverlay.style.backgroundColor = 'rgba(0,0,0,0.9)';
    previewOverlay.style.zIndex = '10000';
    previewOverlay.style.display = 'flex';
    previewOverlay.style.justifyContent = 'center';
    previewOverlay.style.alignItems = 'center';
    previewOverlay.style.cursor = 'pointer';
    
    // Crear imagen de previsualización
    const previewImg = document.createElement('div');
    previewImg.style.width = '80%';
    previewImg.style.height = '80%';
    previewImg.style.backgroundImage = selectedImage.style.backgroundImage;
    previewImg.style.backgroundSize = 'contain';
    previewImg.style.backgroundRepeat = 'no-repeat';
    previewImg.style.backgroundPosition = 'center';
    previewImg.style.filter = selectedImage.style.filter;
    previewImg.style.imageRendering = 'high-quality';
    
    previewOverlay.appendChild(previewImg);
    
    // Cerrar al hacer clic
    previewOverlay.onclick = function() {
        document.body.removeChild(previewOverlay);
    };
    
    document.body.appendChild(previewOverlay);
    
    // Agregar texto de ayuda
    const helpText = document.createElement('div');
    helpText.style.position = 'absolute';
    helpText.style.bottom = '20px';
    helpText.style.left = '50%';
    helpText.style.transform = 'translateX(-50%)';
    helpText.style.color = 'white';
    helpText.style.fontSize = '14px';
    helpText.style.textAlign = 'center';
    helpText.textContent = 'Haz clic en cualquier lugar para cerrar la previsualización';
    previewOverlay.appendChild(helpText);
}

// Inicializar
initCanvas();
initUndoRedoButtons();

// Limpiar URLs blob cuando se cierra la página
window.addEventListener('beforeunload', function() {
    cleanupBlobURLs();
});
