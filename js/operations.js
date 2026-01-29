import { items, suppliers, operationsHistory, movements, pendingPurchaseOrders, addOperation, addSupplier, addItem, addMovement, updateItem, deletePurchaseOrder } from './database.js';
import { showNotification, openModal, closeModal, formatCurrency, fullUpdate, normalizeCnpj } from './ui.js'; // Added normalizeCnpj
import { escapeHTML } from './utils/helpers.js';
import { checkPermission, getCurrentUserProfile } from './auth.js';

let currentOperation = { id: null, items: [], isEditing: false };

function openOperationModal(itensPreenchidos = null) {
    if (!checkPermission('operation')) {
        showNotification('Não tem permissão para criar operações.', 'danger');
        return;
    }
    currentOperation = {
        id: `OP-${Date.now()}`,
        date: new Date().toISOString(),
        items: [],
        isEditing: false
    };

    if (itensPreenchidos && Array.isArray(itensPreenchidos)) {
        document.getElementById('operation-modal-title').innerText = 'Nova Operação (Itens Importados)';
        itensPreenchidos.forEach(prodImportado => {
            const itemDeEstoque = items.find(i => i.code === prodImportado.code);
            if (itemDeEstoque) {
                currentOperation.items.push({
                    ...itemDeEstoque,
                    operationQuantity: prodImportado.quantity,
                    operationPrice: prodImportado.costPrice
                });
            }
        });
    } else {
        document.getElementById('operation-modal-title').innerText = 'Nova Operação de Saída';
    }

    document.getElementById('operation-id').innerText = `ID: ${currentOperation.id}`;
    renderOperationAvailableItems();
    renderOperationSelectedItems();
    updateOperationSummary();
    openModal('operation-modal');
}

function renderOperationAvailableItems() {
    const container = document.getElementById('operation-available-items');
    container.innerHTML = '';
    const availableItems = items.filter(item => item.quantity > 0);

    if (availableItems.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center">Nenhum item com stock disponível.</p>`;
        return;
    }

    availableItems.forEach(item => {
        const isAdded = currentOperation.items.some(opItem => opItem.id === item.id);
        const div = document.createElement('div');
        div.className = `op-item-card available ${isAdded ? 'added' : ''}`;

        const boxesInStock = (item.unitsPerPackage > 0) ? Math.floor(item.quantity / item.unitsPerPackage) : 0;
        const packageLabel = item.packageType === 'fardo' ? (boxesInStock === 1 ? 'fardo' : 'fardos') : (boxesInStock === 1 ? 'caixa' : 'caixas');
        const stockDisplay = `${boxesInStock} ${packageLabel}`;
        const inputPackageLabel = item.packageType === 'fardo' ? 'Fardos' : 'Caixas';

        div.innerHTML = `
            <div class="op-item-info">
                <p class="op-item-name">${escapeHTML(item.name)}</p>
                <p class="op-item-stock">Em stock: ${stockDisplay}</p>
            </div>
            <div class="op-item-actions">
                <div class="input-group">
                    <label>Qtd. (${inputPackageLabel})</label>
                    <input type="number" id="op-qty-box-${item.id}" class="form-input" min="1" max="${boxesInStock}">
                </div>
                <div class="input-group">
                    <label>Preço Venda</label>
                    <input type="number" id="op-price-${item.id}" class="form-input" step="0.01" value="${item.salePrice}">
                </div>
                <button onclick="addItemToOperation('${item.id}')" class="btn btn-add-op" id="add-op-btn-${item.id}">Adicionar</button>
            </div>
        `;
        container.appendChild(div);
    });
    feather.replace();
}

function addItemToOperation(itemId) {
    const item = { ...items.find(i => i.id === itemId) };
    const qtyBoxInput = document.getElementById(`op-qty-box-${itemId}`);
    const priceInput = document.getElementById(`op-price-${itemId}`);

    const quantityInBoxes = parseInt(qtyBoxInput.value);
    const price = parseFloat(priceInput.value);

    if (!quantityInBoxes || quantityInBoxes <= 0) {
        showNotification("Por favor, insira uma quantidade válida.", "warning");
        return;
    }

    const quantityInUnits = quantityInBoxes * (item.unitsPerPackage || 1);

    if (quantityInUnits > item.quantity) {
        showNotification("A quantidade de saída não pode ser maior que o stock disponível.", "warning");
        return;
    }

    currentOperation.items.push({
        ...item,
        operationQuantity: quantityInUnits,
        operationPrice: price
    });

    renderOperationSelectedItems();
    renderOperationAvailableItems();
    updateOperationSummary();
}
window.addItemToOperation = addItemToOperation;

function renderOperationSelectedItems() {
    const container = document.getElementById('operation-selected-items');
    container.innerHTML = '';

    if (currentOperation.items.length === 0) {
        container.innerHTML = `<div class="panel-empty-state"><p>Nenhum item adicionado.</p></div>`;
        return;
    }

    currentOperation.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'op-item-card selected';

        const boxes = (item.unitsPerPackage > 0) ? Math.floor(item.operationQuantity / item.unitsPerPackage) : 0;
        const packageLabel = item.packageType === 'fardo' ? (boxes === 1 ? 'fardo' : 'fardos') : (boxes === 1 ? 'caixa' : 'caixas');
        const selectedDisplay = `${boxes} ${packageLabel}`;

        div.innerHTML = `
            <div class="op-item-info">
                <p class="op-item-name">${escapeHTML(item.name)}</p>
                <p class="op-item-stock">A sair: ${selectedDisplay} @ ${formatCurrency(item.operationPrice, 'BRL')}</p>
            </div>
            <button onclick="removeItemFromOperation('${item.id}')" class="btn-remove-op">
                <i data-feather="x"></i>
            </button>
        `;
        container.appendChild(div);
    });
    feather.replace();
}

function removeItemFromOperation(itemId) {
    currentOperation.items = currentOperation.items.filter(item => item.id !== itemId);
    renderOperationSelectedItems();
    renderOperationAvailableItems();
    updateOperationSummary();
}
window.removeItemFromOperation = removeItemFromOperation;

function updateOperationSummary() {
    const summaryContainer = document.getElementById('operation-summary');
    if (currentOperation.items.length === 0) {
        summaryContainer.innerHTML = '';
        return;
    }

    let totalBoxes = 0;
    let totalNetWeight = 0;
    let totalAmount = 0;

    currentOperation.items.forEach(item => {
        const boxes = (item.unitsPerPackage > 0) ? Math.floor(item.operationQuantity / item.unitsPerPackage) : 0;
        totalBoxes += boxes;

        let itemNetWeight = item.operationQuantity * (item.unitMeasureValue || 0);
        if (item.unitMeasureType === 'g' || item.unitMeasureType === 'ml') {
            itemNetWeight /= 1000;
        }
        totalNetWeight += itemNetWeight;
        totalAmount += item.operationQuantity * item.operationPrice;
    });

    const totalGrossWeight = totalNetWeight * 1.035;

    summaryContainer.innerHTML = `
        <div class="summary-row">
            <span>Total de Embalagens:</span>
            <span class="summary-value">${totalBoxes}</span>
        </div>
        <div class="summary-row">
            <span>Peso Líquido Total (est.):</span>
            <span class="summary-value">${totalNetWeight.toFixed(2)} kg</span>
        </div>
        <div class="summary-row">
            <span>Peso Bruto Total (est.):</span>
            <span class="summary-value">${totalGrossWeight.toFixed(2)} kg</span>
        </div>
        <div class="summary-total">
            <span>Valor Total:</span>
            <span class="summary-value total">${formatCurrency(totalAmount, 'BRL')}</span>
        </div>
    `;
}

async function saveManualOperation() {
    if (currentOperation.items.length === 0) {
        showNotification("Adicione pelo menos um item à operação antes de finalizar.", "warning");
        return;
    }

    const currentUser = getCurrentUserProfile();
    if (!currentUser) {
        showNotification('Usuário não autenticado. Não é possível salvar a operação.', 'danger');
        return;
    }

    // Cria uma cópia segura da operação para salvar
    const operationToSave = {
        ...currentOperation,
        user_id: currentUser.id,
        items: JSON.parse(JSON.stringify(currentOperation.items)), // Garante uma cópia profunda
        type: 'manual'
    };

    try {
        // Salva a operação no Supabase
        await addOperation(operationToSave);

        // Salva a operação no histórico local
        operationsHistory.push(operationToSave);

        showNotification(`Operação ${operationToSave.id} criada e salva com sucesso!`, 'success');

        // Atualiza o stock e cria os registos de movimento
        currentOperation.items.forEach(opItem => {
            const itemIndex = items.findIndex(i => i.id === opItem.id);
            if (itemIndex > -1) {
                items[itemIndex].quantity -= opItem.operationQuantity;
            }
            const movement = {
                id: `mov_${Date.now()}_${opItem.id}`,
                itemId: opItem.id, type: 'out', quantity: opItem.operationQuantity,
                price: opItem.operationPrice, reason: `Saída por Operação`,
                operationId: currentOperation.id, date: currentOperation.date
            };
            movements.push(movement);
        });

        closeModal('operation-modal');
        fullUpdate(); // Atualiza a UI

        // Dispara um evento para notificar que a operação foi salva
        document.dispatchEvent(new CustomEvent('operation-saved'));

    } catch (error) {
        showNotification(`Erro ao salvar operação manual: ${error.message}`, 'danger');
        console.error("Falha ao salvar operação manual:", error);
    }
}

function regenerateDocument(operationId, docType) {
    const operationData = operationsHistory.find(op => op.id === operationId);
    if (!operationData) {
        showNotification('Operação não encontrada no histórico.', 'danger');
        return;
    }

    const dataForDocument = {
        operation: operationData,
        allSuppliers: suppliers
    };

    if (docType === 'invoice') {
        localStorage.setItem('currentDocument', JSON.stringify(dataForDocument));
        window.open('gerenciador_invoice.html', '_self');

    } else if (docType === 'packlist') {
        localStorage.setItem('currentDocument', JSON.stringify(dataForDocument));
        window.open('gerador_packing_list.html', '_self');
    }
}
window.regenerateDocument = regenerateDocument;

async function finalizarOperacaoDeImportacao(stagedNfeData, operationId) {
    for (const nfe of stagedNfeData) {
        const { fornecedor, produtos, notaFiscal } = nfe;

        try {
            // 1. Garante que o fornecedor existe no DB
            const nfeCnpj = fornecedor.cnpj ? normalizeCnpj(fornecedor.cnpj) : '';
            let supplier = nfeCnpj ? suppliers.find(s => normalizeCnpj(s.cnpj) === nfeCnpj) : null;

            if (!supplier) {
                const currentUser = getCurrentUserProfile();
                if (!currentUser) {
                    showNotification('Erro: Usuário não autenticado para criar fornecedor.', 'danger');
                    continue; // Pula para a próxima NFe
                }
                const newSupplierData = {
                    name: fornecedor.nome,
                    cnpj: fornecedor.cnpj,
                    address: fornecedor.address || '',
                    user_id: currentUser.id // <-- CORREÇÃO AQUI
                };
                supplier = await addSupplier(newSupplierData);
                suppliers.push(supplier);
                showNotification(`Novo fornecedor "${supplier.name}" salvo.`, 'info');
            }

            for (const prod of produtos) { // Loop through each product in the NFe
                // 2. Garante que o item existe no DB (associado a este fornecedor)
                let existingItem = items.find(item => item.code === prod.code && item.supplier_id === supplier.id);

                if (!existingItem) {
                    const currentUser = getCurrentUserProfile();
                    if (!currentUser) {
                        showNotification('Erro: Usuário não autenticado.', 'danger');
                        continue;
                    }
                    const newItemData = {
                        user_id: currentUser.id,
                        name: prod.name,
                        code: prod.code,
                        ncm: prod.ncm,
                        description: `Importado via NF-e ${notaFiscal.numero}`,
                        quantity: 0, // Quantidade no "catálogo" é 0, as movimentações controlam o fluxo
                        min_quantity: 0,
                        cost_price: prod.costPrice,
                        sale_price: prod.costPrice * 1.25,
                        supplier_id: supplier.id,
                    };
                    existingItem = await addItem(newItemData);
                    items.push(existingItem);
                    showNotification(`Novo item "${existingItem.name}" salvo.`, 'info');
                }

                const itemId = existingItem.id;
                const currentUser = getCurrentUserProfile(); // Pega o usuário atual
                if (!currentUser) {
                    showNotification('Erro: Usuário não autenticado para criar movimentação.', 'danger');
                    continue;
                }

                // 3. Cria o movimento de ENTRADA no DB
                const inMovement = {
                    user_id: currentUser.id,
                    item_id: itemId, // UUID PERSISTENTE
                    type: 'in',
                    quantity: prod.quantity,
                    price: prod.costPrice,
                    reason: `Entrada via NF-e: ${notaFiscal.numero}`,
                    operation_id: operationId,
                    date: new Date().toISOString()
                };
                const newInMovement = await addMovement(inMovement);
                movements.push(newInMovement);

                // 3.1 ATUALIZAÇÃO CRÍTICA: Salvar o ID do item na operação em memória (stagedNfeData)
                // Isso garante que quando regenerateDocument for chamado, ele tenha o ID.
                prod.item_id = itemId; // <--- VÍNCULO FORTE ADICIONADO AQUI

                // 4. Cria o movimento de SAÍDA no DB
                const outMovement = {
                    user_id: currentUser.id, // <-- CORREÇÃO AQUI
                    item_id: itemId,
                    type: 'out',
                    quantity: prod.quantity,
                    price: prod.costPrice,
                    reason: `Saída para Exportação (Op: ${operationId})`,
                    operation_id: operationId,
                    date: new Date().toISOString()
                };
                const newOutMovement = await addMovement(outMovement);
                movements.push(newOutMovement);
            }
        } catch (error) {
            showNotification(`Erro ao processar NF-e: ${error.message}`, 'danger');
            console.error('Erro em finalizarOperacaoDeImportacao:', error);
        }
    }
    showNotification(`Movimentações da NF-e foram registradas no banco de dados.`, 'success');
    fullUpdate();
}

export { openOperationModal, saveManualOperation, finalizarOperacaoDeImportacao, regenerateDocument };

export async function stockInPurchaseOrder(orderId) {
    const orderIndex = pendingPurchaseOrders.findIndex(op => op.id === orderId);
    if (orderIndex === -1) {
        showNotification("Ordem de compra não encontrada.", "danger");
        return;
    }

    const currentUser = getCurrentUserProfile();
    if (!currentUser) {
        showNotification('Usuário não autenticado. Não é possível salvar a operação.', 'danger');
        return;
    }

    const orderToProcess = pendingPurchaseOrders[orderIndex];

    if (orderToProcess.status !== 'pending_stock_entry') {
        showNotification(`A ordem de compra ${orderId} não está pronta para entrada no estoque.`, "warning");
        return;
    }

    // --- PART 1: Stock-IN (Entrada de Estoque) ---
    orderToProcess.items.forEach(orderItem => {
        const itemIndex = items.findIndex(i => i.id === orderItem.id);
        if (itemIndex > -1) {
            items[itemIndex].quantity += orderItem.operationQuantity;
            items[itemIndex].costPrice = orderItem.costPrice;
            items[itemIndex].updatedAt = new Date().toISOString();

            const inMovement = {
                id: `mov_in_${Date.now()}_${orderItem.id}`,
                itemId: orderItem.id,
                type: 'in',
                quantity: orderItem.operationQuantity,
                price: orderItem.costPrice,
                reason: `Entrada via OC ${orderToProcess.id}`,
                date: new Date().toISOString()
            };
            movements.push(inMovement);
        }
    });

    // --- PART 2: Transform the OC into an OP (Ordem de Saída) ---
    const finalOperation = orderToProcess; // Work on the same object reference
    finalOperation.user_id = currentUser.id; // Add user_id

    // Preserve original OC id for reference if needed, then create the new OP id
    finalOperation.purchaseOrderId = finalOperation.id;
    finalOperation.id = finalOperation.id.replace('OC-', 'OP-');
    finalOperation.type = 'manual'; // Or a more specific type like 'sale_from_po'
    finalOperation.status = 'completed';
    finalOperation.date = new Date().toISOString(); // Update date to reflect completion time

    // This property is not needed in the final operation
    delete finalOperation.xml_attached;

    // --- PART 3: Create OUTgoing movements for the new OP ---
    finalOperation.items.forEach(saleItem => {
        const itemIndex = items.findIndex(i => i.id === saleItem.id);
        if (itemIndex > -1) {
            // The stock was already increased in PART 1, now we decrease it for the sale
            items[itemIndex].quantity -= saleItem.operationQuantity;
        }
        const outMovement = {
            id: `mov_out_${Date.now()}_${saleItem.id}`,
            itemId: saleItem.id,
            type: 'out',
            quantity: saleItem.operationQuantity,
            price: saleItem.operationPrice, // Use the (potentially updated) sale price
            reason: `Saída por Operação de OC ${finalOperation.purchaseOrderId}`,
            operationId: finalOperation.id, // Use the new OP ID
            date: finalOperation.date
        };
        movements.push(outMovement);
    });

    // --- PART 4: Move the transformed operation to the main history ---
    // This is done after successful save

    try {
        // --- PART 5: Save and Notify ---
        await addOperation(finalOperation);
        showNotification(`Ordem de Compra ${finalOperation.purchaseOrderId} processada. Operação de Saída ${finalOperation.id} criada e salva.`, 'success');

        // --- PART 6: Delete original OC and update local state ---
        await deletePurchaseOrder(orderId);
        operationsHistory.push(finalOperation);
        pendingPurchaseOrders.splice(orderIndex, 1);

        // --- PART 7: Redirect to document generation for the new OP ---
        regenerateDocument(finalOperation.id, 'invoice');

    } catch (error) {
        showNotification(`Erro ao salvar operação da Ordem de Compra: ${error.message}`, 'danger');
        console.error("Falha ao salvar operação da OC:", error);
        // NOTE: We don't update the local state if the DB save fails, to allow for a retry.
    }
}
