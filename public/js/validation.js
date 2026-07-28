/**
 * validation.js - Validaciones del frontend
 * Maneja la validación de formularios y datos
 */

class ValidationService {
    constructor() {
        this.rules = {
            cedula: {
                pattern: /^\d{7,10}$/,
                message: 'La cédula debe tener entre 7 y 10 dígitos numéricos'
            },
            phoneNumber: {
                pattern: /^\d{7,15}$/,
                message: 'El número de teléfono debe tener entre 7 y 15 dígitos'
            },
            password: {
                pattern: /^.{4,20}$/,
                message: 'La clave debe tener entre 4 y 20 caracteres'
            },
            nombre: {
                pattern: /^[a-zA-ZáéíóúñÑ\s]{2,50}$/,
                message: 'El nombre debe tener entre 2 y 50 caracteres'
            },
            email: {
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Email inválido'
            },
            monto: {
                pattern: /^\d+(\.\d{1,2})?$/,
                message: 'Monto inválido. Solo números y hasta 2 decimales'
            },
            otp: {
                pattern: /^\d{4,6}$/,
                message: 'El código debe tener entre 4 y 6 dígitos'
            }
        };
    }

    /**
     * Valida un campo específico
     */
    validateField(value, ruleName) {
        const rule = this.rules[ruleName];
        if (!rule) return { valid: true, message: '' };

        const valid = rule.pattern.test(value.trim());
        return {
            valid,
            message: valid ? '' : rule.message
        };
    }

    /**
     * Valida múltiples campos
     */
    validateForm(data, rules) {
        const errors = {};
        let isValid = true;

        for (const [field, ruleName] of Object.entries(rules)) {
            const value = data[field] || '';
            const result = this.validateField(value, ruleName);

            if (!result.valid) {
                errors[field] = result.message;
                isValid = false;
            }
        }

        return { isValid, errors };
    }

    /**
     * Valida cédula específicamente
     */
    validateCedula(cedula) {
        const limpio = cedula.replace(/\D/g, '');
        return {
            valid: limpio.length >= 7 && limpio.length <= 10,
            value: limpio,
            message: limpio.length >= 7 && limpio.length <= 10 ?
                '' :
                'La cédula debe tener entre 7 y 10 dígitos'
        };
    }

    /**
     * Sanitiza una cédula (elimina caracteres no numéricos)
     */
    sanitizeCedula(cedula) {
        return cedula.replace(/\D/g, '');
    }

    /**
     * Formatea una fecha
     */
    formatDate(date, format = 'DD/MM/YYYY') {
        if (!date) return 'No disponible';
        if (date === '0000-00-00') return 'No disponible';

        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return date;

            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();

            if (format === 'DD/MM/YYYY') {
                return `${day}/${month}/${year}`;
            } else if (format === 'YYYY-MM-DD') {
                return `${year}-${month}-${day}`;
            } else if (format === 'DD-MM-YYYY') {
                return `${day}-${month}-${year}`;
            }
            return `${day}/${month}/${year}`;
        } catch (e) {
            return date;
        }
    }

    /**
     * Ofusca datos sensibles
     */
    ofuscarDato(valor, mostrar = 4) {
        if (!valor) return '***';
        if (valor.length <= mostrar) return valor;

        const visible = valor.slice(0, mostrar);
        const ocultos = '*'.repeat(Math.min(valor.length - mostrar, 8));
        return visible + ocultos;
    }

    /**
     * Valida que un campo no esté vacío
     */
    isRequired(value) {
        return value && value.trim().length > 0;
    }

    /**
     * Valida que un valor sea un número
     */
    isNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    }

    /**
     * Valida rango de un número
     */
    isInRange(value, min, max) {
        const num = parseFloat(value);
        return !isNaN(num) && num >= min && num <= max;
    }

    /**
     * Valida que un string tenga una longitud específica
     */
    hasLength(value, min, max) {
        const length = value ? value.length : 0;
        return length >= min && length <= max;
    }

    /**
     * Escapa caracteres especiales para HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    /**
     * Valida que un archivo sea una imagen
     */
    isValidImage(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        return allowedTypes.includes(file.type);
    }

    /**
     * Valida el tamaño de un archivo (en MB)
     */
    isValidFileSize(file, maxMB = 5) {
        const maxBytes = maxMB * 1024 * 1024;
        return file.size <= maxBytes;
    }

    /**
     * Valida que un OTP sea válido
     */
    validateOTP(otp) {
        const clean = otp.replace(/\D/g, '');
        return {
            valid: clean.length >= 4 && clean.length <= 6,
            value: clean,
            message: clean.length >= 4 && clean.length <= 6 ?
                '' :
                'El código debe tener entre 4 y 6 dígitos'
        };
    }

    /**
     * Valida email
     */
    validateEmail(email) {
        const result = this.validateField(email, 'email');
        return {
            valid: result.valid,
            value: email.trim().toLowerCase(),
            message: result.message
        };
    }
}

// Exportar instancia única
const validationService = new ValidationService();

// Hacer disponible globalmente
window.validationService = validationService;

console.log('✅ validation.js cargado correctamente');