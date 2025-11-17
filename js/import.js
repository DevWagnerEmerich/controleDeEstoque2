import { 
    addItem, updateItem, addSupplier, updateSupplier, addMovement, addOperationToHistory,
    updatePendingPurchaseOrder, getAllItems, getAllSuppliers
} from './database.js';
import { showNotification, openModal, closeModal, showConfirmModal, fullUpdate, normalizeCnpj } from './ui.js';
import { openOperationModal } from './operations.js';
import { checkPermission } from './auth.js';
import { appData } from './main.js'; // Importa a variável global de dados

let itemsToImport = []; // Para importação via XLSX/PDF

// Esta função será refatorada na Parte 3 para usar a Serverless Function na Vercel
export async function uploadAndProcessPoXml(file, orderId, onComplete, onError) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        // ATENÇÃO: Esta URL será substituída pela URL da sua Serverless Function na Vercel
        const response = await fetch('http://localhost:8001/upload/', {
            method: 'POST',
            headers: {
                'Authorization': 'secret' // ATENÇÃO: Isso será removido/segurizado
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao processar o XML no backend.');
        }

        const extractedData = await response.json();
        
        const order = appData.pendingPurchaseOrders.find(op => op.id === orderId); // Usa appData.pendingPurchaseOrders
        if (!order) {
            throw new Error('Ordem de compra não encontrada.');
        }

        // order.xmlAttached = true; // Marcar que um XML foi anexado (propriedade temporária)

        const xmlProducts = extractedData.produtos;
        const xmlSupplierCnpj = extractedData.fornecedor.cnpj;
        const supplier = appData.suppliers.find(s => s.cnpj === xmlSupplierCnpj); // Usa appData.suppliers

        if (!supplier) {
            throw new Error(`Fornecedor com CNPJ ${xmlSupplierCnpj} não encontrado no sistema.`);
        }

        const notFoundProducts = [];
        let updatedCount = 0;

        // Atualiza os itens da ordem de compra com os preços do XML
        const updatedOrderItems = order.items.map(orderItem => {
            const xmlProduct = xmlProducts.find(xp => 
                String(xp.code).trim() === String(orderItem.code).trim() && orderItem.supplier_id === supplier.id // Ajustado para supplier_id
            );

            if (xmlProduct) {
                updatedCount++;
                return {
                    ...orderItem,
                    cost_price: xmlProduct.costPrice, // Ajustado para cost_price
                    operationPrice: xmlProduct.costPrice // Assumindo que operationPrice também deve ser atualizado
                };
            } else {
                notFoundProducts.push(`${orderItem.name} (Cód: ${orderItem.code})`);
                return orderItem;
            }
        });

        // Atualiza a ordem de compra no Supabase
        const updatedOrder = await updatePendingPurchaseOrder(orderId, { items: updatedOrderItems, xmlAttached: true });
        if (!updatedOrder) {
            throw new Error('Erro ao atualizar ordem de compra com dados do XML.');
        }
        
        let notificationMessage = `Preços de ${updatedCount} item(ns) atualizados na OC ${order.po_id} a partir do arquivo ${file.name}.`; // Ajustado para po_id
        if (notFoundProducts.length > 0) {
            notificationMessage += `\n\nOs seguintes produtos do XML não foram encontrados na OC:\n- ${notFoundProducts.join('\n- ')}`;
            showNotification(notificationMessage, 'warning', 10000); // Duração mais longa para aviso
        } else {
            showNotification(notificationMessage, 'success');
        }

        await fullUpdate(); // Atualiza a UI após a modificação
        if (onComplete && typeof onComplete === 'function') {
            onComplete();
        }

    } catch (error) {
        console.error('Erro ao processar a Ordem de Compra:', error);
        showNotification(error.message, 'danger');
        if (onError && typeof onError === 'function') {
            onError(error);
        }
    }
}

export function openImportModal() {
    if (!checkPermission('import')) {
        showNotification('Não tem permissão para importar itens.', 'danger');
        return;
    }
    document.getElementById('import-preview-container').classList.add('hidden');
    document.getElementById('xlsx-importer').value = '';
    document.getElementById('pdf-importer-modal').value = '';
    itemsToImport = [];
    openModal('import-modal');
}

// Funções de importação XLSX e PDF precisarão ser adaptadas para Supabase
// Por enquanto, apenas notificações informativas
export function downloadImportTemplate() {
    showNotification('Funcionalidade de download de template XLSX precisa ser adaptada.', 'info');
}

export function handleFileImport(event) {
    showNotification('Funcionalidade de importação XLSX precisa ser adaptada para Supabase.', 'info');
}

export function processAndPreviewSheet(data) {
    showNotification('Funcionalidade de preview de XLSX precisa ser adaptada para Supabase.', 'info');
}

export function processAndPreviewPdfProducts(dadosImportados) {
    showNotification('Funcionalidade de preview de PDF precisa ser adaptada para Supabase.', 'info');
}

export function confirmImport() {
    showNotification('Funcionalidade de confirmação de importação precisa ser adaptada para Supabase.', 'info');
}

export async function executarOperacaoDeEntrada(dados) { // Adicionado async aqui
    const { fornecedor, produtos, notaFiscal } = dados;

    let supplier = appData.suppliers.find(s => s.cnpj === fornecedor.cnpj); // Usa appData.suppliers
    if (!supplier) {
        const newSupplierData = {
            name: fornecedor.nome,
            cnpj: fornecedor.cnpj,
            address: fornecedor.address || ''
        };
        supplier = await addSupplier(newSupplierData); // Adiciona no Supabase
        if (!supplier) {
            showNotification(`Erro ao adicionar fornecedor ${fornecedor.nome}!`, 'danger');
            return;
        }
        showNotification(`Novo fornecedor "${supplier.name}" registado.`, 'info');
    } else {
        // Atualiza o endereço do fornecedor existente, caso tenha mudado ou não estivesse preenchido
        if (fornecedor.address && fornecedor.address !== supplier.address) {
            const updatedSupplier = await updateSupplier(supplier.id, { address: fornecedor.address }); // Atualiza no Supabase
            if (!updatedSupplier) {
                showNotification(`Erro ao atualizar endereço do fornecedor ${supplier.name}!`, 'danger');
            }
        }
    }

    for (const prod of produtos) { // Usar for...of para await
        let existingItem = appData.items.find(item => item.code === prod.code && item.supplier_id === supplier.id); // Usa appData.items e supplier_id
        if (!existingItem) {
            const newItemData = {
                name: prod.name, name_en: prod.nameEn, code: prod.code, ncm: prod.ncm, // Ajustado para name_en
                description: `Importado via NF-e ${notaFiscal.numero}`,
                quantity: prod.quantity, min_quantity: prod.minQuantity, cost_price: prod.costPrice, // Ajustado para nomes do BD
                sale_price: prod.salePrice, supplier_id: supplier.id, package_type: prod.packageType, // Ajustado para nomes do BD
                units_per_package: prod.unitsPerPackage, unit_measure_value: prod.unitMeasureValue, // Ajustado para nomes do BD
                unit_measure_type: prod.unitMeasureType, image: null, // Ajustado para nomes do BD
                created_at: new Date().toISOString(), updated_at: new Date().toISOString()
            };
            existingItem = await addItem(newItemData); // Adiciona no Supabase
            if (!existingItem) {
                showNotification(`Erro ao adicionar item ${prod.name}!`, 'danger');
                continue;
            }
            showNotification(`Novo item "${existingItem.name}" registado no estoque.`, 'info');
        } else {
            // Se o item já existe, atualiza a quantidade e preço de custo
            const newQuantity = existingItem.quantity + prod.quantity;
            const updatedItem = await updateItem(existingItem.id, { quantity: newQuantity, cost_price: prod.costPrice, updated_at: new Date().toISOString() }); // Atualiza no Supabase
            if (!updatedItem) {
                showNotification(`Erro ao atualizar item ${existingItem.name}!`, 'danger');
                continue;
            }
        }

        const movement = {
            item_id: existingItem.id, // Ajustado para item_id
            type: 'in',
            quantity: prod.quantity,
            price: prod.costPrice,
            reason: `Entrada via NF-e: ${notaFiscal.numero}`,
            created_at: new Date().toISOString()
        };
        const newMovement = await addMovement(movement); // Adiciona movimento no Supabase
        if (!newMovement) {
            showNotification(`Erro ao registar movimento para o item ${prod.name}!`, 'danger');
            continue;
        }
    }

    showNotification(`${produtos.length} produtos do documento ${notaFiscal.numero} foram adicionados/atualizados no stock.`, 'success');
    await fullUpdate();
}

export { openImportModal, downloadImportTemplate, handleFileImport, confirmImport, uploadAndProcessPoXml };