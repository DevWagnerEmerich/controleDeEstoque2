// js/utils/validators.js
// Funções de validação reutilizáveis

/**
 * Valida formato de email
 */
export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Valida força da senha
 * Requisitos: mínimo 8 caracteres
 */
export function isValidPassword(password) {
    if (!password || typeof password !== 'string') return false;

    return password.length >= 8;
}

/**
 * Valida senha forte (opcional)
 * Requisitos: mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número
 */
export function isStrongPassword(password) {
    if (!isValidPassword(password)) return false;

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    return hasUpperCase && hasLowerCase && hasNumber;
}

/**
 * Valida CNPJ
 */
export function isValidCNPJ(cnpj) {
    if (!cnpj) return false;

    // Remove caracteres não numéricos
    cnpj = cnpj.replace(/\D/g, '');

    // CNPJ deve ter 14 dígitos
    if (cnpj.length !== 14) return false;

    // Verifica se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cnpj)) return false;

    // Validação dos dígitos verificadores
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(0)) return false;

    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(1)) return false;

    return true;
}

/**
 * Valida NCM (8 dígitos)
 */
export function isValidNCM(ncm) {
    if (!ncm) return false;

    const ncmClean = ncm.replace(/\D/g, '');
    return ncmClean.length === 8;
}

/**
 * Valida número positivo
 */
export function isPositiveNumber(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
}

/**
 * Valida número não negativo
 */
export function isNonNegativeNumber(value) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
}

/**
 * Sanitiza string removendo HTML
 */
export function sanitizeString(str) {
    if (!str || typeof str !== 'string') return '';

    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Valida campo obrigatório
 */
export function isRequired(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return true;
}

/**
 * Valida comprimento mínimo
 */
export function hasMinLength(value, minLength) {
    if (!value || typeof value !== 'string') return false;
    return value.trim().length >= minLength;
}

/**
 * Valida comprimento máximo
 */
export function hasMaxLength(value, maxLength) {
    if (!value || typeof value !== 'string') return true;
    return value.trim().length <= maxLength;
}

/**
 * Retorna mensagem de erro de validação
 */
export function getValidationMessage(field, validationType) {
    const messages = {
        required: `${field} é obrigatório.`,
        email: `${field} deve ser um email válido.`,
        password: `${field} deve ter no mínimo 8 caracteres.`,
        strongPassword: `${field} deve ter no mínimo 8 caracteres, incluindo maiúsculas, minúsculas e números.`,
        cnpj: `${field} deve ser um CNPJ válido.`,
        ncm: `${field} deve ter 8 dígitos.`,
        positive: `${field} deve ser um número positivo.`,
        nonNegative: `${field} não pode ser negativo.`,
        minLength: `${field} é muito curto.`,
        maxLength: `${field} é muito longo.`
    };

    return messages[validationType] || `${field} é inválido.`;
}
