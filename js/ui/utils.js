
// js/ui/utils.js

export function normalizeCnpj(cnpj) {
    return cnpj ? String(cnpj).replace(/\D/g, '') : '';
}

export function formatCnpj(value) {
    if (!value) return "";
    value = value.replace(/\D/g, '');
    value = value.replace(/^(\d{2})(\d)/, '$1.$2');
    value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
    value = value.replace(/(\d{4})(\d)/, '$1-$2');
    return value;
}

export function formatPhone(value) {
    if (!value) return "";
    value = value.replace(/\D/g, '');
    value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
    value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    return value;
}

export function formatNcm(value) {
    if (!value) return "";
    value = value.replace(/\D/g, '');
    value = value.replace(/^(\d{4})(\d)/, '$1.$2');
    value = value.replace(/^(\d{4})\.(\d{2})(\d)/, '$1.$2.$3');
    return value;
}

export const getStatus = (item) => {
    if (item.quantity <= 0) return { text: 'Esgotado', class: 'bg-gray-200 text-gray-800', level: 3 };
    if (item.quantity <= item.min_quantity) return { text: 'Crítico', class: 'bg-red-100 text-red-800', level: 2 };
    if (item.quantity <= item.min_quantity * 1.2) return { text: 'Baixo', class: 'bg-yellow-100 text-yellow-800', level: 1 };
    return { text: 'OK', class: 'bg-green-100 text-green-800', level: 0 };
};

export const formatCurrency = (value, currency = 'USD') => {
    const options = { style: 'currency', currency: currency, minimumFractionDigits: 2 };
    const locale = currency === 'BRL' ? 'pt-BR' : 'en-US';
    return new Intl.NumberFormat(locale, options).format(value || 0);
}

export function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerText = message;
    container.appendChild(notif);

    setTimeout(() => {
        notif.classList.add('visible');
    }, 10);

    setTimeout(() => {
        notif.classList.remove('visible');
        setTimeout(() => notif.remove(), 500);
    }, duration);
}

export function previewImage(event, previewId, placeholderId) {
    const preview = document.getElementById(previewId);
    const placeholder = document.getElementById(placeholderId);
    if (event && event.target.files && event.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            if (placeholder) placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(event.target.files[0]);
    } else {
        preview.src = '#';
        preview.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
    }
}

export function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

export const PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='14' fill='%239ca3af' text-anchor='middle' dy='.3em'%3ESem Imagem%3C/text%3E%3C/svg%3E";

