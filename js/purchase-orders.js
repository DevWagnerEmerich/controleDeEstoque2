import { openModal, showNotification } from './ui.js';
import { 
    getAllPendingPurchaseOrders, updatePendingPurchaseOrder, deletePendingPurchaseOrder,
    getAllSuppliers // Para a função viewPurchaseOrder
} from './database.js';
import { uploadAndProcessPoXml } from './import.js'; // Esta função precisará ser adaptada
import { stockInPurchaseOrder } from './operations.js'; // Já adaptada
import { appData } from './main.js'; // Importa a variável global de dados

export async function openPurchaseOrdersModal() { // Adicionado async aqui
    await renderPurchaseOrders(); // Espera a renderização
    openModal('purchase-orders-modal');
}

async function renderPurchaseOrders() { // Adicionado async aqui
    const container = document.getElementById('purchase-orders-list-container');
    
    let pendingOrders = appData.pendingPurchaseOrders.filter(op => op.status !== 'completed'); // Usa appData.pendingPurchaseOrders

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
                <p class="po-item-id">ID: ${order.po_id}</p>
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
    const order = appData.pendingPurchaseOrders.find(op => op.id === orderId); // Usa appData.pendingPurchaseOrders
    if (!order) {
        showNotification("Erro crítico: Ordem de compra não encontrada para verificação.", "danger");
        return;
    }
    for (const item of order.items) {
        if (!item.code || !item.supplier_id) { // Ajustado para supplier_id
            const errorMessage = `Erro de Integridade de Dados na OC ${order.po_id}: O item "${item.name}" (ID: ${item.id}) está sem 'código' ou 'ID do fornecedor'. Os dados podem ter sido perdidos durante a criação ou edição da OC.`; // Ajustado para po_id
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

window.finalizeAttachments = async (orderId) => { // Adicionado async aqui
    const order = appData.pendingPurchaseOrders.find(op => op.id === orderId); // Usa appData.pendingPurchaseOrders
    if (!order) {
        showNotification("Ordem de compra não encontrada.", "danger");
        return;
    }

    if (!order.xmlAttached) { // Assume que 'xmlAttached' é uma propriedade da ordem
        showNotification("Anexe pelo menos um arquivo XML antes de finalizar.", "warning");
        return;
    }

    const updatedOrder = await updatePendingPurchaseOrder(orderId, { status: 'pending_stock_entry' }); // Atualiza no Supabase
    if (updatedOrder) {
        showNotification("Ordem de Compra finalizada. Pronta para entrada no estoque.", "success");
        await renderPurchaseOrders(); // Espera a renderização
    } else {
        showNotification("Erro ao finalizar anexos da Ordem de Compra!", "danger");
    }
};

window.stockIn = async (orderId) => { // Adicionado async aqui
    await stockInPurchaseOrder(orderId); // stockInPurchaseOrder já é assíncrona e atualiza a UI
};

async function handlePoXmlUpload(event) { // Adicionado async aqui
    const files = event.target.files;
    const orderId = event.target.getAttribute('data-order-id');
    const fileInput = event.target;

    if (!files.length || !orderId) {
        return;
    }

    const order = appData.pendingPurchaseOrders.find(op => op.id === orderId); // Usa appData.pendingPurchaseOrders
    if (!order) {
        showNotification("Ordem de compra não encontrada.", "danger");
        return;
    }

    const uploadPromises = Array.from(files).map(file => {
        return new Promise(async (resolve, reject) => { // Adicionado async aqui
            // uploadAndProcessPoXml precisará ser adaptada para Supabase
            // Por enquanto, apenas simula o processamento
            showNotification(`Processando XML ${file.name} para OC ${order.po_id}...`, 'info'); // Ajustado para po_id
            // Simula um atraso
            await new Promise(r => setTimeout(r, 1000));
            // Aqui você chamaria a função real de upload e processamento
            // const processedData = await uploadAndProcessPoXml(file, orderId);
            // if (processedData) {
            //     // Atualizar a ordem de compra com os dados do XML processado
            //     // await updatePendingPurchaseOrder(orderId, { xmlData: processedData, xmlAttached: true });
            //     resolve();
            // } else {
            //     reject(new Error('Falha ao processar XML.'));
            // }
            order.xmlAttached = true; // Simula que o XML foi anexado
            await updatePendingPurchaseOrder(orderId, { xmlAttached: true }); // Atualiza no Supabase
            showNotification(`XML ${file.name} processado para OC ${order.po_id}.`, 'success'); // Ajustado para po_id
            resolve();
        });
    });

    Promise.all(uploadPromises).then(async () => { // Adicionado async aqui
        await renderPurchaseOrders(); // Espera a renderização
        fileInput.value = null;
        fileInput.removeAttribute('data-order-id');
    }).catch(error => {
        console.error("Ocorreu um erro durante o processamento dos XMLs:", error);
        showNotification("Ocorreu um erro durante o processamento de um ou mais XMLs.", "danger");

        fileInput.value = null;
        fileInput.removeAttribute('data-order-id');
    });
}

window.viewPurchaseOrder = async (orderId) => { // Adicionado async aqui
    const order = appData.pendingPurchaseOrders.find(op => op.id === orderId); // Usa appData.pendingPurchaseOrders
    if (!order) {
        showNotification("Ordem de compra não encontrada.", "danger");
        return;
    }

    const dataForDocument = {
        operation: order,
        allSuppliers: appData.suppliers // Usa appData.suppliers
    };

    // localStorage.setItem('currentDocument', JSON.stringify(dataForDocument)); // Remover uso de localStorage
    // window.open('gerenciador_invoice.html?origin=purchase-orders', '_self');
    showNotification('Funcionalidade de Invoice/Packing List precisa ser adaptada para Supabase.', 'info');
};

document.addEventListener('DOMContentLoaded', () => {
    const poXmlUpload = document.getElementById('po-xml-upload');
    if (poXmlUpload) {
        poXmlUpload.addEventListener('change', handlePoXmlUpload);
    }
});