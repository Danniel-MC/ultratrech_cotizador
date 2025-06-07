// Constantes y elementos del DOM
//const API_BASE_URL = 'http://127.0.0.1:5000'; // URL de tu backend Flask
const API_BASE_URL = 'https://ultratech-backend.onrender.com'; // URL de tu backend Flask
const marcaSelect = document.getElementById('marcaSelect');
const modeloSelect = document.getElementById('modeloSelect');
const reparacionSelect = document.getElementById('reparacionSelect');
const cotizacionDisplay = document.getElementById('cotizacionDisplay');
const savePdfBtn = document.getElementById('savePdfBtn');
const saveImageBtn = document.getElementById('saveImageBtn');
const whatsappBtn = document.getElementById('whatsappBtn');

let currentCotizacion = null; // Variable para almacenar la cotización actual mostrada

// --- Funciones para interactuar con la API del Backend ---

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching data:", error);
        alert("Hubo un problema al cargar los datos. Intenta de nuevo más tarde.");
        return []; // Retorna un array vacío para evitar errores
    }
}

async function postAPI(endpoint, data) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            // Intenta leer el error del servidor si está disponible
            const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
            throw new Error(`HTTP error! status: ${response.status}: ${errorData.error || 'Error en la solicitud'}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error posting data:", error);
        alert("Hubo un problema al obtener la cotización. Verifica tus selecciones.");
        return null;
    }
}

// --- Funciones para poblar los Selectores ---

async function loadMarcas() {
    marcaSelect.innerHTML = '<option value="">Cargando marcas...</option>';
    const marcas = await fetchAPI('/marcas');
    if (marcas.length > 0) {
        marcaSelect.innerHTML = '<option value="">-- Selecciona una marca --</option>';
        marcas.forEach(marca => {
            const option = document.createElement('option');
            option.value = marca.id_marca;
            option.textContent = marca.nombre_marca;
            marcaSelect.appendChild(option);
        });
    } else {
        marcaSelect.innerHTML = '<option value="">No hay marcas disponibles</option>';
    }
    modeloSelect.disabled = true; // Deshabilitar modelo y reparación al inicio
    reparacionSelect.disabled = true;
    updateCotizacionDisplay(); // Limpiar display
    disableActionButtons(); // Deshabilitar botones de acción
}

async function loadModelos(marcaId) {
    modeloSelect.innerHTML = '<option value="">Cargando modelos...</option>';
    modeloSelect.disabled = true;
    reparacionSelect.disabled = true;
    updateCotizacionDisplay(); // Limpiar display
    disableActionButtons(); // Deshabilitar botones de acción

    if (!marcaId) {
        modeloSelect.innerHTML = '<option value="">Selecciona una marca primero</option>';
        return;
    }

    const modelos = await fetchAPI(`/modelos/${marcaId}`);
    if (modelos.length > 0) {
        modeloSelect.innerHTML = '<option value="">-- Selecciona un modelo --</option>';
        modelos.forEach(modelo => {
            const option = document.createElement('option');
            option.value = modelo.id_modelo;
            option.textContent = modelo.nombre_modelo;
            modeloSelect.appendChild(option);
        });
        modeloSelect.disabled = false;
    } else {
        modeloSelect.innerHTML = '<option value="">No hay modelos disponibles para esta marca</option>';
    }
}

async function loadTiposReparacion(modeloId) {
    reparacionSelect.innerHTML = '<option value="">Cargando tipos de reparación...</option>';
    reparacionSelect.disabled = true;
    updateCotizacionDisplay(); // Limpiar display
    disableActionButtons(); // Deshabilitar botones de acción

    if (!modeloId) {
        reparacionSelect.innerHTML = '<option value="">Selecciona un modelo primero</option>';
        return;
    }

    const reparaciones = await fetchAPI(`/tipos_reparacion/${modeloId}`);
    if (reparaciones.length > 0) {
        reparacionSelect.innerHTML = '<option value="">-- Selecciona un tipo de reparación --</option>';
        reparaciones.forEach(reparacion => {
            const option = document.createElement('option');
            option.value = reparacion.id_reparacion;
            option.textContent = reparacion.tipo_reparacion;
            reparacionSelect.appendChild(option);
        });
        reparacionSelect.disabled = false;
    } else {
        reparacionSelect.innerHTML = '<option value="">No hay reparaciones disponibles para este modelo</option>';
    }
}

// --- Función para obtener y mostrar la cotización ---

async function getCotizacion() {
    const marcaId = marcaSelect.value;
    const modeloId = modeloSelect.value;
    const reparacionId = reparacionSelect.value;

    if (!marcaId || !modeloId || !reparacionId) {
        updateCotizacionDisplay(); // Limpiar si falta alguna selección
        disableActionButtons();
        return;
    }

    const cotizacion = await postAPI('/cotizar', {
        marca_id: parseInt(marcaId),
        modelo_id: parseInt(modeloId),
        tipo_reparacion_id: parseInt(reparacionId)
    });

    if (cotizacion && cotizacion.precio) {
        currentCotizacion = cotizacion; // Guardar la cotización para los botones de acción
        displayCotizacion(cotizacion);
        enableActionButtons();
    } else {
        currentCotizacion = null;
        updateCotizacionDisplay('No se encontró una cotización para esta combinación.');
        disableActionButtons();
    }
}

function displayCotizacion(cotizacion) {
    let availabilityClass = '';
    if (cotizacion.disponibilidad.toLowerCase().includes('disponible')) {
        availabilityClass = 'availability';
    } else {
        availabilityClass = 'availability not-available';
    }

    cotizacionDisplay.innerHTML = `
        <h3>Tu Cotización Estimada:</h3>
        <p class="price">L. ${cotizacion.precio.toFixed(2)}</p>
        <p class="details">${cotizacion.tipo_reparacion} (${cotizacion.nombre_modelo})</p>
        <p class="${availabilityClass}">Disponibilidad: ${cotizacion.disponibilidad}</p>
        ${cotizacion.descripcion_breve ? `<p class="details">Detalles: ${cotizacion.descripcion_breve}</p>` : ''}
        <p class="note">Nota: Precios pueden variar ligeramente. Esta es una cotización estimada.</p>
    `;
}

function updateCotizacionDisplay(message = 'Selecciona las opciones para ver tu cotización.') {
    cotizacionDisplay.innerHTML = `<p class="placeholder">${message}</p>`;
    currentCotizacion = null; // Limpiar la cotización actual
    disableActionButtons(); // Deshabilitar botones al limpiar
}

// --- Funciones para habilitar/deshabilitar botones de acción ---

function enableActionButtons() {
    savePdfBtn.disabled = false;
    saveImageBtn.disabled = false;
    // whatsappBtn.disabled = false; // Ya no necesitamos esto directamente

    // Eliminar la clase 'disabled-link' y configurar el href
    whatsappBtn.classList.remove('disabled-link');
    if (currentCotizacion) {
        const whatsappMessage = encodeURIComponent(
            `Hola Ultratech, me gustaría confirmar una cotización.\n\n` + // Salto de línea
            `Dispositivo: ${currentCotizacion.nombre_marca} ${currentCotizacion.nombre_modelo}\n` +
            `Reparación: ${currentCotizacion.tipo_reparacion}\n` +
            `Precio Estimado: L. ${currentCotizacion.precio.toFixed(2)}\n` +
            `Disponibilidad: ${currentCotizacion.disponibilidad}\n\n` +
            `Mi nombre es [Tu Nombre] y me gustaría [añadir mi pregunta o agendar].` // Sugerencia para el cliente

        );
        // Reemplaza 'XXXXXXXXXX' con el número de WhatsApp real de tu técnico
        whatsappBtn.href = `https://wa.me/95682307?text=${whatsappMessage}`;
    }
}

function disableActionButtons() {
    savePdfBtn.disabled = true;
    saveImageBtn.disabled = true;
    // whatsappBtn.disabled = true; // Ya no necesitamos esto directamente

    // Añadir la clase 'disabled-link' y resetear el href
    whatsappBtn.classList.add('disabled-link');
    whatsappBtn.href = '#'; // Resetear el enlace de WhatsApp
}

// --- Funciones para Guardar Cotización (PDF/Imagen) ---

async function saveCotizacionAsPdf() {
    if (!currentCotizacion) {
        alert('Por favor, genera una cotización primero.');
        return;
    }

    // Temporalmente ocultar botones de acción para una captura limpia
    const actionButtonsSection = document.querySelector('.action-buttons');
    if (actionButtonsSection) actionButtonsSection.style.display = 'none';

    // Capturar el contenido de la cotización
    const element = document.getElementById('cotizacionDisplay');
    const filename = `Cotizacion_Ultratech_${currentCotizacion.nombre_modelo}_${currentCotizacion.tipo_reparacion.replace(/\s/g, '_')}.pdf`;

    try {
        const canvas = await html2canvas(element, { scale: 2 }); // Escala para mejor resolución
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf; // Acceso a jsPDF desde la ventana

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height] // Usar el tamaño del canvas
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(filename);
        // alert('Cotización guardada como PDF!');
    } catch (error) {
        console.error("Error al generar PDF:", error);
        alert("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
        // Restaurar la visibilidad de los botones
        if (actionButtonsSection) actionButtonsSection.style.display = 'flex'; // O el display original
    }
}

async function saveCotizacionAsImage() {
    if (!currentCotizacion) {
        alert('Por favor, genera una cotización primero.');
        return;
    }

    // Temporalmente ocultar botones de acción para una captura limpia
    const actionButtonsSection = document.querySelector('.action-buttons');
    if (actionButtonsSection) actionButtonsSection.style.display = 'none';

    const element = document.getElementById('cotizacionDisplay');
    const filename = `Cotizacion_Ultratech_${currentCotizacion.nombre_modelo}_${currentCotizacion.tipo_reparacion.replace(/\s/g, '_')}.png`;

    try {
        const canvas = await html2canvas(element, { scale: 2 }); // Escala para mejor resolución
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (error) {
        console.error("Error al generar imagen:", error);
        alert("No se pudo generar la imagen. Intenta de nuevo.");
    } finally {
        // Restaurar la visibilidad de los botones
        if (actionButtonsSection) actionButtonsSection.style.display = 'flex'; // O el display original
    }
}

// --- Event Listeners (Detectores de Eventos) ---

// Al cargar la página, cargar las marcas
document.addEventListener('DOMContentLoaded', loadMarcas);

// Cuando la marca cambia, cargar los modelos
marcaSelect.addEventListener('change', () => {
    loadModelos(marcaSelect.value);
});

// Cuando el modelo cambia, cargar los tipos de reparación y obtener cotización
modeloSelect.addEventListener('change', () => {
    loadTiposReparacion(modeloSelect.value);
    // Intentar obtener cotización inmediatamente si todo está seleccionado
    if (marcaSelect.value && modeloSelect.value && reparacionSelect.value) {
        getCotizacion();
    }
});

// Cuando el tipo de reparación cambia, obtener la cotización
reparacionSelect.addEventListener('change', getCotizacion);

// Eventos para los botones de acción
savePdfBtn.addEventListener('click', saveCotizacionAsPdf);
saveImageBtn.addEventListener('click', saveCotizacionAsImage);

// Función para inicializar y deshabilitar botones al cargar
function initializeUI() {
    disableActionButtons();
}
// Ejecutar al cargar la página
initializeUI();