import { openItemModal, openSuppliersModal, openUsersModal, closeModal, resetUserForm, previewImage, openModal, openOperationsHistoryModal, showConfirmModal, showNotification } from './ui.js';
import { openOperationModal, saveManualOperation } from './operations.js';
import { openSimulationModal, previewSimulationAsInvoice, saveSimulationAsDraft, createPurchaseOrder, openSimAddItemModal } from './simulation.js';
import { openReportsModal, switchReportTab, renderProductAnalysisReports, renderDailyMovementsReport } from './reports.js';
import { openPurchaseOrdersModal } from './purchase-orders.js';
import { handleLogout } from './auth.js';
import { renderItems } from './ui.js';
import { clearAllData } from './database.js';

export function initializeEventListeners() {
    const addClickListener = (id, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', handler);
        }
    };

    const addChangeListener = (id, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', handler);
        }
    };
    
    const addKeyupListener = (id, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('keyup', handler);
        }
    };

    // --- Mobile Header & Menu ---
    addClickListener('add-item-btn-header', openItemModal);
    addClickListener('menu-suppliers', openSuppliersModal);
    addClickListener('menu-users', openUsersModal);
    addClickListener('menu-packlist', () => window.open('gerador_packing_list.html', '_self'));
    addClickListener('menu-invoice', () => window.open('gerenciador_invoice.html', '_self'));
    addClickListener('menu-purchase-orders', openPurchaseOrdersModal);
    addClickListener('logout-btn-menu', handleLogout);

    // --- Desktop Header ---
    addClickListener('desktop-add-item-btn', openItemModal);
    addClickListener('desktop-suppliers-btn', openSuppliersModal);
    addClickListener('desktop-users-btn', openUsersModal);
    addClickListener('desktop-logout-btn', handleLogout);
    addClickListener('desktop-reports-btn', openReportsModal);
    addClickListener('desktop-nav-purchase-orders', openPurchaseOrdersModal);

    // --- Operations Hub & Dropdown ---
    // Mobile: Still uses the modal
    addClickListener('nav-operations', () => openModal('operations-hub-modal'));

    // Desktop: Uses the new dropdown
    const desktopOperationsBtn = document.getElementById('desktop-nav-operations');
    const operationsDropdown = document.getElementById('operations-dropdown');

    if (desktopOperationsBtn && operationsDropdown) {
        desktopOperationsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isHidden = operationsDropdown.classList.toggle('hidden');
            desktopOperationsBtn.classList.toggle('open', !isHidden);
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!desktopOperationsBtn.contains(e.target) && !operationsDropdown.contains(e.target)) {
                operationsDropdown.classList.add('hidden');
                desktopOperationsBtn.classList.remove('open');
            }
        });
    }

    const closeDropdown = () => {
        if(operationsDropdown) {
            operationsDropdown.classList.add('hidden');
            desktopOperationsBtn.classList.remove('open');
        }
    };

    // Dropdown items
    addClickListener('dropdown-import-op-btn', () => {
        closeDropdown();
        document.getElementById('xml-upload-main').click();
    });
    addClickListener('dropdown-simulate-op-btn', () => {
        closeDropdown();
        openSimulationModal();
    });
    addClickListener('dropdown-history-op-btn', () => {
        closeDropdown();
        openOperationsHistoryModal();
    });

    // Old Hub buttons (still used by mobile)
    addClickListener('hub-import-op-btn', () => {
        closeModal('operations-hub-modal');
        document.getElementById('xml-upload-main').click();
    });
    addClickListener('hub-simulate-op-btn', () => {
        closeModal('operations-hub-modal');
        openSimulationModal();
    });
    addClickListener('hub-history-op-btn', () => {
        closeModal('operations-hub-modal');
        openOperationsHistoryModal();
    });

    // --- Simulation Modal ---
    addClickListener('sim-add-new-item-btn', openSimAddItemModal);
    addClickListener('sim-preview-invoice-btn', previewSimulationAsInvoice);
    addClickListener('sim-save-draft-btn', saveSimulationAsDraft);
    addClickListener('sim-finalize-btn', createPurchaseOrder);
    addChangeListener('sim-select-all-chk', (event) => {
        if (event.target.checked) {
            const availableItemsDivs = document.querySelectorAll('#sim-available-items .op-item-card.available:not(.added)');
            if (availableItemsDivs.length === 0) {
                showNotification('Nenhum item disponível para adicionar.', 'info');
            } else {
                availableItemsDivs.forEach(div => {
                    const addButton = div.querySelector('.btn-add-op');
                    if (addButton) {
                        addButton.click();
                    }
                });
                showNotification(`${availableItemsDivs.length} item(ns) adicionado(s) à simulação.`, 'success');
            }
            event.target.checked = false;
        }
    });

    // --- Dashboard Controls ---
    addKeyupListener('searchInput', renderItems);
    addChangeListener('sortSelect', renderItems);
    addChangeListener('filterSelect', renderItems);

    // --- Generic Modals ---
    addClickListener('confirm-modal-cancel-btn', () => closeModal('confirm-modal'));
    document.querySelectorAll('.closeModalBtn').forEach(btn => {
        const modalId = btn.closest('.modal-backdrop')?.id;
        if (modalId) {
            btn.addEventListener('click', () => closeModal(modalId));
        }
    });
    addClickListener('reset-user-form-btn', resetUserForm);
    addChangeListener('itemImageInput', (e) => previewImage(e, 'imagePreview', 'imagePlaceholder'));
    
    // --- Reports Modal ---
    addClickListener('reports-tab-nav', (e) => {
        if (e.target.matches('.report-tab')) {
            switchReportTab(e.target, e.target.dataset.tab);
        }
    });
    addChangeListener('reports-period-filter', renderProductAnalysisReports);
    addChangeListener('daily-movements-date-picker', renderDailyMovementsReport);

    // --- Manual Operation Modal ---
    addClickListener('save-operation-btn', saveManualOperation);

    // --- Login Screen ---
    addClickListener('toggle-password-btn', (e) => {
        if (e.target.id === 'password') return;

        const passwordInput = document.getElementById('password');
        const icon = document.querySelector('.password-toggle-icon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.setAttribute('data-feather', 'eye');
        } else {
            passwordInput.type = 'password';
            icon.setAttribute('data-feather', 'eye-off');
        }
        feather.replace();
    });

    addClickListener('menu-clear-data', () => {
        showConfirmModal(
            'Limpar todos os dados?',
            'Esta ação é irreversível e irá apagar todos os itens, fornecedores e operações. Os dados de utilizador não serão afetados.',
            clearAllData
        );
    });

    feather.replace();
}