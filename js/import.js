import { items, suppliers, movements, saveData, importedOperationsHistory, cumulativeImportedItems, operationsHistory, pendingPurchaseOrders } from './database.js';
import { showNotification, openModal, closeModal, showConfirmModal } from './ui.js';
import { openOperationModal } from './operations.js';
import { checkPermission } from './auth.js';

let itemsToImport = [];

async function uploadAndProcessPoXml(file, orderId, onComplete, onError) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://localhost:8001/upload/', {
            method: 'POST',
            headers: {
                'Authorization': 'secret'
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao processar o XML no backend.');
        }

        const extractedData = await response.json();
        
        const orderIndex = pendingPurchaseOrders.findIndex(op => op.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Ordem de compra não encontrada.');
        }

        const order = pendingPurchaseOrders[orderIndex];
        order.xmlAttached = true; // Mark that an XML has been attached

        const xmlProducts = extractedData.produtos;
        const xmlSupplierCnpj = extractedData.fornecedor.cnpj;
        const supplier = suppliers.find(s => s.cnpj === xmlSupplierCnpj);

        if (!supplier) {
            throw new Error(`Fornecedor com CNPJ ${xmlSupplierCnpj} não encontrado no sistema.`);
        }

        const notFoundProducts = [];
        let updatedCount = 0;

        xmlProducts.forEach(xmlProduct => {
            const orderItem = order.items.find(item => {
                const codeMatch = String(item.code).trim() === String(xmlProduct.code).trim();
                const supplierMatch = item.supplierId === supplier.id;
                return codeMatch && supplierMatch;
            });

            if (orderItem) {
                orderItem.costPrice = xmlProduct.costPrice;
                orderItem.operationPrice = xmlProduct.costPrice; // Assuming operationPrice should also be updated
                updatedCount++;
            } else {
                notFoundProducts.push(`${xmlProduct.name} (Cód: ${xmlProduct.code})`);
            }
        });

        pendingPurchaseOrders[orderIndex] = order;
        saveData();

        let notificationMessage = `Preços de ${updatedCount} item(ns) atualizados na OC ${orderId} a partir do arquivo ${file.name}.`;
        if (notFoundProducts.length > 0) {
            notificationMessage += `\n\nOs seguintes produtos do XML não foram encontrados na OC:\n- ${notFoundProducts.join('\n- ')}`;
            showNotification(notificationMessage, 'warning', 10000); // Longer duration for warning
        } else {
            showNotification(notificationMessage, 'success');
        }


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

function openImportModal() {
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

function downloadImportTemplate() {
    const templateData = [{
        name: "Nome do Produto Exemplo",
        nameEn: "Example Product Name",
        code: "SKU-001",
        ncm: "12345678",
        description: "Descrição detalhada do produto.",
        quantity: 100,
        minQuantity: 10,
        costPrice: 25.50,
        salePrice: 49.90,
        unitsPerBox: 12,
        unitWeight: 0.5
    }];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo");
    XLSX.writeFile(workbook, "Modelo_Importacao_Itens.xlsx");
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        processAndPreviewSheet(json);
    };
    reader.readAsArrayBuffer(file);
}

function processAndPreviewSheet(data) {
    itemsToImport = data;
    const previewContainer = document.getElementById('import-preview-container');
    const previewHeader = document.getElementById('import-preview-header');
    const previewBody = document.getElementById('import-preview-body');

    previewHeader.innerHTML = '';
    previewBody.innerHTML = '';

    if (itemsToImport.length === 0) {
        previewContainer.classList.add('hidden');
        return;
    }

    const headers = Object.keys(itemsToImport[0]);
    previewHeader.innerHTML = `<tr>${headers.map(h => `<th class="p-2 text-left">${h}</th>`).join('')}</tr>`;

    itemsToImport.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = headers.map(h => `<td class="p-2 border-t">${item[h] || ''}</td>`).join('');
        previewBody.appendChild(row);
    });

    previewContainer.classList.remove('hidden');
}

function processAndPreviewPdfProducts(dadosImportados) {
    itemsToImport = dadosImportados.produtos;
    const previewContainer = document.getElementById('import-preview-container');
    const previewHeader = document.getElementById('import-preview-header');
    const previewBody = document.getElementById('import-preview-body');

    previewHeader.innerHTML = '';
    previewBody.innerHTML = '';

    if (itemsToImport.length === 0) {
        previewContainer.classList.add('hidden');
        return;
    }

    // Display NFe and Supplier info above the table
    const infoDiv = document.createElement('div');
    infoDiv.className = "mb-4 p-3 bg-blue-50 rounded-md text-sm";
    infoDiv.innerHTML = `
        <p><strong>NF-e:</strong> ${dadosImportados.notaFiscal.numero}</p>
        <p><strong>Fornecedor:</strong> ${dadosImportados.fornecedor.nome}</p>
    `;
    previewContainer.prepend(infoDiv);

    const headers = ["Código", "Nome", "NCM", "Quantidade", "Preço Custo", "Preço Venda"];
    previewHeader.innerHTML = `<tr>${headers.map(h => `<th class="p-2 text-left">${h}</th>`).join('')}</tr>`;

    itemsToImport.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-2 border-t">${item.code || ''}</td>
            <td class="p-2 border-t">${item.name || ''}</td>
            <td class="p-2 border-t">${item.ncm || ''}</td>
            <td class="p-2 border-t">${item.quantity || 0}</td>
            <td class="p-2 border-t">${item.costPrice || 0}</td>
            <td class="p-2 border-t">${item.salePrice || 0}</td>
        `;
        previewBody.appendChild(row);
    });

    previewContainer.classList.remove('hidden');
}

function confirmImport() {
    if (itemsToImport.length === 0) {
        showNotification("Nenhum item para importar.", "warning");
        return;
    }

    // Assuming cumulativeImportedItems holds the last PDF import data
    const lastImportedDoc = cumulativeImportedItems[cumulativeImportedItems.length - 1];

    itemsToImport.forEach(itemData => {
        const newItem = {
            id: `item_${Date.now()}_${Math.random()}`,
            name: itemData.name || 'Sem Nome',
            nameEn: itemData.nameEn || '',
            code: itemData.code || '',
            ncm: (itemData.ncm || '').toString().replace(/\D/g, ''),
            description: itemData.description || '',
            quantity: parseInt(itemData.quantity) || 0,
            minQuantity: parseInt(itemData.minQuantity) || 0,
            costPrice: parseFloat(itemData.costPrice) || 0,
            salePrice: parseFloat(itemData.salePrice) || 0,
            unitsPerBox: parseInt(itemData.unitsPerBox) || 0,
            unitWeight: parseFloat(itemData.unitWeight) || 0,
            supplierId: lastImportedDoc ? lastImportedDoc.fornecedor.id : '', // Use supplier from PDF
            image: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        items.push(newItem);
    });

    // Now call executarOperacaoDeEntrada to handle movements and supplier creation
    if (lastImportedDoc) {
        executarOperacaoDeEntrada(lastImportedDoc);
    }

    showNotification(`${itemsToImport.length} itens importados com sucesso!`, 'success');
    closeModal('import-modal');
    fullUpdate();
    abrirMenuOpcoesImportacao(); // Show options after successful import
}

function executarOperacaoDeEntrada(dados) {
    const { fornecedor, produtos, notaFiscal } = dados;

    let supplier = suppliers.find(s => s.cnpj === fornecedor.cnpj);
    if (!supplier) {
        supplier = {
            id: `sup_${Date.now()}`,
            name: fornecedor.nome,
            cnpj: fornecedor.cnpj,
        };
        suppliers.push(supplier);
        showNotification(`Novo fornecedor "${supplier.name}" registado.`, 'info');
    }

    produtos.forEach(prod => {
        const existingItem = items.find(item => item.code === prod.code && item.supplierId === supplier.id);

        if (existingItem) {
            existingItem.quantity += prod.quantity;
            existingItem.costPrice = prod.costPrice;
            existingItem.updatedAt = new Date().toISOString();
        } else {
            const newItem = {
                id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: prod.name, nameEn: prod.nameEn, code: prod.code, ncm: prod.ncm,
                description: `Importado via NF-e ${notaFiscal.numero}`,
                quantity: prod.quantity, minQuantity: prod.minQuantity, costPrice: prod.costPrice,
                salePrice: prod.salePrice, supplierId: supplier.id, packageType: prod.packageType,
                unitsPerPackage: prod.unitsPerPackage, unitMeasureValue: prod.unitMeasureValue,
                unitMeasureType: prod.unitMeasureType, image: null,
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
            };
            items.push(newItem);
        }

        const movement = {
            id: `mov_${Date.now()}_${prod.code}`,
            itemId: existingItem ? existingItem.id : items[items.length - 1].id,
            type: 'in',
            quantity: prod.quantity,
            price: prod.costPrice,
            reason: `Entrada via NF-e: ${notaFiscal.numero}`,
            date: new Date().toISOString()
        };
        movements.push(movement);
    });

    showNotification(`${produtos.length} produtos do documento ${notaFiscal.numero} foram adicionados/atualizados no stock.`, 'success');
    fullUpdate();
}

export { openImportModal, downloadImportTemplate, handleFileImport, confirmImport, uploadAndProcessPoXml };
