import { items, suppliers, movements, saveData, importedOperationsHistory, cumulativeImportedItems } from './database.js';
import { showNotification, openModal, closeModal, showConfirmModal } from './ui.js';
import { openOperationModal } from './operations.js';
import { checkPermission } from './auth.js';

let itemsToImport = [];

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

async function handlePdfImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    showNotification(`Arquivo "${file.name}" carregado. Processando...`, 'info');

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const typedarray = new Uint8Array(e.target.result);
            
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;

            const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(' ') + '\n';
            }
            
            const dadosImportados = parseNFeText(fullText);

            if (dadosImportados.produtos.length === 0) {
                showNotification('Nenhum produto encontrado no PDF. Verifique o formato do arquivo.', 'danger');
                return;
            }

            closeModal('import-modal');
    
            const docId = dadosImportados.notaFiscal.numero;
            const isDuplicate = importedOperationsHistory.some(op => op.docId === docId);

            if (isDuplicate) {
                showConfirmModal(
                    'Documento Duplicado',
                    `O documento nº ${docId} já foi importado. Deseja importá-lo novamente e atualizar o stock com os novos valores?`,
                    () => processImport(dadosImportados)
                );
            } else {
                processImport(dadosImportados);
            }
        };
        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error('Erro ao processar PDF:', error);
        showNotification('Falha ao ler o arquivo PDF.', 'danger');
    }
}

function parseNFeText(text) {
    const cleanText = (str) => str.trim().replace(/\s+/g, ' ');

    let supplierName = 'Não identificado';
    const supplierMatch = text.match(/(.*?)\nDANFE/);
    if (supplierMatch && supplierMatch[1].trim()) {
        supplierName = cleanText(supplierMatch[1].split('\n').filter(line => line.trim()).pop());
    }

    let nfeNumber = `NFe_${Date.now()}`;
    const nfeNumberMatch = text.match(/N°[:.]?\s*(\d{3}.\d{3}.\d{3}|\d+)/);
    if (nfeNumberMatch) {
        nfeNumber = nfeNumberMatch[1].replace(/\./g, '');
    }

    const products = [];
    // More flexible product section identification
    const productSectionMatch = text.match(/DADOS DOS PRODUTOS \/ SERVIÇOS([\s\S]*?)(?:CÁLCULO DO ISSQN|DADOS ADICIONAIS|VALOR TOTAL DA NOTA|INFORMAÇÕES COMPLEMENTARES)/);
    
    if (productSectionMatch) {
        const productLines = productSectionMatch[1].split('\n');
        // Updated regex for more robust product extraction
        // Captures: (optional code), description, NCM, quantity, unitPrice, totalPrice
        const productRegex = /^(?:(\S+)\s+)?(.+?)\s+(\d{8})\s+(?:UN|KG|PC|CX|FD|M3|M2|LT|G|ML)?\s*([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/i;

        for (const line of productLines) {
            const match = line.match(productRegex);
            if (match) {
                // Adjusting indices based on new regex groups
                const [, code, description, ncm, quantity, unitPrice, totalPrice] = match;
                
                const parseValue = (str) => parseFloat(str.replace(/\./g, '').replace(',', '.'));

                products.push({
                    code: cleanText(code || ''), // Code might be optional now
                    name: cleanText(description),
                    ncm: cleanText(ncm),
                    quantity: parseValue(quantity),
                    costPrice: parseValue(unitPrice),
                    nameEn: '',
                    minQuantity: 10,
                    salePrice: parseValue(unitPrice) * 1.25, 
                    packageType: 'caixa', // Default, can be improved with more regex
                    unitsPerPackage: 1,    // Default, can be improved
                    unitMeasureValue: 0,   // Default, can be improved
                    unitMeasureType: 'un'  // Default, can be improved
                });
            } else {
                console.log("Linha de produto não corresponde ao regex:", line);
            }
        }
    } else {
        console.log("Seção de produtos não encontrada no PDF.");
    }

    return {
        fornecedor: {
            nome: supplierName,
            cnpj: ''
        },
        produtos: products,
        notaFiscal: {
            numero: nfeNumber,
            serie: '1',
            dataEmissao: new Date().toISOString().split('T')[0]
        }
    };
}


function processImport(dadosImportados) {
    const docId = dadosImportados.notaFiscal.numero;

    const existingIndex = importedOperationsHistory.findIndex(op => op.docId === docId);
    if (existingIndex > -1) {
        importedOperationsHistory.splice(existingIndex, 1);
    }
    importedOperationsHistory.push({ docId: docId, date: new Date().toISOString() });
    
    cumulativeImportedItems.push(dadosImportados); // Keep track of all imported docs

    // Now, instead of executing operation directly, we preview the products
    itemsToImport = dadosImportados.produtos; // Set itemsToImport for the preview and confirmImport
    processAndPreviewPdfProducts(dadosImportados); // Display the products for review

    // We don't call executarOperacaoDeEntrada or abrirMenuOpcoesImportacao here directly.
    // The user will confirm the import via the 'Confirmar Importação' button.
}


function abrirMenuOpcoesImportacao() {
    const existingModal = document.getElementById('import-options-modal');
    if (existingModal) existingModal.remove();

    const optionsModal = document.createElement('div');
    optionsModal.id = 'import-options-modal';
    optionsModal.className = 'fixed inset-0 z-[70] flex items-center justify-center p-4 modal-backdrop';
    optionsModal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md modal-content p-6 text-center">
            <i class="fas fa-file-import text-5xl text-primary-DEFAULT mx-auto mb-4"></i>
            <h3 class="text-lg font-semibold text-gray-800">Importação Concluída</h3>
            <p class="mt-2 text-sm text-gray-600">O que deseja fazer agora?</p>
            <div class="mt-6 space-y-3">
                <button id="btn-create-operation" class="btn btn-primary w-full">
                    <i class="fas fa-cogs mr-2"></i> Gerar Operação (${cumulativeImportedItems.length} doc.)
                </button>
                <button id="btn-import-another" class="btn btn-secondary w-full">
                    <i class="fas fa-redo mr-2"></i> Importar Outro Documento
                </button>
                <button id="btn-exit-import" class="btn btn-danger w-full">
                    <i class="fas fa-times-circle mr-2"></i> Sair
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(optionsModal);

    document.getElementById('btn-create-operation').onclick = () => {
        iniciarOperacaoDeSaidaComItensImportados();
        optionsModal.remove();
    };
    document.getElementById('btn-import-another').onclick = () => {
        optionsModal.remove();
        openImportModal();
    };
    document.getElementById('btn-exit-import').onclick = () => {
        cumulativeImportedItems = [];
        optionsModal.remove();
    };
}

function iniciarOperacaoDeSaidaComItensImportados() {
    if (cumulativeImportedItems.length === 0) {
        showNotification("Nenhum item importado para criar uma operação.", "warning");
        return;
    }

    const todosOsProdutos = cumulativeImportedItems.flatMap(doc => doc.produtos);

    openOperationModal(todosOsProdutos);
    cumulativeImportedItems = [];
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

export { openImportModal, downloadImportTemplate, handleFileImport, handlePdfImport, confirmImport };
