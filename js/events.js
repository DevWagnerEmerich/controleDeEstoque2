import { toggleSidebar, openItemModal, openSuppliersModal, openUsersModal, closeModal, resetUserForm, previewImage } from './ui.js';
import { openOperationModal, finalizeOperationAndGenerate } from './operations.js';
import { openImportModal, downloadImportTemplate, handleFileImport, handlePdfImport, confirmImport } from './import.js';
import { openReportsModal, switchReportTab, renderProductAnalysisReports } from './reports.js';
import { handleLogout } from './auth.js';
import { renderItems } from './ui.js';

export function initializeEventListeners() {
    // Sidebar
    document.getElementById('sidebar-open-btn').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-close-btn').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', toggleSidebar);

    // Main Navigation
    document.getElementById('add-item-btn-sidebar').addEventListener('click', openItemModal);
    document.getElementById('operation-btn-sidebar').addEventListener('click', openOperationModal);
    document.getElementById('suppliers-btn-sidebar').addEventListener('click', openSuppliersModal);
    document.getElementById('reports-btn-sidebar').addEventListener('click', openReportsModal);
    document.getElementById('manage-users-btn-sidebar').addEventListener('click', openUsersModal);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Mobile Navigation
    document.getElementById('operation-btn-mobile').addEventListener('click', openOperationModal);
    document.getElementById('add-item-btn-mobile').addEventListener('click', openItemModal);
    document.getElementById('suppliers-btn-mobile').addEventListener('click', openSuppliersModal);
    document.getElementById('reports-btn-mobile').addEventListener('click', openReportsModal);
    document.getElementById('manage-users-btn-mobile').addEventListener('click', openUsersModal);

    // Main content controls
    document.getElementById('searchInput').addEventListener('keyup', renderItems);
    document.getElementById('sortSelect').addEventListener('change', renderItems);
    document.getElementById('filterSelect').addEventListener('change', renderItems);
    document.getElementById('import-btn').addEventListener('click', openImportModal);

    // Modals
    document.getElementById('confirm-modal-cancel-btn').addEventListener('click', () => closeModal('confirm-modal'));
    document.querySelectorAll('.closeModalBtn').forEach(btn => {
        const modalId = btn.closest('.modal-backdrop').id;
        btn.addEventListener('click', () => closeModal(modalId));
    });
    document.getElementById('reset-user-form-btn').addEventListener('click', resetUserForm);
    document.getElementById('itemImageInput').addEventListener('change', (e) => previewImage(e, 'imagePreview', 'imagePlaceholder'));
    
    // Import Modal
    document.getElementById('download-template-btn').addEventListener('click', downloadImportTemplate);
    document.getElementById('xlsx-importer').addEventListener('change', handleFileImport);
    document.getElementById('pdf-importer-modal').addEventListener('change', handlePdfImport);
    document.getElementById('confirm-import-btn').addEventListener('click', confirmImport);

    // Reports Modal
    document.getElementById('reports-tab-nav').addEventListener('click', (e) => {
        if (e.target.matches('.report-tab')) {
            switchReportTab(e.target, e.target.dataset.tab);
        }
    });
    document.getElementById('reports-period-filter').addEventListener('change', renderProductAnalysisReports);

    // Finalize Operation Buttons
    document.getElementById('finalize-invoice-btn').addEventListener('click', () => finalizeOperationAndGenerate('invoice'));
    document.getElementById('finalize-packlist-btn').addEventListener('click', () => finalizeOperationAndGenerate('packlist'));
}