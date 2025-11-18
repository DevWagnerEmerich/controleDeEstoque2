import { openModal, showNotification } from './ui.js';
import { pendingPurchaseOrders, saveData, suppliers, loadPendingPurchaseOrders } from './database.js';
import { uploadAndProcessPoXml } from './import.js';
import { stockInPurchaseOrder } from './operations.js';

export function openPurchaseOrdersModal() {
    renderPurchaseOrders();
    openModal('purchase-orders-modal');
}

function renderPurchaseOrders() {
    const container = document.getElementById('purchase-orders-list-container');
    
    let pendingOrders = pendingPurchaseOrders.filter(op => op.status !== 'completed');

    // Sort by date in descending order (newest first)
    pendingOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (pendingOrders.length === 0) {
        container.innerHTML = '<div class="panel-empty-state"><p>Nenhuma ordem de compra pendente.</p></div>';
        return;
    }

    container.innerHTML = pendingOrders.map(order => {
        let actionButton = '';
        let statusBadge = '';

        if (order.status === 'pending_xml') {
            statusBadge = '<span class="badge status-pending">Aguardando XML</span>';
            actionButton = `
                <div class="po-button-group">
                    <button class="btn btn-secondary btn-sm" onclick="window.viewPurchaseOrder('${order.id}')">Visualizar/Editar</button>
                    <button class="btn btn-secondary btn-sm" onclick="window.attachXml('${order.id}')">Anexar XML</button>
                    <button class="btn btn-success btn-sm" onclick="window.finalizeAttachments('${order.id}')">Finalizar Anexos</button>
                </div>
            `;
        } else if (order.status === 'pending_stock_entry') {
            statusBadge = '<span class="badge status-ready">Pronto para Entrada</span>';
            actionButton = `<button class="btn btn-primary btn-sm" onclick="window.stockIn('${order.id}')">Dar Entrada no Estoque</button>`;
        }

        return `
        <div class="po-item-card">
            <div class="po-item-info">
                <p class="po-item-id">ID: ${order.id}</p>
                <p class="po-item-date">Data: ${new Date(order.date).toLocaleDateString('pt-BR')}</p>
                <p class="po-item-status">Status: ${statusBadge}</p>
            </div>
            <div class="po-item-actions">
                ${actionButton}
            </div>
        </div>
    `}).join('');
}

window.attachXml = (orderId) => {
    // --- DATA INTEGRITY CHECK ---
    const order = pendingPurchaseOrders.find(op => op.id === orderId);
    if (!order) {
        showNotification("Erro crítico: Ordem de compra não encontrada para verificação.", "danger");
        return;
    }
    for (const item of order.items) {
        if (!item.code || !item.supplierId) {
            const errorMessage = `Erro de Integridade de Dados na OC ${orderId}: O item "${item.name}" (ID: ${item.id}) está sem 'código' ou 'ID do fornecedor'. Os dados podem ter sido perdidos durante a criação ou edição da OC.`;
            showNotification(errorMessage, "danger", 10000);
            console.error(errorMessage, "Item data:", item);
            return; // Stop the process
        }
    }
    // --- END CHECK ---

    const fileInput = document.getElementById('po-xml-upload');
    fileInput.setAttribute('data-order-id', orderId);
    fileInput.click();
};

window.finalizeAttachments = (orderId) => {
    const orderIndex = pendingPurchaseOrders.findIndex(op => op.id === orderId);
    if (orderIndex === -1) {
        showNotification("Ordem de compra não encontrada.", "danger");
        return;
    }

    if (!pendingPurchaseOrders[orderIndex].xmlAttached) {
        showNotification("Anexe pelo menos um arquivo XML antes de finalizar.", "warning");
        return;
    }

    pendingPurchaseOrders[orderIndex].status = 'pending_stock_entry';
    saveData();
    renderPurchaseOrders();
    showNotification("Ordem de Compra finalizada. Pronta para entrada no estoque.", "success");
};

window.stockIn = (orderId) => {
    stockInPurchaseOrder(orderId);
};

function handlePoXmlUpload(event) {
    const files = event.target.files;
    const orderId = event.target.getAttribute('data-order-id');
    const fileInput = event.target; // Keep a reference to the input element

    if (!files.length || !orderId) {
        return;
    }

    const order = pendingPurchaseOrders.find(op => op.id === orderId);
    if (!order) {
        showNotification("Ordem de compra não encontrada.", "danger");
        return;
    }

    const numFiles = files.length; // Store the number of files

    const uploadPromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
            uploadAndProcessPoXml(file, orderId, resolve, reject);
        });
    });

    Promise.all(uploadPromises).then(() => {
        // Force a reload of the pending POs from localStorage to ensure consistency
        loadPendingPurchaseOrders();
        renderPurchaseOrders();
        // The notification is now shown for each individual file processed.
    }).catch(error => {
        console.error("Ocorreu um erro durante o processamento dos XMLs:", error);
        showNotification("Ocorreu um erro durante o processamento de um ou mais XMLs.", "danger");

        // Also clean up on error
        fileInput.value = null;
        fileInput.removeAttribute('data-order-id');
    });
}

window.viewPurchaseOrder = (orderId) => {
    // Read directly from localStorage to ensure data is fresh
    const pendingPOsString = localStorage.getItem('stockPendingPOs_v1');
    const localPendingPOs = pendingPOsString ? JSON.parse(pendingPOsString) : [];
    
    const order = localPendingPOs.find(op => op.id === orderId);
    if (!order) {
        showNotification("Ordem de compra não encontrada no armazenamento local.", "danger");
        return;
    }

    const documentData = {
        operation: order,
        allSuppliers: suppliers 
    };

    localStorage.setItem('currentDocument', JSON.stringify(documentData));
    window.open('gerenciador_invoice.html?origin=purchase-orders', '_self');
};

document.addEventListener('DOMContentLoaded', () => {
    const poXmlUpload = document.getElementById('po-xml-upload');
    if (poXmlUpload) {
        poXmlUpload.addEventListener('change', handlePoXmlUpload);
    }
});
