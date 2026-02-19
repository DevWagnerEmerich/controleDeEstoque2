import { openModal, showNotification } from './ui.js';
import { pendingPurchaseOrders, suppliers, updatePurchaseOrder, loadDataAndRenderApp } from './database.js';
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
                    <button class="btn btn-secondary btn-sm" onclick="window.reviewSimulation('${order.id}')">Revisar Simulação</button>
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
            <div class="po-card-body">
                <div class="po-card-info">
                    <span class="info-label">IDENTIFICAÇÃO</span>
                    <h3 class="po-item-id">${order.id}</h3>
                    <p class="po-item-date"><i data-feather="calendar"></i> Data: ${new Date(order.date).toLocaleDateString('pt-BR')}</p>
                    <div class="po-item-status">${statusBadge}</div>
                </div>
                <div class="po-card-actions">
                     ${order.status === 'pending_xml' ? `
                        <button class="btn btn-outline w-full" onclick="window.viewPurchaseOrder('${order.id}')"><i data-feather="eye"></i> Visualizar/Editar</button>
                        <div class="action-row">
                            <button class="btn btn-outline" onclick="window.reviewSimulation('${order.id}')"><i data-feather="edit-2"></i> Revisar</button>
                            <button class="btn btn-outline" onclick="window.attachXml('${order.id}')"><i data-feather="file-text"></i> XML</button>
                        </div>
                        <button class="btn btn-success w-full" onclick="window.finalizeAttachments('${order.id}')"><i data-feather="check-circle"></i> Finalizar Anexos</button>
                     ` : ''}
                     ${order.status === 'pending_stock_entry' ? `
                        <button class="btn btn-primary w-full" onclick="window.stockIn('${order.id}')"><i data-feather="package"></i> Dar Entrada no Estoque</button>
                     ` : ''}
                </div>
            </div>
        </div>
    `}).join('');
    feather.replace(); // Ensure icons are rendered
}

window.attachXml = (orderId) => {
    // --- DATA INTEGRITY CHECK ---
    const order = pendingPurchaseOrders.find(op => op.id === orderId);
    if (!order) {
        showNotification("Erro crítico: Ordem de compra não encontrada para verificação.", "danger");
        return;
    }
    for (const item of order.items) {
        if (!item.code || !item.supplier_id) {
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

window.finalizeAttachments = async (orderId) => {
    const orderIndex = pendingPurchaseOrders.findIndex(op => op.id === orderId);
    if (orderIndex === -1) {
        showNotification("Ordem de compra não encontrada.", "danger");
        return;
    }

    // Validação para garantir que um XML foi anexado e processado.
    if (!pendingPurchaseOrders[orderIndex].xml_attached) {
        showNotification("É necessário anexar e processar um arquivo XML antes de finalizar.", "warning");
        return;
    }

    const updatedStatus = 'pending_stock_entry';
    try {
        await updatePurchaseOrder(orderId, { status: updatedStatus });
        pendingPurchaseOrders[orderIndex].status = updatedStatus;
        renderPurchaseOrders();
        showNotification("Ordem de Compra finalizada. Pronta para entrada no estoque.", "success");
    } catch (error) {
        showNotification(`Erro ao atualizar status da Ordem de Compra: ${error.message}`, "danger");
        console.error("Erro ao finalizar anexos:", error);
    }
};

window.stockIn = (orderId) => {
    stockInPurchaseOrder(orderId);
};

async function handlePoXmlUpload(event) {
    const files = event.target.files;
    const orderId = event.target.getAttribute('data-order-id');
    const fileInput = event.target;

    if (!files.length || !orderId) {
        return;
    }

    const order = pendingPurchaseOrders.find(op => op.id === orderId);
    if (!order) {
        showNotification("Ordem de compra não encontrada.", "danger");
        return;
    }

    const uploadPromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
            uploadAndProcessPoXml(file, orderId, resolve, reject);
        });
    });

    try {
        await Promise.all(uploadPromises);
        // Força a recarga de todos os dados do banco de dados para atualizar a UI
        await loadDataAndRenderApp();
        showNotification("Dados da Ordem de Compra atualizados com sucesso!", "success");
    } catch (error) {
        console.error("Ocorreu um erro durante o processamento dos XMLs:", error);
        showNotification("Ocorreu um erro durante o processamento de um ou mais XMLs.", "danger");
    } finally {
        // Limpa o input de arquivo para permitir novos uploads
        fileInput.value = null;
        fileInput.removeAttribute('data-order-id');
    }
}

window.viewPurchaseOrder = (orderId) => {
    const order = pendingPurchaseOrders.find(op => op.id === orderId);
    if (!order) {
        showNotification("Ordem de compra não encontrada.", "danger");
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

window.reviewSimulation = async (orderId) => {
    const order = pendingPurchaseOrders.find(op => op.id === orderId);
    if (!order) {
        showNotification("Ordem de compra não encontrada.", "danger");
        return;
    }

    // Import dynamically to avoid strict circular dependency issues during load
    const { editPurchaseOrderInSimulation } = await import('./simulation.js');
    editPurchaseOrderInSimulation(order);
};
