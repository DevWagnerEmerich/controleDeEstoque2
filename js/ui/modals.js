
// js/ui/modals.js

// Focus Management
let lastFocusedElement = null;

export function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        lastFocusedElement = document.activeElement; // Save focus
        document.body.classList.add('modal-is-open');
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false'); // A11y
        const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus(); // Focus first element
        if (window.feather) window.feather.replace();
    }
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        document.body.classList.remove('modal-is-open');
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true'); // A11y
        if (lastFocusedElement) {
            lastFocusedElement.focus(); // Restore focus
            lastFocusedElement = null;
        }
        history.pushState("", document.title, window.location.pathname + window.location.search);
        setTimeout(() => {
            const anyViewVisible = [...document.querySelectorAll('.main-view')].some(
                view => !view.classList.contains('hidden')
            );
            if (!anyViewVisible) {
                showView('dashboard');
            }
        }, 300);
    }
}

export function showConfirmModal(title, text, onConfirm) {
    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-text').innerText = text;

    const modal = document.getElementById('confirm-modal');
    // Remove previous listeners to avoid duplicates if generic
    const box = modal.cloneNode(true);
    modal.parentNode.replaceChild(box, modal); // Cloning removes listeners

    // Re-bind cancel
    document.getElementById('confirm-modal-cancel-btn').addEventListener('click', () => {
        closeModal('confirm-modal');
    });

    document.getElementById('confirm-modal-btn').addEventListener('click', () => {
        onConfirm();
        closeModal('confirm-modal');
    });

    openModal('confirm-modal');
}

export function showView(viewName) {
    document.querySelectorAll('.main-view').forEach(view => {
        view.classList.add('hidden');
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    history.pushState("", document.title, window.location.pathname + window.location.search);

    const headerTitle = document.getElementById('header-title');
    const viewTitles = {
        dashboard: 'Dashboard',
        operations: 'Central de Operações',
        reports: 'Relatórios',
        menu: 'Menu'
    };
    headerTitle.textContent = viewTitles[viewName] || 'StockControl Pro';

    document.querySelectorAll('.nav-item').forEach(link => link.classList.remove('active'));
    const activeMobileLink = document.getElementById(`nav-${viewName}`);
    if (activeMobileLink) {
        activeMobileLink.classList.add('active');
    }

    document.querySelectorAll('.top-nav .nav-link').forEach(link => link.classList.remove('active'));
    const activeDesktopLink = document.getElementById(`desktop-nav-${viewName}`);
    if (activeDesktopLink) {
        activeDesktopLink.classList.add('active');
    }
}
