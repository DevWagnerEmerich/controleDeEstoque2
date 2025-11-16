let allItems = [];
let packlistData = {};

function updatePreview() {
    const preview = document.getElementById('invoice-preview');
    
    const {
        invoiceNumber,
        invoiceDate,
        importerInfo,
        exporterInfo,
        container,
        booking,
        paymentTerm,
        portOfDeparture,
        destinationPort,
        incoterm,
        ptaxRate,
        countryOrigin,
        countryDestination,
        ptaxInfo,
        declarationText,
        suppliers,
        manualNetWeight,
        manualGrossWeight
    } = packlistData;

    const alibrasLogoUrl = 'images/alibras-logo.png';
    const secondaryLogoUrl = 'images/loia-logo.png';

    let formattedDate = '';
    if (invoiceDate) {
        const date = new Date(invoiceDate + 'T00:00:00');
        const month = date.toLocaleString('en-US', { month: 'long' });
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        formattedDate = `${month} .${day} .${year}`;
    }

    let totalPackages = 0;
    let netWeight = 0;
    let itemsAndSuppliersHTML = '';

    suppliers.forEach((supplier, groupIndex) => {
        supplier.items.forEach((item, itemIndex) => {
            const qty = parseFloat(item.qty) || 0;
            const ncm = item.ncm;
            const descPt = item.desc;
            const descEn = item.nameEn;
            let descriptionHtml = ''; // Initialize as empty for the main field
            if (descEn) {
                descriptionHtml = descEn;
                if (descPt) { // Only add Portuguese if it exists
                    descriptionHtml += `<br><small style="color: #555;">${descPt}</small>`;
                }
            } else if (descPt) { // If no English name, but Portuguese exists, display Portuguese as secondary
                descriptionHtml = `<br><small style="color: #555;">${descPt}</small>`;
            }

            const qty_unit = item.qty_unit;
            const qty_kg = parseFloat(item.qty_kg) || 0;
            const um = item.um;

            totalPackages += qty;
            netWeight += qty_kg;
            
            itemsAndSuppliersHTML += `
                <tr>
                    <td class="text-center">${qty}</td>
                    <td>${descriptionHtml}</td>
                    <td class="text-center">${qty_unit}</td>
                    <td class="text-center">${qty_kg.toFixed(2)}</td>
                    <td class="text-center">${um}</td>
                    <td class="text-center">${ncm}</td>
                </tr>
            `;
        });
        
        const supplierInfo = supplier.info;
        if (supplierInfo) {
            itemsAndSuppliersHTML += `
                <tr>
                    <td colspan="6" class="supplier-info-cell">${supplierInfo.replace(/\n/g, '<br>')}</td>
                </tr>
            `;
        }
    });
    
    const totalRows = itemsAndSuppliersHTML.match(/<tr/g)?.length || 0;
    for (let i = totalRows; i < 24; i++) {
        itemsAndSuppliersHTML += `<tr><td colspan="6">&nbsp;</td></tr>`;
    }
    
    if (!isNaN(manualNetWeight) && manualNetWeight > 0) {
        netWeight = manualNetWeight;
    }

    let grossWeight = netWeight > 0 ? netWeight * 1.035 : 0;
    if (!isNaN(manualGrossWeight) && manualGrossWeight > 0) {
        grossWeight = manualGrossWeight;
    }
    
    let ptaxLine = '';
    if (ptaxRate && ptaxRate > 0) {
        ptaxLine = `PTAX : ${ptaxRate.toFixed(4)} USD`;
    }
    const fullPtaxInfo = `${ptaxLine}\n${ptaxInfo}`.replace(/\n/g, '<br>');

    const footerHTML = `
        <td colspan="6" style="padding: 5px;">
            <table style="width: 100%; border-collapse: collapse;">
                <tbody style="border: none;">
                    <tr>
                        <td class="bold" style="border: none; width: 15%; white-space: nowrap; padding: 1px 0;">Gross Weight:</td>
                        <td class="bold" style="border: none; width: 35%; text-align: left; padding: 1px 0;">${grossWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}kg</td>
                        <td style="border: none; width: 50%;"></td>
                    </tr>
                    <tr>
                        <td class="bold" style="border: none; white-space: nowrap; padding: 1px 0;">Net Weight:</td>
                        <td class="bold" style="border: none; text-align: left; padding: 1px 0;">${netWeight.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}kg</td>
                        <td style="border: none;"></td>
                    </tr>
                    <tr>
                        <td class="bold" style="border: none; padding: 1px 0 5px 0; white-space: nowrap;">Total of Package:</td>
                        <td class="bold" style="border: none; text-align: left; padding: 1px 0 5px 0;">${totalPackages.toLocaleString('pt-BR')}</td>
                        <td style="border: none; padding: 1px 0 5px 0;"></td>
                    </tr>
                    <tr>
                        <td colspan="2" class="bold" style="border:none; padding: 8px 0; vertical-align: top;">
                            Country of Origin of goods : <span class="editable-field" data-target-id="countryOrigin">${countryOrigin}</span><br>
                            Country of final Destination : <span class="editable-field" data-target-id="countryDestination">${countryDestination}</span>
                        </td>
                        <td style="border:none; text-align: right; font-size: 10px; vertical-align: top; padding: 8px 0; line-height: 1.4;" class="editable-field" data-target-id="ptaxInfo">
                            ${fullPtaxInfo}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="border: none; padding-top: 8px;" class="bold editable-field" data-target-id="declarationText">
                            ${declarationText}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="border:none; padding-top: 30px;">
                            <div style="width: 280px; border-top: 1px solid #000; text-align: center;" class="bold">Exporter's Signature</div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </td>
    `;

    const invoiceDetailsHTML = `
        <td colspan="4" rowspan="7" class="bold" style="vertical-align: top; padding: 6px; line-height: 1.6;">
            DATE: <span class="editable-field" data-target-id="invoiceDate">${formattedDate}</span><br>
            INVOICE #: <span class="editable-field" data-target-id="invoiceNumber">${invoiceNumber}</span><br>
            CONTAINER: <span class="editable-field" data-target-id="container">${container}</span><br>
            PORT OF DEPARTURE: <span class="editable-field" data-target-id="portOfDeparture">${portOfDeparture}</span><br>
            INCONTERM: <span class="editable-field" data-target-id="incoterm">${incoterm}</span><br>
            DESTINATION PORT: <span class="editable-field" data-target-id="destinationPort">${destinationPort}</span><br>
            BOOKING: <span class="editable-field" data-target-id="booking">${booking}</span>
        </td>
    `;

    preview.innerHTML = `
        <table cellspacing="0" border="0">
            <colgroup>
                <col width="8%"><col width="59%"><col width="9%"><col width="9%"><col width="6%"><col width="10%">
            </colgroup>
            <tbody>
                <tr>
                    <td colspan="2" rowspan="9" height="180" class="logo-cell text-center">
                        <img src="${alibrasLogoUrl}" alt="Alibras Logo" style="max-width: 250px; max-height: 120px; object-fit: contain;">
                    </td>
                    <td colspan="4" rowspan="9" style="vertical-align: top; padding: 6px; line-height: 1.4;">
                        ${exporterInfo.replace(/\n/g, '<br>')}
                    </td>
                </tr>
                <tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
                <tr><td colspan="6" class="text-center bold">PACKING LIST INVOICE ${invoiceNumber}</td></tr>
                <tr>
                    <td colspan="2" class="header-bg bold">IMPORTER&nbsp;</td>
                    <td colspan="4" class="header-bg bold"></td>
                </tr>
                <tr>
                    <td colspan="2" rowspan="7" class="italic" style="vertical-align: top; padding: 6px;">
                        <div style="display: flex; align-items: flex-start; height: 100%;">
                            <div style="white-space: pre-wrap; width: 60%; flex-shrink: 0; line-height: 1.5;">${importerInfo.replace(/\n/g, '<br>')}</div>
                            <div style="width: 40%; text-align: center; padding-top: 10px;">
                                <img src="${secondaryLogoUrl}" alt="Secondary Logo" style="max-width: 190px; max-height: 120px; object-fit: contain;">
                            </div>
                        </div>
                    </td>
                    ${invoiceDetailsHTML}
                </tr>
                <tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
                <tr class="header-bg bold">
                    <td class="text-center">QTY CX</td><td class="text-center">DESCRIPTION</td><td class="text-center">QTY UNIT</td><td class="text-center">QTY KG</td><td class="text-center">U/M</td><td class="text-center">NCM</td>
                </tr>
                ${itemsAndSuppliersHTML}
                <tr>
                    ${footerHTML}
                </tr>
            </tbody>
        </table>
    `;
}

function printInvoice() {
    window.print();
}

function saveChangesPackingList() {
    if (document.activeElement && document.activeElement.isEditing) {
        document.activeElement.blur();
    }

    const documentDataString = localStorage.getItem('currentDocument');
    if (!documentDataString) {
        showNotification("Erro: Dados da operação não encontrados para salvar.", "danger");
        return;
    }

    const documentData = JSON.parse(documentDataString);

    const updatedOperation = {
        ...documentData.operation,
        invoiceDate: packlistData.invoiceDate,
        invoiceNumber: packlistData.invoiceNumber,
        container: packlistData.container,
        portOfDeparture: packlistData.portOfDeparture,
        incoterm: packlistData.incoterm,
        destinationPort: packlistData.destinationPort,
        booking: packlistData.booking,
        countryOrigin: packlistData.countryOrigin,
        countryDestination: packlistData.countryDestination,
        ptaxInfo: packlistData.ptaxInfo,
        declarationText: packlistData.declarationText,
        container: packlistData.container,
        booking: packlistData.booking
    };

    const newDocumentData = {
        ...documentData,
        operation: updatedOperation
    };

    localStorage.setItem('currentDocument', JSON.stringify(newDocumentData));

    const operationsHistoryString = localStorage.getItem('stockOperations_v2');
    if (operationsHistoryString) {
        const operationsHistory = JSON.parse(operationsHistoryString);
        const opIndex = operationsHistory.findIndex(op => op.id === documentData.operation.id);

        if (opIndex > -1) {
            operationsHistory[opIndex] = {
                ...operationsHistory[opIndex],
                ...updatedOperation
            };
            localStorage.setItem('stockOperations_v2', JSON.stringify(operationsHistory));
            showNotification(`Alterações no Packing List salvas com sucesso!`, 'success');
        } else {
            showNotification("Erro: Operação não encontrada no histórico principal.", "danger");
        }
    } else {
        showNotification("Erro: Banco de dados de operações (stockOperations_v2) não encontrado.", "danger");
    }
}

function showNotification(message, type = 'info', duration = 3000) {
    const container = document.createElement('div');
    container.id = 'notification-container';
    if (!document.getElementById('notification-container')) {
        document.body.appendChild(container);
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.getElementById('notification-container').appendChild(notification);

    setTimeout(() => {
        notification.classList.add('visible');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('visible');
        setTimeout(() => notification.remove(), 500);
    }, duration);
}

function initializeEditableFieldsPackingList() {
    const preview = document.getElementById('invoice-preview');

    preview.addEventListener('click', function(e) {
        const field = e.target.closest('.editable-field');
        if (!field) return;

        if (field.isEditing) return;
        field.isEditing = true;

        field.contentEditable = true;
        field.focus();

        const onBlur = function() {
            this.contentEditable = false;
            this.isEditing = false;
            
            const targetId = this.dataset.targetId;
            if (!targetId) return;

            packlistData[targetId] = this.innerText;
        };

        field.addEventListener('blur', onBlur, { once: true });
    });
}

function populateWithOperationData(data) {
    const { operation, allSuppliers } = data;
    
    packlistData = {
        invoiceNumber: operation.invoiceNumber || operation.id.replace('OP-', ''),
        invoiceDate: operation.invoiceDate || new Date(operation.date).toISOString().split('T')[0],
        exporterInfo: operation.exporterInfo || 'ALIBRAS ALIMENTOS BRASIL\nRua Volta Grande, 156 Cidade Industrial Satélite - Guarulhos, SP\nCEP: 07223-075 - Brasil\nCNPJ: 18.629.179/0001-06\nContact : Bruna da Silva Rodrigues\nPhone : + 55 33 999093304\nDUNS # 943527752\nFDA # 16606877688\nE-MAIL: alibrasexportimport@gmail.com',
        importerInfo: operation.importerInfo || 'Loia Foods Import Export & Export LLC\n27 Malvern st. Newark, NJ 07105\nNewark, NJ , 07105 USA - Phone: 1 973 350 6197\nEmail: operations@loiafood.com',
        container: operation.container || '[clique para editar]',
        booking: operation.booking || '255641399',
        paymentTerm: operation.paymentTerm || 'Due on receipt - US DOLLAR',
        portOfDeparture: operation.portOfDeparture || 'SANTOS ( SP)',
        destinationPort: operation.destinationPort || 'NY / NJ',
        incoterm: operation.incoterm || 'FOB',
        countryOrigin: operation.countryOrigin || 'Brazil',
        countryDestination: operation.countryDestination || 'USA',
        ptaxInfo: operation.ptaxInfo || 'CONTRATO DE CAMBIO ACC BANCO BRADESCO,\nDESAGIO:10.10%aa,NUMERO DO CONTRATO:\n498476052',
        declarationText: operation.declarationText || 'I declare all the information contained in this packing list to be true and correct',
        suppliers: operation.suppliers || [],
        manualNetWeight: operation.manualNetWeight || 0,
        manualGrossWeight: operation.manualGrossWeight || 0,
        ptaxRate: operation.ptaxRate || null
    };

    if (!operation.suppliers || operation.suppliers.length === 0) {
        if (operation.type === 'import' && operation.nfeData) {
            console.log("First time load: Building suppliers from nfeData...");
            operation.nfeData.forEach(nfe => {
                const supplier = {
                    info: '',
                    items: []
                };
                const cnpjFromXml = nfe.fornecedor?.cnpj;
                const matchedSupplier = allSuppliers.find(s => s.cnpj === cnpjFromXml);

                if (matchedSupplier) {
                    const fdaLine = `FDA#${matchedSupplier.fda || 'N/A'}`;
                    const nameAddressLine = `${matchedSupplier.name}, ${matchedSupplier.address || 'Endereço não cadastrado'}`;
                    supplier.info = `${fdaLine}\n${nameAddressLine}`;
                } else if (nfe.fornecedor) {
                    supplier.info = `Fornecedor: ${nfe.fornecedor.nome}\nCNPJ: ${nfe.fornecedor.cnpj} (Não cadastrado)`;
                }

                nfe.produtos.forEach(item => {
                    const matchedItemInStock = allItems.find(stockItem => stockItem.ncm && item.ncm && stockItem.ncm.replace(/\D/g, '') === item.ncm.replace(/\D/g, ''));
                    let nameEn = matchedItemInStock ? matchedItemInStock.nameEn || '' : '';
                    let umValue = item.packageType || (item.dadosCompletos?.unidade.toUpperCase() === 'CAIXA' || item.dadosCompletos?.unidade.toUpperCase() === 'FARDO' ? item.dadosCompletos.unidade.toUpperCase() : 'CS');

                    supplier.items.push({
                        qty: item.quantity || 0,
                        ncm: item.ncm || '',
                        desc: item.name || '',
                        nameEn: nameEn,
                        qty_unit: item.qtyUnit || '',
                        qty_kg: (item.calculated_qty_kg || 0).toFixed(2),
                        um: umValue
                    });
                });
                packlistData.suppliers.push(supplier);
            });
        }
    }

    updatePreview();
    initializeEditableFieldsPackingList();
    document.getElementById('save-packlist-changes-btn').addEventListener('click', saveChangesPackingList);
}

function initialize() {
    const packlistDataString = localStorage.getItem('currentDocument');
    if (packlistDataString) {
        const data = JSON.parse(packlistDataString);
        allItems = data.allItems || [];
        populateWithOperationData(data);
    } else {
        console.error("currentDocument not found in localStorage. Cannot render packing list.");
    }
}

window.onload = initialize;