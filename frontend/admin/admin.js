// frontend/admin.js


const ADMIN_API_KEY = 'Tfebc6a3c-a8c0-4a88-b753-13982513feed'  // ¡IMPORTANTE! Usa la misma clave que en app.py
// const API_BASE_URL = 'http://127.0.0.1:5000'; // Asegúrate de que sea esta para local
const API_BASE_URL = 'https://ultratech-backend.onrender.com'; // Asegúrate de que sea esta para local

const reparacionForm = document.getElementById('reparacionForm');
const formReparacionId = document.getElementById('formReparacionId');
const formModeloSelect = document.getElementById('formModeloSelect');
const formTipoReparacion = document.getElementById('formTipoReparacion');
const formPrecio = document.getElementById('formPrecio');
const formDisponibilidad = document.getElementById('formDisponibilidad');
const formDescripcionBreve = document.getElementById('formDescripcionBreve');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const reparacionesTableBody = document.getElementById('reparacionesTableBody');
const adminMessage = document.getElementById('adminMessage');
const newModelName = document.getElementById('newModelName');
const newModelBrandInput = document.getElementById('newModelBrandInput'); // CAMBIO: era newModelBrandSelect
const modelForm = document.getElementById('modelForm');
const modelMessage = document.getElementById('modelMessage');
let editMode = false; // Variable para saber si estamos editando o agregando




// --- Funciones de Utilidad para Interacción con la API ---

async function fetchAdminAPI(endpoint, method = 'GET', data = null) {
    try {
        const headers = {
            'X-Api-Key': ADMIN_API_KEY
        };
        if (data) {
            headers['Content-Type'] = 'application/json';
        }

        const options = {
            method: method,
            headers: headers
        };
        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || `Error HTTP: ${response.status}`);
        }
        return responseData;
    } catch (error) {
        console.error("Error en la API:", error);
        showMessage('error', error.message);
        return null;
    }
}

// --- Funciones para Mensajes de Alerta ---
function showMessage(type, message) {
    adminMessage.textContent = message;
    adminMessage.className = `alert-message alert-${type}`;
    adminMessage.style.display = 'block';
    setTimeout(() => {
        adminMessage.style.display = 'none';
    }, 5000); // Ocultar mensaje después de 5 segundos
}

// ... (funciones showMessage existente) ...

function showModelMessage(type, message) {
    modelMessage.textContent = message;
    modelMessage.className = `alert-message alert-${type}`;
    modelMessage.style.display = 'block';
    setTimeout(() => {
        modelMessage.style.display = 'none';
    }, 5000); // Ocultar mensaje después de 5 segundos
}


async function loadModelosForForm() {
    formModeloSelect.innerHTML = '<option value="">Cargando modelos...</option>';

    let modelos = await fetchAdminAPI('/modelos/1'); // Esto solo trae modelos de marca ID 1. No es ideal.

    modelos = await fetchAdminAPI('/admin/modelos'); // Necesita este endpoint en app.py para funcionar bien.


    if (modelos && modelos.length > 0) {
        formModeloSelect.innerHTML = '<option value="">-- Selecciona un modelo --</option>';
        modelos.forEach(modelo => {
            const option = document.createElement('option');
            option.value = modelo.id_modelo;
            option.textContent = `${modelo.nombre_modelo} (${modelo.nombre_marca})`; // Muestra Modelo (Marca)
            formModeloSelect.appendChild(option);
        });
    } else {
        formModeloSelect.innerHTML = '<option value="">No hay modelos disponibles. Agrega Modelos primero.</option>';
    }
}

modelForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        nombre_modelo: newModelName.value.trim(), // Limpiar espacios
        nombre_marca: newModelBrandInput.value.trim() // CAMBIO: obtener del input de texto
    };

    // Validar que ambos campos no estén vacíos
    if (!data.nombre_modelo || !data.nombre_marca) {
        showModelMessage('error', 'Por favor, completa el nombre del modelo y el nombre de la marca.');
        return;
    }

    const result = await fetchAdminAPI('/admin/modelo', 'POST', data);

    if (result) {
        showModelMessage('success', result.message);
        modelForm.reset();
        // Recargar el select de modelos en el formulario de reparaciones, por si el nuevo modelo es relevante.
        // Esto es crucial porque el formulario de reparaciones todavía usa un select.
        await loadModelosForForm();
    }
});



// ...existing code...

// modelForm.addEventListener('submit', async (e) => {
//     e.preventDefault();

//     const data = {
//         nombre_modelo: newModelName.value,
//         id_marca: parseInt(newModelBrandInput.value)
//     };

//     const result = await fetchAdminAPI('/admin/modelo', 'POST', data); // Llama a tu nueva ruta POST

//     if (result) {
//         showModelMessage('success', result.message);
//         modelForm.reset(); // Limpiar formulario
//         // Recargar el select de modelos en el formulario de reparaciones, por si el nuevo modelo es relevante.
//         await loadModelosForForm();
//     }
// });

// ... (Event listener para reparacionesTableBody existente) ...

// ... (Event listener para cancelEditBtn existente) ...

// --- Inicialización (Modificar para cargar marcas para el nuevo modelo) ---
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar modelos y reparaciones para la tabla
    await loadModelosForForm();
    await loadReparacionesTable();
    // NUEVO: Cargar marcas para el formulario de nuevo modelo
    // await loadBrandsForNewModel();
});

// --- Carga de Reparaciones en la Tabla ---
async function loadReparacionesTable() {
    reparacionesTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Cargando reparaciones...</td></tr>';
    const reparaciones = await fetchAdminAPI('/admin/reparaciones', 'GET');

    if (reparaciones && reparaciones.length > 0) {
        reparacionesTableBody.innerHTML = ''; // Limpiar mensaje de carga
        reparaciones.forEach(rep => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${rep.id_reparacion}</td>
                <td>${rep.nombre_marca}</td>
                <td>${rep.nombre_modelo}</td>
                <td>${rep.tipo_reparacion}</td>
                <td>L. ${rep.precio.toFixed(2)}</td>
                <td>${rep.disponibilidad}</td>
                <td>${rep.descripcion_breve || 'N/A'}</td>
                <td class="admin-actions">
                    <button class="edit-btn" data-id="${rep.id_reparacion}">Editar</button>
                    <button class="delete-btn" data-id="${rep.id_reparacion}">Eliminar</button>
                </td>
            `;
            reparacionesTableBody.appendChild(row);
        });
    } else {
        reparacionesTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No hay reparaciones en la base de datos.</td></tr>';
    }
}

// --- Manejo del Formulario (Agregar/Editar) ---
reparacionForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevenir el envío por defecto del formulario

    const data = {
        id_modelo: parseInt(formModeloSelect.value),
        tipo_reparacion: formTipoReparacion.value,
        precio: parseFloat(formPrecio.value),
        disponibilidad: formDisponibilidad.value,
        descripcion_breve: formDescripcionBreve.value
    };

    let result = null;
    if (editMode) {
        const id = formReparacionId.value;
        result = await fetchAdminAPI(`/admin/reparacion/${id}`, 'PUT', data);
    } else {
        result = await fetchAdminAPI('/admin/reparacion', 'POST', data);
    }

    if (result) {
        showMessage('success', result.message);
        reparacionForm.reset(); // Limpiar formulario
        formReparacionId.value = ''; // Limpiar ID oculto
        editMode = false; // Salir de modo edición
        submitBtn.textContent = 'Agregar Reparación'; // Cambiar texto del botón
        cancelEditBtn.style.display = 'none'; // Ocultar botón cancelar
        loadReparacionesTable(); // Recargar tabla
    }
});

// --- Manejo de Botones de Editar/Eliminar en la Tabla ---
reparacionesTableBody.addEventListener('click', async (e) => {
    // Botón Editar
    if (e.target.classList.contains('edit-btn')) {
        const id = e.target.dataset.id;
        // Obtener los datos de la fila para rellenar el formulario
        const row = e.target.closest('tr');
        const cells = row.querySelectorAll('td');
        const reparacionData = {
            id_reparacion: id,
            nombre_marca: cells[1].textContent, // Para mostrar
            nombre_modelo: cells[2].textContent, // Para mostrar
            tipo_reparacion: cells[3].textContent,
            precio: parseFloat(cells[4].textContent.replace('L. ', '')),
            disponibilidad: cells[5].textContent,
            descripcion_breve: cells[6].textContent === 'N/A' ? '' : cells[6].textContent
        };


        const fullReparacion = await fetchAdminAPI(`/admin/reparacion/${id}`, 'GET'); // Asume un endpoint GET /admin/reparacion/<id>
        if (fullReparacion) {
            formReparacionId.value = fullReparacion.id_reparacion;
            formModeloSelect.value = fullReparacion.id_modelo; // Establecer el select con el ID del modelo
            formTipoReparacion.value = fullReparacion.tipo_reparacion;
            formPrecio.value = fullReparacion.precio;
            formDisponibilidad.value = fullReparacion.disponibilidad;
            formDescripcionBreve.value = fullReparacion.descripcion_breve || '';

            editMode = true;
            submitBtn.textContent = 'Actualizar Reparación';
            cancelEditBtn.style.display = 'inline-block'; // Mostrar botón cancelar
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll al formulario
        }

    }
    // Botón Eliminar
    else if (e.target.classList.contains('delete-btn')) {
        const id = e.target.dataset.id;
        if (confirm(`¿Estás seguro de que quieres eliminar la reparación con ID ${id}?`)) {
            const result = await fetchAdminAPI(`/admin/reparacion/${id}`, 'DELETE');
            if (result) {
                showMessage('success', result.message);
                loadReparacionesTable(); // Recargar tabla
            }
        }
    }
});

// --- Cancelar Edición ---
cancelEditBtn.addEventListener('click', () => {
    reparacionForm.reset();
    formReparacionId.value = '';
    editMode = false;
    submitBtn.textContent = 'Agregar Reparación';
    cancelEditBtn.style.display = 'none';
});

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar modelos y reparaciones para la tabla
    await loadModelosForForm();
    await loadReparacionesTable();
    // ELIMINAR o COMENTAR esta línea si loadBrandsForNewModel ya no existe
    // await loadBrandsForNewModel();
});


// --- Inicialización (modificada si eliminaste loadBrandsForNewModel) ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadModelosForForm();
    await loadReparacionesTable();

});