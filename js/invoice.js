let nfeData = {}; // Global variable to hold the entire NFe data object
let allItems = []; // Holds the main stock items for NCM lookup

let invoiceData = {}; // Global variable to hold all invoice data

function parseBrazilianNumber(str) {
    if (typeof str !== 'string') {
        if (typeof str === 'number') return str;
        return 0;
    }
    str = str.trim();
    if (!str) return 0;
    // Remove thousands separators (dots) and replace decimal comma with dot
    const numberStr = str.replace(/\./g, '').replace(/,/g, '.');
    const parsed = parseFloat(numberStr);
    return isNaN(parsed) ? 0 : parsed;
}

function parseQtyUnit(qtyUnitString) {
    if (!qtyUnitString) return 0;

    const upperCaseString = qtyUnitString.toUpperCase();
    const parts = upperCaseString.split('X');
    if (parts.length !== 2) return 0;

    const quantity = parseFloat(parts[0]);
    const unitPart = parts[1];

    const valueMatch = unitPart.match(/^[0-9.]+/);
    const unitValue = valueMatch ? parseFloat(valueMatch[0]) : 0;

    const unitTypeMatch = unitPart.match(/[A-Z]+$/);
    const unitType = unitTypeMatch ? unitTypeMatch[0] : '';

    if (isNaN(quantity) || isNaN(unitValue)) return 0;

    let totalWeight = quantity * unitValue;

    switch (unitType) {
        case 'G':
        case 'GR':
            totalWeight /= 1000; // Convert grams to kilograms
            break;
        case 'ML':
            totalWeight /= 1000; // Convert milliliters to liters (assuming 1ml=1g)
            break;
        case 'L':
        case 'KG':
            // Already in the base unit
            break;
        default:
            // Assume the value is already in the desired unit if no type is specified
            break;
    }

    return totalWeight;
}



function updatePreview() {
    console.log("Updating preview...");
    const preview = document.getElementById('invoice-preview');
    
    const {
        invoiceNumber,
        invoiceDate,
        importerInfo,
        exporterInfo,
        booking,
        paymentTerm,
        portOfDeparture,
        destinationPort,
        incoterm,
        footerInfo,
        ptaxRate,
        suppliers,
        costs,
        manualNetWeight,
        manualGrossWeight,
        distribution
    } = invoiceData;

    let distributedSuppliers = JSON.parse(JSON.stringify(suppliers));

    if (distribution && distribution.active) {
        const { value, type } = distribution;

        let totalBRL = 0;
        distributedSuppliers.forEach(supplier => {
            supplier.items.forEach(item => {
                const priceBRL = parseFloat(item.price) || 0;
                const qty = parseFloat(item.qty) || 0;
                totalBRL += priceBRL * qty;
            });
        });

        if (totalBRL > 0) {
            let amountToAddBRL = (type === 'percentage') ? totalBRL * (value / 100) : value;

            distributedSuppliers.forEach(supplier => {
                supplier.items.forEach(item => {
                    const priceBRL = parseFloat(item.price) || 0;
                    const qty = parseFloat(item.qty) || 0;
                    const currentItemTotalBRL = priceBRL * qty;
                    
                    const proportion = (totalBRL > 0) ? currentItemTotalBRL / totalBRL : 0;
                    const itemAmountToAdd = amountToAddBRL * proportion;
                    const newItemTotalBRL = currentItemTotalBRL + itemAmountToAdd;

                    if (qty > 0) {
                        const newPricePerUnit = newItemTotalBRL / qty;
                        item.price = newPricePerUnit.toFixed(4);
                    } else {
                        item.price = '0.00';
                    }
                });
            });
        }
    }

    const alibrasLogoUrl = 'images/alibras-logo.png';
    const secondaryLogoUrl = 'images/loia-logo.png';
    
    let formattedFooterInfo = footerInfo
        .replace(/(Bank Information :)/g, '<b>$1</b>')
        .replace(/(Credit To :)/g, '<b>$1</b>')
        .replace(/(Payment Term :)/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');

    if (ptaxRate && ptaxRate > 0) {
        const ptaxLine = `PTAX: ${ptaxRate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} USD`;
        let newFooterInfo = footerInfo;
        if (newFooterInfo.match(/PTAX/i)) {
            newFooterInfo = newFooterInfo.replace(/PTAX.*(?:\n|$)/i, ptaxLine + '\n');
        } else {
            newFooterInfo += `\n${ptaxLine}`;
        }
        formattedFooterInfo = newFooterInfo
            .replace(/(Bank Information :)/g, '<b>$1</b>')
            .replace(/(Credit To :)/g, '<b>$1</b>')
            .replace(/(Payment Term :)/g, '<b>$1</b>')
            .replace(/(PTAX :)/g, '<b>$1</b>')
            .replace(/\n/g, '<br>');
    }


    let formattedDate = '';
    if (invoiceDate) {
        const date = new Date(invoiceDate + 'T00:00:00');
        formattedDate = date.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
    }

    let itemsAndSuppliersHTML = '';
    let productSubtotalUSD = 0;
    let totalPackages = 0;
    let netWeight = 0;

    const isValidRate = ptaxRate && ptaxRate > 0;

    distributedSuppliers.forEach((supplier, groupIndex) => {
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
            const priceBRL = parseFloat(item.price) || 0;
            
            const priceUSD = isValidRate ? priceBRL / ptaxRate : priceBRL;
            const totalUSD = qty_kg * priceUSD;

            productSubtotalUSD += totalUSD;
            totalPackages += qty;
            netWeight += qty_kg;
            
            const formattedPriceUSD = priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formattedTotalUSD = totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formattedQtyKg = qty_kg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            itemsAndSuppliersHTML += `
                <tr>
                    <td class="text-center editable-field" data-target-id="suppliers.${groupIndex}.items.${itemIndex}.qty">${qty.toLocaleString('en-US')}</td>
                    <td class="text-center editable-field" data-target-id="suppliers.${groupIndex}.items.${itemIndex}.ncm">${ncm}</td>
                    <td class="editable-field" data-target-id="suppliers.${groupIndex}.items.${itemIndex}.desc">${descriptionHtml}</td>
                    <td class="editable-field" data-target-id="suppliers.${groupIndex}.items.${itemIndex}.qty_unit">${qty_unit}</td>
                    <td class="text-center">${formattedQtyKg}</td>
                    <td class="editable-field" data-target-id="suppliers.${groupIndex}.items.${itemIndex}.um">${um}</td>
                    <td class="text-right editable-field" data-target-id="suppliers.${groupIndex}.items.${itemIndex}.price">${formattedPriceUSD}</td>
                    <td class="text-center bold">${formattedTotalUSD}</td>
                </tr>
            `;
        });
        
        const supplierInfo = supplier.info;
        if (supplierInfo) {
            itemsAndSuppliersHTML += `
                <tr>
                    <td colspan="8" class="supplier-info-cell editable-field" data-target-id="suppliers.${groupIndex}.info">${supplierInfo.replace(/\n/g, '<br>')}</td>
                </tr>
            `;
        }
    });
    
    const totalRows = itemsAndSuppliersHTML.match(/<tr/g)?.length || 0;
    for (let i = totalRows; i < 24; i++) {
        itemsAndSuppliersHTML += `<tr><td colspan="8">&nbsp;</td></tr>`;
    }
    
    let costsHTML = '';
    let costsSubtotalUSD = 0;
            costs.forEach((cost, costIndex) => {
                const desc = cost.desc;
                const valueBRL = parseFloat(cost.value) || 0;
                const valueUSD = isValidRate ? valueBRL / ptaxRate : valueBRL;
                costsSubtotalUSD += valueUSD;
                costsHTML += `
                    <tr>
                        <td colspan="7" class="text-right bold editable-field" data-target-id="costs.${costIndex}.desc">${desc}</td>
                        <td class="text-center bold editable-field" data-target-id="costs.${costIndex}.value">${valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                `;
            });    
    const grandTotalUSD = productSubtotalUSD + costsSubtotalUSD;

    let finalNetWeight = nfeData.notaFiscal?.pesoLiquido > 0 ? nfeData.notaFiscal.pesoLiquido : netWeight;
    let finalGrossWeight = nfeData.notaFiscal?.pesoBruto > 0 ? nfeData.notaFiscal.pesoBruto : finalNetWeight * 1.035;

    if (!isNaN(manualNetWeight) && manualNetWeight > 0) {
        finalNetWeight = manualNetWeight;
    }
    if (!isNaN(manualGrossWeight) && manualGrossWeight > 0) {
        finalGrossWeight = manualGrossWeight;
    }

    preview.innerHTML = `
        <table cellspacing="0" border="0">
            <colgroup>
                <col width="8%"><col width="10%"><col width="44%"><col width="9%"><col width="8%"><col width="5%"><col width="8%"><col width="8%">
            </colgroup>
            <tbody>
                <tr>
                    <td colspan="3" rowspan="9" height="180" class="logo-cell text-center">
                        <img src="${alibrasLogoUrl}" alt="Alibras Logo" style="max-width: 250px; max-height: 120px; object-fit: contain;">
                    </td>
                    <td colspan="5" rowspan="9" style="vertical-align: top; padding: 6px; line-height: 1.4;" class="editable-field" data-target-id="exporterInfo">
                        ${exporterInfo.replace(/\n/g, '<br>')}
                    </td>
                </tr>
                <tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
                <tr><td colspan="8" class="text-center bold editable-field">INVOICE ${invoiceNumber}</td></tr>
                <tr>
                    <td colspan="3" class="header-bg bold">IMPORTER&nbsp;</td>
                    <td colspan="5" class="header-bg bold">INVOICE DETAILS</td>
                </tr>
                <tr>
                    <td colspan="3" rowspan="7" class="italic" style="vertical-align: center; padding: 6px;">
                        <div style="display: flex; align-items: center; height: 100%;">
                        <div class="editable-field" data-target-id="importerInfo" style="white-space: pre-wrap; width: 60%; flex-shrink: 0;">${importerInfo.replace(/\n/g, '<br>')}</div>
                            <div style="width: 40%; text-align: center;">
                                <img src="${secondaryLogoUrl}" alt="Secondary Logo" style="max-width: 190px; max-height: 120px; object-fit: contain;">
                            </div>
                        </div>
                    </td>
                    <td colspan="5" rowspan="7" class="bold" style="vertical-align: top; padding: 6px; line-height: 1.6;">
                        <u>INVOICE&nbsp;NUMBER:&nbsp;</u> <span class="editable-field" data-target-id="invoiceNumber">${invoiceNumber}</span><br>
                        <u>DATE:&nbsp;</u> <span class="editable-field" data-target-id="invoiceDate">${formattedDate}</span><br>
                        <u>PAYMENT&nbsp;TERM:&nbsp;</u> <span class="editable-field" data-target-id="paymentTerm">${paymentTerm}</span><br>
                        <u>&nbsp;PORT&nbsp;OF&nbsp;DEPARTURE&nbsp;:&nbsp;</u> <span class="editable-field" data-target-id="portOfDeparture">${portOfDeparture}</span><br>
                        <u>DESTINATION&nbsp;AIR&nbsp;PORT&nbsp;:&nbsp;</u> <span class="editable-field" data-target-id="destinationPort">${destinationPort}</span><br>
                        <u>INCOTERM :</u> <span class="editable-field" data-target-id="incoterm">${incoterm}</span><br>
                        <u>BOOKING:&nbsp;</u> <span class="editable-field" data-target-id="booking">${booking}</span>
                    </td>
                </tr>
                <tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
                <tr class="header-bg bold">
                    <td class="text-center">QNT</td><td class="text-center">NCM</td><td class="text-center">DESCRIPTION</td><td class="text-center">QTY UNIT</td><td class="text-center">QTY KG</td><td class="text-center">U/M</td>
                    <td class="text-right">UNIT ${isValidRate ? '$' : 'R$'}</td>
                    <td class="text-center">${isValidRate ? '$ USD' : 'R$'}</td>
                </tr>
                ${itemsAndSuppliersHTML}
                ${costsHTML}
                <tr>
                    <td colspan="7" class="text-right bold">TOTAL</td>
                    <td class="text-center bold">${grandTotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                    <td colspan="5" class="editable-field" data-target-id="footerInfo" style="vertical-align: top; line-height: 1.5;">${formattedFooterInfo}</td>
                    <td colspan="3" style="vertical-align: top; padding: 6px; line-height: 1.6;">
                        Total of Package: <span class="editable-field" data-target-id="totalPackages">${totalPackages.toLocaleString('en-US')}</span><br>
                        Gross Weight: <span class="editable-field" data-target-id="manualGrossWeight">${finalGrossWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>kg<br>
                        Net Weight: <span class="editable-field" data-target-id="manualNetWeight">${finalNetWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>kg<br>
                        Country of Origin : <span class="editable-field" data-target-id="countryOrigin">Brazil</span><br>
                        Destination : <span class="editable-field" data-target-id="countryDestination">USA</span>
                    </td>
                </tr>
                <tr><td colspan="8" class="no-border" style="height: 20px;">&nbsp;</td></tr>
                <tr><td colspan="8" class="text-center no-border">_________________________</td></tr>
                <tr><td colspan="8" class="text-center no-border bold">Exporter's Signature</td></tr>
            </tbody>
        </table>
    `;
}

function addCost() {
    const costNameInput = document.getElementById('costName');
    const costValueInput = document.getElementById('costValue');

    const name = costNameInput.value.trim();
    const value = parseBrazilianNumber(costValueInput.value);

    if (!name || isNaN(value) || value <= 0) {
        showNotification('Por favor, insira um nome e um valor válido para o custo.', 'danger');
        return;
    }

    invoiceData.costs.push({ desc: name, value: value });

    costNameInput.value = '';
    costValueInput.value = '';

    updatePreview();
}

function printInvoice() {
    window.print();
}



function saveChanges() {
    const urlParams = new URLSearchParams(window.location.search);
    const origin = urlParams.get('origin');

    // --- NEW LOGIC: Check if origin is simulation and update sessionStorage ---
    if (origin === 'simulation') {
        const simDataString = sessionStorage.getItem('simulationReturnData');
        if (simDataString) {
            const simulationData = JSON.parse(simDataString);
            
            // Flatten the updated items from the invoice
            const updatedInvoiceItems = invoiceData.suppliers.flatMap(s => s.items);

            // Update items in the simulation data
            simulationData.items.forEach(simItem => {
                const updatedItem = updatedInvoiceItems.find(invItem => invItem.id === simItem.id);
                if (updatedItem) {
                    // The key property to update is 'operationQuantity' in the simulation
                    simItem.operationQuantity = parseBrazilianNumber(updatedItem.qty.toString());
                    // Also update the price, as it might have been edited
                    simItem.operationPrice = parseBrazilianNumber(updatedItem.price.toString());
                }
            });

            // Save the modified simulation data back to sessionStorage
            sessionStorage.setItem('simulationReturnData', JSON.stringify(simulationData));
            showNotification('Quantidades da simulação atualizadas!', 'info');
        }
    }
    // --- END NEW LOGIC ---

    const documentDataString = localStorage.getItem('currentDocument');
    if (!documentDataString) {
        showNotification("Erro: Dados da operação não encontrados para salvar.", "danger");
        return;
    }

    const documentData = JSON.parse(documentDataString);

    // Reconstruct the operation object from the global invoiceData, preserving the original ID
    const updatedOperation = {
        ...documentData.operation, // Keeps original id and other properties
        invoiceNumber: invoiceData.invoiceNumber,
        invoiceDate: invoiceData.invoiceDate,
        exporterInfo: invoiceData.exporterInfo, // <-- ADD THIS LINE
        importerInfo: invoiceData.importerInfo,
        booking: invoiceData.booking,
        paymentTerm: invoiceData.paymentTerm,
        portOfDeparture: invoiceData.portOfDeparture,
        destinationPort: invoiceData.destinationPort,
        incoterm: invoiceData.incoterm,
        footerInfo: invoiceData.footerInfo,
        ptaxRate: invoiceData.ptaxRate,
        costs: invoiceData.costs,
        manualNetWeight: invoiceData.manualNetWeight,
        manualGrossWeight: invoiceData.manualGrossWeight,
        distribution: invoiceData.distribution,
        suppliers: invoiceData.suppliers
    };
    
    updatedOperation.items = invoiceData.suppliers.flatMap(s => s.items);

    const newDocumentData = {
        ...documentData,
        operation: updatedOperation
    };

    // 1. Save the current document view for immediate reload consistency
    localStorage.setItem('currentDocument', JSON.stringify(newDocumentData));

    // 2. Directly update the correct localStorage key based on origin
    if (origin === 'purchase-orders') {
        const pendingPOsString = localStorage.getItem('stockPendingPOs_v1');
        if (pendingPOsString) {
            const pendingPOs = JSON.parse(pendingPOsString);
            const poIndex = pendingPOs.findIndex(po => po.id === documentData.operation.id);
            if (poIndex > -1) {
                pendingPOs[poIndex] = updatedOperation;
                localStorage.setItem('stockPendingPOs_v1', JSON.stringify(pendingPOs));
                showNotification(`Ordem de Compra ${updatedOperation.id} atualizada com sucesso!`, 'success');
            } else {
                showNotification("Erro: Ordem de Compra não encontrada na lista de pendentes.", "danger");
            }
        } else {
            showNotification("Erro: Banco de dados de Ordens de Compra pendentes (stockPendingPOs_v1) não encontrado.", "danger");
        }
    } else {
        const operationsHistoryString = localStorage.getItem('stockOperations_v2');
        if (operationsHistoryString) {
            const operationsHistory = JSON.parse(operationsHistoryString);
            // Find the operation by its stable, original ID
            const opIndex = operationsHistory.findIndex(op => op.id === documentData.operation.id);

            if (opIndex > -1) {
                operationsHistory[opIndex] = updatedOperation;
                
                localStorage.setItem('stockOperations_v2', JSON.stringify(operationsHistory));
                showNotification(`Operação ${updatedOperation.invoiceNumber} atualizada com sucesso!`, 'success');
                console.log('stockOperations_v2 updated directly.');
            } else {
                // This case should ideally not happen if the document exists
                // but we handle it just in case.
                showNotification("Erro: Operação não encontrada no histórico principal.", "danger");
            }
        } else {
            showNotification("Erro: Banco de dados de operações (stockOperations_v2) não encontrado.", "danger");
        }
    }
}

function initialize() {
    console.log("Initializing...");

    const documentDataString = localStorage.getItem('currentDocument');
    console.log('Loading from localStorage:', documentDataString);
    let data;

    if (documentDataString) {
        data = JSON.parse(documentDataString);
        allItems = data.allItems || [];
    }

    if (data) {
        const { operation, allSuppliers } = data;

        // Base invoice data structure
        invoiceData = {
            invoiceNumber: operation.invoiceNumber || operation.id.replace('OP-', ''),
            invoiceDate: operation.invoiceDate || new Date(operation.date).toISOString().split('T')[0],
            exporterInfo: operation.exporterInfo || 'ALIBRAS ALIMENTOS BRASIL\nRua Volta Grande, 156 Cidade Industrial Satélite - Guarulhos, SP\nCEP: 07223-075 - Brasil\nCNPJ: 18.629.179/0001-06\nContact : Bruna da Silva Rodrigues\nPhone : + 55 33 999093304\nDUNS # 943527752\nFDA # 16606877688\nE-MAIL: alibrasexportimport@gmail.com',
            importerInfo: operation.importerInfo || 'Loia Foods Import Export & Export LLC\n63-65 Gotthardt Street\nNewark, NJ , 07105 USA\nEmail: operations@loiafood.com\nCONSIGNER: 27 Malvern st. Newark, NJ 07105',
            booking: operation.booking || '255641399',
            paymentTerm: operation.paymentTerm || 'Due on receipt - US DOLLAR',
            portOfDeparture: operation.portOfDeparture || 'SANTOS ( SP)',
            destinationPort: operation.destinationPort || 'NY / NJ',
            incoterm: operation.incoterm || 'FOB',
            footerInfo: operation.footerInfo || 'Bank Information : Sent in document attached to the email where this proforma was also attached\nCredit To : Alibras Alimentos Brasil - CNPJ: 18.629.179/0001-06\nPayment Term : 100% advance - US Dollar\n\nI declare all the information contained in this invoice to be true and correct',
            suppliers: [],
            costs: operation.costs || [],
            manualNetWeight: operation.manualNetWeight || 0,
            manualGrossWeight: operation.manualGrossWeight || 0,
            ptaxRate: operation.ptaxRate || null,
            distribution: operation.distribution || { active: false, value: 0, type: 'percentage' }
        };

        // *** NEW LOGIC: Prioritize saved suppliers/items over recalculating ***
        if (operation.suppliers && operation.suppliers.length > 0) {
            console.log("Loading from saved operation.suppliers...");
            invoiceData.suppliers = operation.suppliers;
            // Ensure nfeData is still available for weight calculations if needed
            if (operation.nfeData) {
                 nfeData = { notaFiscal: { pesoLiquido: 0, pesoBruto: 0 } };
                operation.nfeData.forEach(nfe => {
                    nfeData.notaFiscal.pesoLiquido += nfe.notaFiscal?.pesoLiquido || 0;
                    nfeData.notaFiscal.pesoBruto += nfe.notaFiscal?.pesoBruto || 0;
                });
            }

        } else if (operation.type === 'import' && operation.nfeData) {
            console.log("First time load: Building suppliers from nfeData...");
            nfeData = { notaFiscal: { pesoLiquido: 0, pesoBruto: 0 } };
            operation.nfeData.forEach(nfe => {
                nfeData.notaFiscal.pesoLiquido += nfe.notaFiscal?.pesoLiquido || 0;
                nfeData.notaFiscal.pesoBruto += nfe.notaFiscal?.pesoBruto || 0;
            });

            invoiceData.manualNetWeight = nfeData.notaFiscal.pesoLiquido.toFixed(3);
            invoiceData.manualGrossWeight = nfeData.notaFiscal.pesoBruto.toFixed(3);

            operation.nfeData.forEach(nfe => {
                const supplier = {
                    info: '',
                    items: []
                };

                const cnpjFromXml = nfe.fornecedor?.cnpj;
                const matchedSupplier = allSuppliers.find(s => s.cnpj === cnpjFromXml);

                if (matchedSupplier) {
                    const nameAddressLine = `${matchedSupplier.name}, ${matchedSupplier.address || 'Endereço não cadastrado'}`;
                    supplier.info = `FDA#${matchedSupplier.fda || 'N/A'} ${nameAddressLine}`.toUpperCase();
                } else if (nfe.fornecedor) {
                    supplier.info = `Fornecedor: ${nfe.fornecedor.nome}\nCNPJ: ${nfe.fornecedor.cnpj} (Não cadastrado)`;
                }

                nfe.produtos.forEach(item => {
                    const ncmFromXml = item.ncm;
                    const matchedItemInStock = allItems.find(stockItem => {
                        if (stockItem.ncm && ncmFromXml) {
                            const normalizedStockNcm = stockItem.ncm.replace(/\D/g, '');
                            const normalizedXmlNcm = ncmFromXml.replace(/\D/g, '');
                            return normalizedStockNcm === normalizedXmlNcm;
                        }
                        return false;
                    });

                    let nameEn = '';
                    if (matchedItemInStock) {
                        nameEn = matchedItemInStock.nameEn || '';
                    }

                    let umValue = 'CS'; // Default
                    if (item.packageType) {
                        umValue = item.packageType;
                    } else if (item.dadosCompletos?.unidade) {
                        const xmlUnit = item.dadosCompletos.unidade.toUpperCase();
                        if (xmlUnit === 'CAIXA' || xmlUnit === 'FARDO') {
                            umValue = xmlUnit;
                        }
                    }

                    supplier.items.push({
                        qty: item.quantity || 0,
                        ncm: item.ncm || '',
                        desc: item.name || '',
                        nameEn: nameEn,
                        price: (item.costPrice || 0).toFixed(2),
                        qty_unit: item.qtyUnit || '',
                        qty_kg: (item.calculated_qty_kg || 0).toFixed(2),
                        um: umValue
                    });
                });
                invoiceData.suppliers.push(supplier);
            });
        } else { // Fallback for manual operations or other types
             const itemsBySupplier = operation.items.reduce((acc, item) => {
                const supplierId = item.supplierId || 'unknown';
                if (!acc[supplierId]) acc[supplierId] = [];
                acc[supplierId].push(item);
                return acc;
            }, {});

            for (const supplierId in itemsBySupplier) {
                const supplierData = {
                    info: '',
                    items: []
                };
                const supplier = allSuppliers.find(s => s.id === supplierId);

                if (supplier) {
                    supplierData.info = `FDA#${supplier.fda || ''} ${supplier.name}, ${supplier.address || ''}`.toUpperCase();
                }

                itemsBySupplier[supplierId].forEach(item => {
                    const isManual = item.operationQuantity !== undefined;
                    const opQty = isManual ? item.operationQuantity : (item.quantity || 0);
                    const opPrice = isManual ? item.operationPrice : (item.costPrice || 0);
                    
                    let boxes;
                    if (operation.type === 'simulation_preview' || operation.type === 'simulation' || operation.type === 'purchase_order') {
                        boxes = opQty;
                    } else {
                        boxes = (item.unitsPerPackage > 0) ? Math.floor(opQty / item.unitsPerPackage) : opQty;
                    }

                    const finalQtyUnitValue = item.qtyUnit || `${item.unitsPerPackage || 1}x${item.unitMeasureValue || ''}${item.unitMeasureType || ''}`;
                    const finalQtyKgValue = parseQtyUnit(finalQtyUnitValue);

                    supplierData.items.push({
                        ...item, // Preserve all original properties
                        id: item.id,
                        code: item.code,
                        supplierId: item.supplierId,
                        ncm: item.ncm || '',
                        desc: item.name || '',
                        nameEn: item.nameEn || '',
                        price: opPrice.toFixed(2),
                        qty_unit: finalQtyUnitValue,
                        qty_kg: finalQtyKgValue,
                        um: 'CS'
                    });
                });
                invoiceData.suppliers.push(supplierData);
            }
        }
    } else { // Fallback for when no document is in localStorage
        invoiceData = {
            invoiceNumber: '2060',
            invoiceDate: new Date().toISOString().split('T')[0],
            importerInfo: 'Loia Foods Import Export & Export LLC\n63-65 Gotthardt Street\nNewark, NJ , 07105 USA\nEmail: operations@loiafood.com\nCONSIGNER: 27 Malvern st. Newark, NJ 07105',
            booking: '255641399',
            paymentTerm: 'Due on receipt - US DOLLAR',
            portOfDeparture: 'SANTOS ( SP)',
            destinationPort: 'NY / NJ',
            incoterm: 'FOB',
            footerInfo: 'Bank Information : Sent in document attached to the email where this proforma was also attached\nCredit To : Alibras Alimentos Brasil - CNPJ: 18.629.179/0001-06\nPayment Term : 100% advance - US Dollar\n\nI declare all the information contained in this invoice to be true and correct',
            suppliers: [
                {
                    info: 'FDA#17405485860-RIVELLI E BEZERRA INDUSTRIA E COMERCIO DE ALIMENTOS LTDA',
                    items: [
                        {
                            qty: 30,
                            ncm: '20052000',
                            desc: 'Loia-Potato Chips (PALHA) 10X800Gr',
                            qty_unit: '10X800G',
                            qty_kg: 240,
                            price: 38.68,
                            um: 'CS'
                        },
                        {
                            qty: 70,
                            ncm: '20052000',
                            desc: 'Loia-Potato Chips (PALHA) 20X300Gr',
                            qty_unit: '20X300G',
                            qty_kg: 420,
                            price: 29.50,
                            um: 'CS'
                        }
                    ]
                }
            ],
            costs: [
                {
                    desc: 'EXPRESSO RADIANTE +13 Pallets',
                    value: 2596.68
                }
            ],
            manualNetWeight: 0,
            manualGrossWeight: 0,
            ptaxRate: null,
            distribution: { active: false, value: 0, type: 'percentage' }
        };
    }

    updatePreview();

    // --- Populate and add listeners to control panel inputs ---
    const ptaxRateInput = document.getElementById('ptaxRate');
    const distributeValueInput = document.getElementById('distributeValue');
    const distributeTypeInput = document.getElementById('distributeType');
    const applyExchangeRateToggle = document.getElementById('applyExchangeRateToggle');
    const distributeValueToggle = document.getElementById('distributeValueToggle');

    // Set initial values from loaded data
    if (invoiceData.ptaxRate) {
        ptaxRateInput.value = invoiceData.ptaxRate;
        applyExchangeRateToggle.checked = true;
    }
    if (invoiceData.distribution) {
        distributeValueInput.value = invoiceData.distribution.value;
        distributeTypeInput.value = invoiceData.distribution.type;
        if (invoiceData.distribution.active) {
            distributeValueToggle.checked = true;
        }
    }

    // Add event listeners to update invoiceData on change
    ptaxRateInput.addEventListener('input', (e) => {
        const rate = parseBrazilianNumber(e.target.value);
        invoiceData.ptaxRate = (!isNaN(rate) && rate > 0) ? rate : null;
    });

    distributeValueInput.addEventListener('input', (e) => {
        const value = parseBrazilianNumber(e.target.value);
        if (!isNaN(value)) {
            invoiceData.distribution.value = value;
        }
    });

    distributeTypeInput.addEventListener('change', (e) => {
        invoiceData.distribution.type = e.target.value;
    });

    applyExchangeRateToggle.addEventListener('change', function() {
        const rate = parseFloat(ptaxRateInput.value);
        if (this.checked) {
            if (!isNaN(rate) && rate > 0) {
                invoiceData.ptaxRate = rate;
            } else {
                showNotification('Por favor, insira uma cotação válida.', 'danger');
                this.checked = false;
                return;
            }
        } else {
            // When toggling off, we only deactivate the rate for calculation,
            // but we don't nullify the data, so the input value is preserved.
            invoiceData.ptaxRate = null; 
        }
        updatePreview();
    });

    distributeValueToggle.addEventListener('change', function() {
        const value = parseFloat(distributeValueInput.value);
        const type = distributeTypeInput.value;

        if (this.checked) {
            if (isNaN(value) || value === 0) {
                showNotification('Por favor, insira um valor válido para distribuir.', 'danger');
                this.checked = false;
                return;
            }
            invoiceData.distribution.active = true;
            invoiceData.distribution.value = value;
            invoiceData.distribution.type = type;
        } else {
            // When toggling off, just deactivate it. The values remain.
            invoiceData.distribution.active = false;
        }
        updatePreview();
    });

    document.getElementById('addCostBtn').addEventListener('click', addCost);
    document.getElementById('save-changes-btn').addEventListener('click', saveChanges);



    initializeEditableFieldsInvoice();

    // --- DYNAMIC BACK BUTTON LOGIC ---
    const backButton = document.getElementById('back-button');
    const urlParams = new URLSearchParams(window.location.search);
    const origin = urlParams.get('origin');

    backButton.addEventListener('click', () => {
        if (origin === 'simulation') {
            window.location.href = 'index.html';
        } else if (origin === 'purchase-orders') {
            window.location.href = 'index.html#purchase-orders';
        } else {
            // Default back to the history view
            window.location.href = 'index.html#operations-history';
        }
    });
}



function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container');
    if (!container) {
        console.error('Notification container not found!');
        return;
    }

    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.textContent = message;

    container.appendChild(notification);

    // Force reflow to ensure the transition plays
    void notification.offsetWidth;

    notification.classList.add('visible');

    setTimeout(() => {
        notification.classList.remove('visible');
        notification.addEventListener('transitionend', () => {
            notification.remove();
        }, { once: true });
    }, duration);
}

function initializeEditableFieldsInvoice() {
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

            let value = this.innerText;

            // --- VALIDATION FOR INVOICE DATE ---
            if (targetId === 'invoiceDate') {
                const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
                const match = value.match(dateRegex);

                if (!match) {
                    showNotification('Formato de data inválido. Use DD-MM-YYYY.', 'danger');
                    updatePreview(); // Re-render to revert to the old value
                    return;
                }

                const [_, day, month, year] = match;
                const isoDate = `${year}-${month}-${day}`;
                
                // More robust validation
                const dateObj = new Date(isoDate + 'T00:00:00');
                if (dateObj.getFullYear() != year || (dateObj.getMonth() + 1) != month || dateObj.getDate() != day) {
                    showNotification('Data inválida (ex: dia ou mês não existe).', 'danger');
                    updatePreview();
                    return;
                }

                invoiceData.invoiceDate = isoDate;

                // Manually update the display to the American format
                const date = new Date(isoDate + 'T00:00:00');
                const newFormattedDate = date.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
                this.innerText = newFormattedDate;

                return; // Stop further processing for this field
            }
            // --- END VALIDATION ---

            // --- VALIDATION FOR INVOICE NUMBER ---
            if (targetId === 'invoiceNumber') {
                const numericValue = value.replace(/\D/g, '');
                if (value !== numericValue) {
                    showNotification('O número da Invoice deve conter apenas dígitos.', 'danger');
                    this.innerText = invoiceData.invoiceNumber; // Revert
                    return;
                }

                const operationsHistoryString = localStorage.getItem('stockOperations_v2');
                const documentDataString = localStorage.getItem('currentDocument');
                if (operationsHistoryString && documentDataString) {
                    const operationsHistory = JSON.parse(operationsHistoryString);
                    const documentData = JSON.parse(documentDataString);
                    const isDuplicate = operationsHistory.some(op => 
                        op.invoiceNumber === numericValue && op.id !== documentData.operation.id
                    );
                    if (isDuplicate) {
                        showNotification('Este número de Invoice já existe. Por favor, insira um número único.', 'danger');
                        this.innerText = invoiceData.invoiceNumber; // Revert
                        return;
                    }
                }
                value = numericValue;
            }
            // --- END VALIDATION ---

            const keys = targetId.split('.');
            let temp = invoiceData;
            for (let i = 0; i < keys.length - 1; i++) {
                temp = temp[keys[i]];
            }
            const propertyName = keys[keys.length - 1];

            const numericProps = ['qty', 'price', 'value', 'totalPackages', 'manualGrossWeight', 'manualNetWeight', 'qty_kg'];
            if (numericProps.includes(propertyName)) {
                temp[propertyName] = parseBrazilianNumber(value);
            } else {
                temp[propertyName] = value;
            }

            if (propertyName === 'qty' || propertyName === 'qty_unit') {
                if (propertyName === 'qty_unit') {
                    const regex = /^(\d+)X(\d+)(G|GR|KG|L|ML)$/i;
                    if (!regex.test(value)) {
                        showNotification('Formato de Qty Unit inválido. Use o formato 32X400G.', 'danger');
                        updatePreview(); // Re-render to show the old value
                        return;
                    }
                }

                const item = temp;
                item.qty_kg = parseQtyUnit(item.qty_unit) * (parseFloat(item.qty) || 0);
            }

            // saveChanges(); // Removed to prevent notification on every blur
            updatePreview();
        };

        field.addEventListener('blur', onBlur, { once: true });
    });
}

document.addEventListener('DOMContentLoaded', initialize);