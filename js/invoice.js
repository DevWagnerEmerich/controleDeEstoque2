import { updateOperation, updatePurchaseOrder, updateItem, updateLocalItem } from './database.js';
import { escapeHTML } from './utils/helpers.js';
import { normalizeCnpj } from './ui.js';

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

    const hasComma = str.includes(',');
    const hasDot = str.includes('.');

    // Case 1: Only dots (e.g., "22.50" or "1000"). Treat as US/Standard float.
    if (hasDot && !hasComma) {
        return parseFloat(str);
    }

    // Case 2: Only commas (e.g., "22,50"). Treat as BR.
    if (hasComma && !hasDot) {
        return parseFloat(str.replace(',', '.'));
    }

    // Case 3: Both separators (mixed). Check which comes last to determine format.
    if (hasDot && hasComma) {
        const lastDotIndex = str.lastIndexOf('.');
        const lastCommaIndex = str.lastIndexOf(',');

        if (lastDotIndex > lastCommaIndex) {
            // US format: "1,234.50" (comma is thousands, dot is decimal)
            return parseFloat(str.replace(/,/g, ''));
        } else {
            // BR format: "1.234,50" (dot is thousands, comma is decimal)
            return parseFloat(str.replace(/\./g, '').replace(',', '.'));
        }
    }

    // Case 4: No separators (e.g., "1000")
    return parseFloat(str);
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

    let formattedFooterInfo = escapeHTML(footerInfo)
        .replace(/(Bank Information :)/g, '<b>$1</b>')
        .replace(/(Credit To :)/g, '<b>$1</b>')
        .replace(/(Payment Term :)/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');

    if (ptaxRate && ptaxRate > 0) {
        // PTAX line is system generated, safe to append
        const ptaxLine = `PTAX: ${ptaxRate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} USD`;
        let newFooterInfo = escapeHTML(footerInfo); // Escape base footer first

        if (newFooterInfo.match(/PTAX/i)) {
            // If PTAX was already there (maybe from a previous edit that got saved safely), replace it
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
            const ncm = escapeHTML(item.ncm);
            const descPt = escapeHTML(item.desc);
            const descEn = escapeHTML(item.nameEn);

            // Lógica de exibição corrigida de acordo com o requisito
            let descriptionHtml = descEn || ''; // Nome em inglês como principal, ou string vazia se não existir.
            if (descPt) { // Adiciona sempre o nome em português abaixo, se existir.
                descriptionHtml += `<br><small style="color: #555;">${descPt}</small>`;
            }

            const qty_unit = escapeHTML(item.qty_unit);
            const qty_kg = parseFloat(item.qty_kg) || 0;


            const um = escapeHTML(item.um);
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
                    <td style="vertical-align: top;">
                        <div class="editable-field" data-target-id="suppliers.${groupIndex}.items.${itemIndex}.nameEn" style="min-height: 1.2em; display: block; margin-bottom: 4px;" placeholder="(Inglês)">${descEn}</div>
                        <div style="font-size: 0.85em; color: #555; border-top: 1px dotted #ccc; padding-top: 2px;">
                            <span class="editable-field" data-target-id="suppliers.${groupIndex}.items.${itemIndex}.desc" style="display: block; min-height: 1em;">${descPt || '(Português)'}</span>
                        </div>
                    </td>
                    <td class="editable-field" data-target-id="suppliers.${groupIndex}.items.${itemIndex}.qty_unit">${qty_unit}</td>
                    <td class="text-center editable-field" data-target-id="suppliers.${groupIndex}.items.${itemIndex}.qty_kg">${formattedQtyKg}</td>
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
                    <td colspan="8" class="supplier-info-cell editable-field" data-target-id="suppliers.${groupIndex}.info">${escapeHTML(supplierInfo).replace(/\n/g, '<br>')}</td>
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
        const desc = escapeHTML(cost.desc);
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
                        ${escapeHTML(exporterInfo).replace(/\n/g, '<br>')}
                    </td>
                </tr>
                <tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
                <tr><td colspan="8" class="text-center bold editable-field">INVOICE ${escapeHTML(invoiceNumber)}</td></tr>
                <tr>
                    <td colspan="3" class="header-bg bold">IMPORTER&nbsp;</td>
                    <td colspan="5" class="header-bg bold">INVOICE DETAILS</td>
                </tr>
                <tr>
                    <td colspan="3" rowspan="7" class="italic" style="vertical-align: center; padding: 6px;">
                        <div style="display: flex; align-items: center; height: 100%;">
                        <div class="editable-field" data-target-id="importerInfo" style="white-space: pre-wrap; width: 60%; flex-shrink: 0;">${escapeHTML(importerInfo).replace(/\n/g, '<br>')}</div>
                            <div style="width: 40%; text-align: center;">
                                <img src="${secondaryLogoUrl}" alt="Secondary Logo" style="max-width: 190px; max-height: 120px; object-fit: contain;">
                            </div>
                        </div>
                    </td>
                    <td colspan="5" rowspan="7" class="bold" style="vertical-align: top; padding: 6px; line-height: 1.6;">
                        <u>INVOICE&nbsp;NUMBER:&nbsp;</u> <span class="editable-field" data-target-id="invoiceNumber">${escapeHTML(invoiceNumber)}</span><br>
                        <u>DATE:&nbsp;</u> <span class="editable-field" data-target-id="invoiceDate">${escapeHTML(formattedDate)}</span><br>
                        <u>PAYMENT&nbsp;TERM:&nbsp;</u> <span class="editable-field" data-target-id="paymentTerm">${escapeHTML(paymentTerm)}</span><br>
                        <u>&nbsp;PORT&nbsp;OF&nbsp;DEPARTURE&nbsp;:&nbsp;</u> <span class="editable-field" data-target-id="portOfDeparture">${escapeHTML(portOfDeparture)}</span><br>
                        <u>DESTINATION&nbsp;AIR&nbsp;PORT&nbsp;:&nbsp;</u> <span class="editable-field" data-target-id="destinationPort">${escapeHTML(destinationPort)}</span><br>
                        <u>INCOTERM :</u> <span class="editable-field" data-target-id="incoterm">${escapeHTML(incoterm)}</span><br>
                        <u>BOOKING:&nbsp;</u> <span class="editable-field" data-target-id="booking">${escapeHTML(booking)}</span>
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

    renderCostsList();
    updatePreview();
}

function removeCost(index) {
    showConfirmModal(
        'Remover Custo?',
        'Tem certeza que deseja remover este custo adicional?',
        () => {
            invoiceData.costs.splice(index, 1);
            renderCostsList();
            updatePreview();
        }
    );
}

// Make available globally for inline onclick handlers
window.removeCost = removeCost;

function renderCostsList() {
    const costsListContainer = document.getElementById('costsList');
    if (!costsListContainer) return;

    costsListContainer.innerHTML = '';

    if (invoiceData.costs.length === 0) {
        costsListContainer.innerHTML = '<p class="text-sm text-gray-500 italic text-center">Nenhum custo adicional.</p>';
        return;
    }

    invoiceData.costs.forEach((cost, index) => {
        const costItem = document.createElement('div');
        costItem.className = 'cost-item-card'; // Will add css for this
        costItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #f9fafb; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 0.375rem; margin-bottom: 0.5rem;';

        costItem.innerHTML = `
            <div style="flex-grow: 1; margin-right: 0.5rem;">
                <div style="font-size: 0.875rem; font-weight: 500;">${escapeHTML(cost.desc)}</div>
                <div style="font-size: 0.8rem; color: #6b7280;">R$ ${parseFloat(cost.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <button onclick="window.removeCost(${index})" style="color: #ef4444; background: none; border: none; cursor: pointer; padding: 4px;" title="Remover">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        costsListContainer.appendChild(costItem);
    });
}

function printInvoice() {
    window.print();
}



async function saveChanges() {
    const documentDataString = localStorage.getItem('currentDocument');
    if (!documentDataString) {
        showNotification("Erro: Dados da operação não encontrados para salvar.", "danger");
        return;
    }
    const documentData = JSON.parse(documentDataString);
    const operationId = documentData.operation.id;

    // Reconstruct the operation object from the global invoiceData
    const updatedOperationData = {
        invoiceNumber: invoiceData.invoiceNumber,
        date: invoiceData.invoiceDate,
        exporterInfo: invoiceData.exporterInfo,
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
        suppliers: invoiceData.suppliers,
        items: invoiceData.suppliers.flatMap(s => s.items)
    };

    const urlParams = new URLSearchParams(window.location.search);
    const origin = urlParams.get('origin');

    try {
        let savedData;

        // --- SYNC BACK TO STOCK (New Feature) ---
        // If items have item_id (UUID), check if we need to update the master stock record
        if (invoiceData.suppliers) {
            const syncPromises = [];

            invoiceData.suppliers.forEach((supplier, supplierIndex) => {
                const supplierId = supplier.id || (allItems.find(s => s.cnpj === supplier.cnpj) || {}).id; // Try to resolve supplier ID if missing

                supplier.items.forEach((item, itemIndex) => {
                    let stockItem;

                    // 1. Try UUID (Strong Link)
                    if (item.item_id) {
                        stockItem = allItems.find(i => i.id === item.item_id);
                    }

                    // 2. Fallback: Code + Supplier (Legacy Link)
                    if (!stockItem && item.code && supplierId) {
                        stockItem = allItems.find(i => i.code === item.code && i.supplier_id === supplierId);
                    }

                    // 3. FALLBACK "ULTIMATE": Description Match (Robust)
                    if (!stockItem && item.desc) {
                        const targetDesc = item.desc.replace(/\s+/g, ' ').trim().toLowerCase();

                        // Try to find by description AND supplier (if known)
                        if (supplierId) {
                            stockItem = allItems.find(i => {
                                const iName = (i.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
                                // if (iName.includes('vilma')) console.log(`   ? "${iName}" === "${targetDesc}"`);
                                return i.supplier_id === supplierId && iName === targetDesc;
                            });
                        }

                        // If still not found, try GLOBAL description match (careful, but better than nothing for update)
                        if (!stockItem) {
                            stockItem = allItems.find(i =>
                                (i.name || '').replace(/\s+/g, ' ').trim().toLowerCase() === targetDesc
                            );
                        }

                        if (stockItem) {
                            console.log(`[SYNC] Item linkado por Nome: "${item.desc}" -> ID: ${stockItem.id}`);
                            item.item_id = stockItem.id; // Save the link for future!
                        }
                    }

                    // 4. FALLBACK "HAIL MARY": Position/Index Match via nfeData
                    // If everything else fails, assume the order in the invoice matches the order in ID-rich nfeData.
                    if (!stockItem) {
                        const docData = JSON.parse(localStorage.getItem('currentDocument') || '{}');
                        // We need to find the NFE group corresponding to this supplier index
                        // Note: operation.nfeData might not match invoiceData.suppliers 1:1 if suppliers were merged/deleted.
                        // BUT, usually they map 1:1 in order.
                        if (docData.operation && docData.operation.nfeData && docData.operation.nfeData[supplierIndex]) {
                            const originalNfeGroup = docData.operation.nfeData[supplierIndex];
                            // Check if the item exists at the same index
                            if (originalNfeGroup && originalNfeGroup.produtos && originalNfeGroup.produtos[itemIndex]) {
                                const originalItem = originalNfeGroup.produtos[itemIndex];
                                const originalCode = originalItem.code; // This comes from XML!

                                // Now try to find functionality by Code (that we just recovered!)
                                if (originalCode && supplierId) {
                                    stockItem = allItems.find(i => i.code === originalCode && i.supplier_id === supplierId);
                                    if (stockItem) {
                                        console.log(`[SYNC-INDEX] MATCH FOUND via Index [${supplierIndex}][${itemIndex}]! code: ${originalCode}, ID: ${stockItem.id}`);
                                        item.item_id = stockItem.id;
                                        item.code = originalCode; // Restore the code in the invoice item too
                                    }
                                }
                            }
                        }
                    }

                    // 4. FALLBACK "HAIL MARY": Position/Index Match via nfeData
                    // If everything else fails, assume the order in the invoice matches the order in ID-rich nfeData.
                    if (!stockItem && invoiceData.nfeData) { // Check global or operation nfeData
                        // We need valid nfeData access here. 
                        // In saveChanges context, 'invoiceData' is what we are saving (updatedOperationData in main flow context usually has nfeData mixed in)
                        // But 'nfeData' global might be available or we check 'documentData' from localStorage if needed.
                        // Let's use the global 'nfeData' populated in initialize() if possible, or try to find it.

                        if (!nfeData || !nfeData.notaFiscal) {
                            // Try to reload nfeData from localStorage if missing in current context
                            const docData = JSON.parse(localStorage.getItem('currentDocument') || '{}');
                            if (docData.operation && docData.operation.nfeData) {
                                // Rebuilding flat list map? No, just match by Supplier Index.
                            }
                        }

                        // Complex logic: We are inside suppliers.forEach (supplier) -> items.forEach (item)
                        // We need the index of 'supplier' in 'invoiceData.suppliers' and index of 'item' in 'supplier.items'
                        // But forEach callback doesn't give us the index easily unless we change the loop signature.
                        // Wait, forEach(item, index) IS available.
                        // I need to change lines 465 and 468 to capture indices.
                    }

                    if (stockItem) {
                        let needsUpdate = false;
                        const updatePayload = {};

                        // --- SYNC FEATURE: PULL FROM STOCK ---
                        // If Invoice English Name is empty, but Stock has one, pull it!
                        if (!item.nameEn && (stockItem.name_en || stockItem.nameEn)) {
                            item.nameEn = stockItem.name_en || stockItem.nameEn;
                            console.log(`[SYNC] Pulling English Name from Stock: "${item.nameEn}"`);

                            // UI REFRESH: Immediately update the DOM element so the user sees it without reload
                            // We need to construct the data-target-id based on indices.
                            // But wait, indentation means we don't have scope of Loop Index here directly in this block?
                            // Ah, we added supplierIndex and itemIndex to the loops in step 605!
                            // So we just need to verify we can use them to find the element.
                            const domId = `suppliers.${supplierIndex}.items.${itemIndex}.nameEn`;
                            const domEl = document.querySelector(`[data-target-id="${domId}"]`);
                            if (domEl) {
                                domEl.innerText = item.nameEn;
                                domEl.classList.add('flash-update'); // Optional visual cue
                            }
                        }

                        // Check Name in English
                        const currentNameEn = stockItem.name_en || stockItem.nameEn || '';
                        const newNameEn = item.nameEn || '';

                        console.log(`[DEBUG] Comparando Inglês para ${stockItem.name}:`);
                        console.log(`   - Atual no Banco: "${currentNameEn}"`);
                        console.log(`   - Novo na Invoice: "${newNameEn}"`);

                        if (newNameEn && newNameEn !== currentNameEn) {
                            updatePayload.name_en = newNameEn; // Standardize on snake_case for DB
                            needsUpdate = true;
                            console.log(`   -> DIFERENÇA DETECTADA! name_en será atualizado.`);
                        } else {
                            console.log(`   -> IGUAIS ou VAZIO. Nenhuma atualização necessária.`);
                        }

                        // Check NCM
                        const normalize = (s) => s ? s.replace(/\D/g, '') : '';
                        if (normalize(item.ncm) !== normalize(stockItem.ncm) && item.ncm) {
                            updatePayload.ncm = item.ncm;
                            needsUpdate = true;
                            console.log(`   -> DIFERENÇA NCM DETECTADA!`);
                        }

                        if (needsUpdate) {
                            console.log(`[DEBUG] Enviando update para o DB (ID: ${stockItem.id})...`, updatePayload);
                            // If we didn't have the UUID before, we can technically use the ID found via fallback
                            // But updateItem requires the ID. stockItem.id is definitely the UUID.
                            const updatePromise = updateItem(stockItem.id, updatePayload)
                                .then(updatedItem => {
                                    updateLocalItem(updatedItem); // Update local state immediately
                                    console.log("[DEBUG] Sucesso! Local item state updated:", updatedItem.name);
                                })
                                .catch(err => {
                                    console.error("[DEBUG] ERRO ao atualizar item:", err);
                                });
                            syncPromises.push(updatePromise);
                        }
                    } else {
                        console.log(`[DEBUG] Ignorando item ${item.desc} (desc) - Não vinculado a estoque.`);
                    }
                });
            });

            if (syncPromises.length > 0) {
                showNotification(`Sincronizando ${syncPromises.length} alterações com o cadastro de produtos...`, 'info');
                await Promise.all(syncPromises);
                showNotification(`${syncPromises.length} itens do estoque foram atualizados com as informações desta invoice.`, 'success');
            }
        }
        // ----------------------------------------

        if (origin === 'purchase-orders') {
            // It's a Purchase Order, so we update the 'purchase_orders' table
            savedData = await updatePurchaseOrder(operationId, updatedOperationData);
            showNotification(`Ordem de Compra ${savedData.id} atualizada com sucesso!`, 'success');
        } else {
            // It's a regular Operation, so we update the 'operations' table
            savedData = await updateOperation(operationId, updatedOperationData);
            showNotification(`Operação ${savedData.invoiceNumber} atualizada com sucesso no banco de dados!`, 'success');
        }

        // Update the local copy in localStorage for immediate consistency
        const newDocumentData = { ...documentData, operation: savedData };
        localStorage.setItem('currentDocument', JSON.stringify(newDocumentData));

    } catch (error) {
        showNotification(`Erro ao salvar alterações no banco de dados: ${error.message}`, 'danger');
        console.error('Falha ao atualizar via Supabase:', error);
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

                // --- SELF-HEALING ON LOAD ---
                // Attempt to restore missing links (item_id/code) by cross-referencing nfeData
                console.log("[DEBUG] Running Self-Healing Check on stored suppliers...");
                invoiceData.suppliers.forEach(supp => {
                    const suppCnpj = normalizeCnpj(supp.cnpj || '');

                    // Find corresponding NFE group
                    console.log(`[DEBUG] Looking for NFE match for Supplier CNPJ: "${suppCnpj}"`);
                    let matchingNfe = operation.nfeData.find(nfe => {
                        const nfeCnpj = nfe.fornecedor?.cnpj ? normalizeCnpj(nfe.fornecedor.cnpj) : '';
                        return nfeCnpj === suppCnpj && suppCnpj !== '';
                    });

                    // Fallback: If no CNPJ match (or empty CNPJ), try to match by Item Name content
                    if (!matchingNfe) {
                        console.log("[DEBUG] CNPJ match failed. Trying to infer NFE group by item names...");
                        matchingNfe = operation.nfeData.find(nfe => {
                            if (!nfe.produtos) return false;
                            // Check if any item in this NFE matches an item in the current Supplier list
                            const matchFound = nfe.produtos.some(nfeProd =>
                                supp.items.some(suppItem => {
                                    const sDesc = (suppItem.desc || '').replace(/\s+/g, ' ').trim().toLowerCase();
                                    const nDesc = (nfeProd.name || '').replace(/\s+/g, ' ').trim().toLowerCase();

                                    // LOG THE COMPARISON FOR THE FIRST FEW ITEMS TO SEE THE PROBLEM
                                    // (Limit logs to avoid browser crash if lists are huge, but print conflicts)
                                    if (suppItem.desc.includes('Vilma') && nfeProd.name.includes('Vilma')) {
                                        console.log(`[COMPARE] S: "${sDesc}" | N: "${nDesc}" | EQ: ${sDesc === nDesc}`);
                                    }

                                    return sDesc === nDesc && sDesc.length > 0;
                                })
                            );
                            if (matchFound) console.log(`[DEBUG] Inference SUCCESS for NFE owner: ${nfe.fornecedor?.nome}`);
                            return matchFound;
                        });

                        if (matchingNfe) {
                            console.log(`[DEBUG] -> INFERRED match via Item Name! Found NFE for: ${matchingNfe.fornecedor?.nome}`);
                            // Self-heal the missing CNPJ in the supplier object
                            if (!supp.cnpj && matchingNfe.fornecedor?.cnpj) {
                                supp.cnpj = matchingNfe.fornecedor.cnpj;
                                console.log(`[DEBUG] Backfilled missing CNPJ on supplier: ${supp.cnpj}`);
                            }
                        }
                    }

                    if (matchingNfe) {
                        console.log(`[DEBUG] -> FOUND NFE for CNPJ ${suppCnpj}`);
                    }

                    if (matchingNfe && matchingNfe.produtos) {
                        supp.items.forEach(item => {
                            if (!item.item_id || !item.code) {
                                // Link strategy: Name (desc) or exact price+quantity match?
                                // Let's try explicit name match first
                                let match = matchingNfe.produtos.find(p => p.name === item.desc);

                                // Debug matching failure
                                if (!match) {
                                    console.log(`[DEBUG] No exact name match for "${item.desc}". Available in NFE:`, matchingNfe.produtos.map(p => p.name));
                                    // Try relaxed match (trim, lowercase, normalize spaces)
                                    match = matchingNfe.produtos.find(p => {
                                        const pName = (p.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
                                        const iDesc = (item.desc || '').replace(/\s+/g, ' ').trim().toLowerCase();
                                        return pName === iDesc;
                                    });
                                }

                                // If name changed, try fallback: same quantity and same price (risky but better than nothing)
                                // Only do this if specific enough? No, let's stick to name or code if we can found it.

                                if (match) {
                                    if (!item.item_id && match.item_id) {
                                        item.item_id = match.item_id;
                                        console.log(`[DEBUG] Healed item_id for "${item.desc}" -> ${item.item_id}`);
                                    }
                                    if (!item.code && match.code) {
                                        item.code = match.code;
                                        console.log(`[DEBUG] Healed code for "${item.desc}" -> ${item.code}`);
                                    }
                                }
                            }
                        });
                    }
                });
                // -----------------------------
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
                    let matchedItemInStock = null;

                    // 1. TENTATIVA FORTE: Buscar pelo UUID (item_id)
                    // Este ID é salvo durante a finalização da importação (js/operations.js)
                    if (item.item_id) {
                        matchedItemInStock = allItems.find(stockItem => stockItem.id === item.item_id);
                        if (matchedItemInStock) console.log(`Item vinculado por UUID: ${item.name}`);
                    }

                    // 2. FALLBACK 1: Buscar por Código + Fornecedor (Método antigo)
                    if (!matchedItemInStock && item.code && matchedSupplier) {
                        matchedItemInStock = allItems.find(stockItem =>
                            stockItem.code === item.code && stockItem.supplier_id === matchedSupplier.id
                        );
                        if (matchedItemInStock) console.log(`Item vinculado por Código+Fornecedor: ${item.name}`);
                    }

                    // 3. FALLBACK 2: Buscar por NCM (Menos preciso, usado apenas para metadados secundários se tudo falhar)
                    if (!matchedItemInStock) {
                        const ncmFromXml = item.ncm;
                        matchedItemInStock = allItems.find(stockItem => {
                            if (stockItem.ncm && ncmFromXml) {
                                const normalizedStockNcm = stockItem.ncm.replace(/\D/g, '');
                                const normalizedXmlNcm = ncmFromXml.replace(/\D/g, '');
                                return normalizedStockNcm === normalizedXmlNcm;
                            }
                            return false;
                        });
                        if (matchedItemInStock) console.log(`Item vinculado por NCM (Fallback fraco): ${item.name}`);
                    }

                    let nameEn = '';
                    if (matchedItemInStock) {
                        nameEn = matchedItemInStock.name_en || matchedItemInStock.nameEn || ''; // Support both snake_case (DB) and camelCase (legacy)
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
                        item_id: matchedItemInStock ? matchedItemInStock.id : null, // Persist for next edit/save
                        code: item.code || '',
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
                        nameEn: item.name_en || '',
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
    renderCostsList();

    // --- Populate and add listeners to control panel inputs ---
    const ptaxRateInput = document.getElementById('ptaxRate');
    const distributeValueInput = document.getElementById('distributeValue'); // Restored
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

    applyExchangeRateToggle.addEventListener('change', function () {
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

    distributeValueToggle.addEventListener('change', function () {
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

    // Listener para remover custos
    const previewContainer = document.getElementById('invoice-preview');
    if (previewContainer) {
        previewContainer.addEventListener('click', function (e) {
            if (e.target.classList.contains('remove-cost-btn')) {
                const index = parseInt(e.target.dataset.index);
                removeCost(index);
            }
        });
    }

    document.getElementById('save-changes-btn').addEventListener('click', saveChanges);
    document.getElementById('print-invoice-btn').addEventListener('click', printInvoice);
    document.getElementById('packing-list-btn').addEventListener('click', async () => {
        await saveChanges();
        window.location.href = 'gerador_packing_list.html';
    });



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
            window.location.href = 'index.html#operations-history';
        }
    });

    // --- MODAL LISTENERS ---
    const confirmCancelBtn = document.getElementById('confirm-modal-cancel-btn');
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
            closeModal('confirm-modal');
        });
    }

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal-backdrop.is-open');
            openModals.forEach(modal => closeModal(modal.id));
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

    preview.addEventListener('click', function (e) {
        const field = e.target.closest('.editable-field');
        if (!field) return;

        if (field.isEditing) return;
        field.isEditing = true;

        field.contentEditable = true;
        field.focus();

        const onBlur = function () {
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

            if (propertyName === 'qty_kg') {
                temp.manualWeight = true;
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
                // Only auto-calculate if manual override is NOT active
                if (!item.manualWeight) {
                    item.qty_kg = parseQtyUnit(item.qty_unit) * (parseFloat(item.qty) || 0);
                }
            }

            // saveChanges(); // Removed to prevent notification on every blur
            updatePreview();
        };

        field.addEventListener('blur', onBlur, { once: true });
    });
}

// --- MODAL FUNCTIONS (Copied/Adapted from ui.js) ---

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        document.body.classList.add('modal-is-open');
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        document.body.classList.remove('modal-is-open');
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function showConfirmModal(title, text, onConfirm) {
    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-text').innerText = text;

    const confirmBtn = document.getElementById('confirm-modal-btn');
    if (!confirmBtn) {
        console.error("Confirm button not found!");
        return;
    }
    // Remove old event listeners by cloning
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
        closeModal('confirm-modal');
    });

    openModal('confirm-modal');
}

document.addEventListener('DOMContentLoaded', initialize);