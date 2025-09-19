let currentProducts = []; // Global variable to hold products from PDF

async function fetchExchangeRate() {
    console.log("Fetching exchange rate...");
    const button = document.querySelector('button[onclick="fetchExchangeRate()"] i');
    button.classList.add('fa-spin');
    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (!response.ok) throw new Error('A resposta da rede não foi bem-sucedida');
        const data = await response.json();
        const rate = data.rates.BRL;
        if (rate) {
            document.getElementById('ptaxRate').value = rate.toFixed(4);
            updatePreview();
        }
    } catch (error) {
        console.error('Falha ao obter a cotação do dólar automaticamente. Por favor, insira manualmente.');
    } finally {
        button.classList.remove('fa-spin');
    }
}

function updatePreview() {
    console.log("Updating preview...");
    const preview = document.getElementById('invoice-preview');
    
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const invoiceDate = document.getElementById('invoiceDate').value;
    const importerInfo = document.getElementById('importerInfo').value;
    const booking = document.getElementById('booking').value;
    const paymentTerm = document.getElementById('paymentTerm').value;
    const portOfDeparture = document.getElementById('portOfDeparture').value;
    const destinationPort = document.getElementById('destinationPort').value;
    const incoterm = document.getElementById('incoterm').value;
    let footerInfo = document.getElementById('footerInfo').value;
    const ptaxRate = parseFloat(document.getElementById('ptaxRate').value) || 1; // Evita divisão por zero
    
    const alibrasLogoUrl = 'images/alibras-logo.png';
    const secondaryLogoUrl = 'images/loia-logo.png';
    
    const ptaxLine = `PTAX : ${ptaxRate.toFixed(4)} USD`;
    if (footerInfo.match(/PTAX/i)) {
        footerInfo = footerInfo.replace(/PTAX.*(?:\n|$)/i, ptaxLine + '\n');
    } else {
        footerInfo += `\n${ptaxLine}`;
    }
    const formattedFooterInfo = footerInfo
        .replace(/(Bank Information :)/g, '<b>$1</b>')
        .replace(/(Credit To :)/g, '<b>$1</b>')
        .replace(/(Payment Term :)/g, '<b>$1</b>')
        .replace(/(PTAX :)/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');

    let formattedDate = '';
    if (invoiceDate) {
        const date = new Date(invoiceDate + 'T00:00:00');
        formattedDate = date.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
    }

    let itemsAndSuppliersHTML = '';
    let productSubtotalUSD = 0;
    let totalPackages = 0;
    let netWeight = 0;

    document.querySelectorAll('#supplier-list .supplier-group').forEach(group => {
        group.querySelectorAll('.item-list .item').forEach(item => {
            const qty = parseFloat(item.querySelector('[name=qty]').value) || 0;
            const ncm = item.querySelector('[name=ncm]').value;
            const desc = item.querySelector('[name=desc]').value;
            const qty_unit = item.querySelector('[name=qty_unit]').value;
            const qty_kg = parseFloat(item.querySelector('[name=qty_kg]').value) || 0;
            const um = item.querySelector('[name=um]').value;
            const priceBRL = parseFloat(item.querySelector('[name=price]').value) || 0;
            
            const priceUSD = priceBRL / ptaxRate;
            const totalUSD = (item.dataset.totalPriceBRL / ptaxRate) || (qty_kg * priceUSD);

            productSubtotalUSD += totalUSD;
            totalPackages += qty;
            netWeight += qty_kg;
            
            const formattedPriceUSD = priceUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formattedTotalUSD = totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formattedQtyKg = qty_kg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            itemsAndSuppliersHTML += `
                <tr>
                    <td class="text-center">${qty.toLocaleString('en-US')}</td>
                    <td class="text-center">${ncm}</td>
                    <td>${desc}</td>
                    <td>${qty_unit}</td>
                    <td class="text-center">${formattedQtyKg}</td>
                    <td>${um}</td>
                    <td class="text-right">$${formattedPriceUSD}</td>
                    <td class="text-center bold">$${formattedTotalUSD}</td>
                </tr>
            `;
        });
        
        const supplierInfo = group.querySelector('[name=supplier_info]').value;
        if (supplierInfo) {
            itemsAndSuppliersHTML += `
                <tr>
                    <td colspan="8" class="supplier-info-cell">${supplierInfo.replace(/\n/g, '<br>')}</td>
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
    document.querySelectorAll('#cost-list .item').forEach(item => {
        const desc = item.querySelector('[name=cost_desc]').value;
        const valueBRL = parseFloat(item.querySelector('[name=cost_value]').value) || 0;
        const valueUSD = valueBRL / ptaxRate;
        costsSubtotalUSD += valueUSD;
        costsHTML += `
            <tr>
                <td colspan="7" class="text-right bold">${desc}</td>
                <td class="text-center bold">$${valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    });
    
    const grandTotalUSD = productSubtotalUSD + costsSubtotalUSD;
    const grossWeight = netWeight > 0 ? netWeight * 1.035 : 0;

    preview.innerHTML = `
        <table cellspacing="0" border="0">
            <colgroup>
                <col width="5%"><col width="10%"><col width="47%"><col width="9%"><col width="8%"><col width="5%"><col width="8%"><col width="8%">
            </colgroup>
            <tbody>
                <tr>
                    <td colspan="3" rowspan="9" height="180" class="logo-cell text-center">
                        <img src="${alibrasLogoUrl}" alt="Alibras Logo" style="max-width: 250px; max-height: 120px; object-fit: contain;">
                    </td>
                    <td colspan="5" rowspan="9" style="vertical-align: top; padding: 6px; line-height: 1.4;">
                        <b class="bold">ALIBRAS ALIMENTOS BRASIL</b><br>
                        Av:Washington Luiz,585,Ap101,
                        Centro - Dom Cavati - MG - 35148-000 - Brasil<br>
                        CNPJ: 18.629.179/0001-06<br>
                        <b>Contact :</b> Bruna da Silva Rodrigues<br>
                        <b>Phone :</b> + 55 33 999093304<br>
                        <b>DUNS #</b> G43527752<br>
                        <b>FDA #</b> 16606877688<br>
                        <a href="mailto:alibrasexportimport@gmail.com" style="color: #000; text-decoration: none;"><b>E-MAIL:</b> alibrasexportimport@gmail.com</a>
                    </td>
                </tr>
                <tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
                <tr><td colspan="8" class="text-center bold">INVOICE ${invoiceNumber}</td></tr>
                <tr>
                    <td colspan="3" class="header-bg bold">IMPORTER&nbsp;</td>
                    <td colspan="5" class="header-bg bold">INVOICE DETAILS</td>
                </tr>
                <tr>
                    <td colspan="3" rowspan="7" class="italic" style="vertical-align: center; padding: 6px;">
                        <div style="display: flex; align-items: center; height: 100%;">
                            <div style="white-space: pre-wrap; width: 60%; flex-shrink: 0;">${importerInfo.replace(/\n/g, '<br>')}</div>
                            <div style="width: 40%; text-align: center;">
                                <img src="${secondaryLogoUrl}" alt="Secondary Logo" style="max-width: 190px; max-height: 120px; object-fit: contain;">
                            </div>
                        </div>
                    </td>
                    <td colspan="5" rowspan="7" class="bold" style="vertical-align: top; padding: 6px; line-height: 1.6;">
                        <u>INVOICE&nbsp;NUMBER:&nbsp;</u> ${invoiceNumber}<br>
                        <u>DATE:&nbsp;</u> ${formattedDate}<br>
                        <u>PAYMENT&nbsp;TERM:&nbsp;</u> ${paymentTerm}<br>
                        <u>&nbsp;PORT&nbsp;OF&nbsp;DEPARTURE&nbsp;:&nbsp;</u> ${portOfDeparture}<br>
                        <u>DESTINATION&nbsp;AIR&nbsp;PORT&nbsp;:&nbsp;</u> ${destinationPort}<br>
                        <u>INCOTERM :</u> ${incoterm}<br>
                        <u>BOOKING:&nbsp;</u> ${booking}
                    </td>
                </tr>
                <tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
                <tr class="header-bg bold">
                    <td class="text-center">QNT</td><td class="text-center">NCM</td><td class="text-center">DESCRIPTION</td><td class="text-center">QTY UNIT</td><td class="text-center">QTY KG</td><td class="text-center">U/M</td><td class="text-right">UNIT $</td><td class="text-center">$ USD</td>
                </tr>
                ${itemsAndSuppliersHTML}
                ${costsHTML}
                <tr>
                    <td colspan="7" class="text-right bold">TOTAL</td>
                    <td class="text-center bold">$${grandTotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                    <td colspan="5" rowspan="5" style="vertical-align: top; line-height: 1.5;">${formattedFooterInfo}</td>
                    <td colspan="3" rowspan="5" style="vertical-align: top; padding: 6px; line-height: 1.6;">
                        Total of Package: ${totalPackages.toLocaleString('en-US')}<br>
                        Gross Weight: ${grossWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}kg<br>
                        Net Weight: ${netWeight.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}kg<br>
                        Country of Origin : Brazil<br>
                        Destination : USA
                    </td>
                </tr>
                <tr></tr><tr></tr><tr></tr><tr></tr>
                <tr><td colspan="8" class="no-border" style="height: 20px;">&nbsp;</td></tr>
                <tr><td colspan="8" class="text-center no-border">_________________________</td></tr>
                <tr><td colspan="8" class="text-center no-border bold">Exporter's Signature</td></tr>
            </tbody>
        </table>
    `;
}

function addSupplierGroup() {
    console.log("Adding supplier group...");
    const list = document.getElementById('supplier-list');
    const group = document.createElement('div');
    group.className = 'supplier-group';
    const groupCount = list.children.length + 1;
    group.innerHTML = `
        <div class="group-header">
            <h3 class="font-semibold text-slate-700">Grupo de Fornecedor #${groupCount}</h3>
            <button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove(); updatePreview();"><i class="fas fa-trash-alt"></i></button>
        </div>
        <div class="form-group">
            <label>Informações do Fornecedor (FDA, Endereço, etc.)</label>
            <textarea name="supplier_info" rows="2" oninput="updatePreview()"></textarea>
        </div>
        <div class="item-list space-y-3"></div>
        <button onclick="addItem(this)" class="btn btn-secondary w-full mt-2 btn-sm"><i class="fas fa-plus mr-2"></i>Adicionar Produto</button>
    `;
    list.appendChild(group);
    
    const content = list.parentElement;
    if (content.classList.contains('expanded')) {
        content.style.maxHeight = content.scrollHeight + "px";
    }
    group.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function addItem(button) {
    console.log("Adding item...");
    const itemList = button.previousElementSibling;
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
        <div class="item-header">
            <span class="font-semibold text-slate-600">Produto</span>
            <button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove(); updatePreview();"><i class="fas fa-times"></i></button>
        </div>
        <div class="form-group"><label>Quantidade</label><input type="number" name="qty" value="1" min="0" oninput="updatePreview()"></div>
        <div class="form-group"><label>NCM</label><input type="text" name="ncm" oninput="this.value = this.value.replace(/[^0-9]/g, ''); updatePreview();"></div>
        <div class="form-group"><label>Descrição</label><input type="text" name="desc" oninput="updatePreview()"></div>
        <div class="form-group"><label>Unidade Qtd.</label><input type="text" name="qty_unit" oninput="updatePreview()"></div>
        <div class="form-group"><label>Peso (KG)</label><input type="number" name="qty_kg" value="0.00" step="0.01" min="0" oninput="updatePreview()"></div>
        <div class="form-group"><label>U/M</label><input type="text" name="um" value="CS" oninput="updatePreview()"></div>
        <div class="form-group"><label>Preço Unitário R$</label><input type="number" name="price" value="0.00" step="0.01" min="0" oninput="updatePreview()"></div>
    `;
    itemList.appendChild(item);

    const content = itemList.closest('.accordion-content');
    if (content && content.classList.contains('expanded')) {
        content.style.maxHeight = content.scrollHeight + "px";
    }
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function addCost() {
    console.log("Adding cost...");
    const list = document.getElementById('cost-list');
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
        <div class="item-header">
            <span class="font-semibold text-slate-600">Custo Adicional</span>
            <button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove(); updatePreview();"><i class="fas fa-times"></i></button>
        </div>
        <div class="form-group"><label>Descrição do Custo</label><input type="text" name="cost_desc" oninput="updatePreview()"></div>
        <div class="form-group"><label>Valor R$</label><input type="number" name="cost_value" value="0.00" step="0.01" min="0" oninput="updatePreview()"></div>
    `;
    list.appendChild(item);

    const content = list.parentElement;
    if (content.classList.contains('expanded')) {
        content.style.maxHeight = content.scrollHeight + "px";
    }
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function printInvoice() {
    window.print();
}

function populateWithOperationData(data) {
    console.log("Populating with operation data:", data);
    const { operation, allSuppliers } = data;
    
    document.getElementById('supplier-list').innerHTML = '';
    document.getElementById('cost-list').innerHTML = '';

    document.getElementById('invoiceNumber').value = operation.id.replace('OP-', '');
    document.getElementById('invoiceDate').value = new Date(operation.date).toISOString().split('T')[0];
    
    document.getElementById('importerInfo').value = 'Loia Foods Import Export & Export LLC\n63-65 Gotthardt Street\nNewark, NJ , 07105 USA\nEmail: operations@loiafood.com\nCONSIGNER: 27 Malvern st. Newark, NJ 07105';
    document.getElementById('booking').value = '255641399';
    document.getElementById('paymentTerm').value = 'Due on receipt - US DOLLAR';
    document.getElementById('portOfDeparture').value = 'SANTOS ( SP)';
    document.getElementById('destinationPort').value = 'NY / NJ';
    document.getElementById('incoterm').value = 'FOB';
    document.getElementById('footerInfo').value = 'Bank Information : Sent in document attached to the email where this proforma was also attached\nCredit To : Alibras Alimentos Brasil - CNPJ: 18.629.179/0001-06\nPayment Term : 100% advance - US Dollar\n\nI declare all the information contained in this invoice to be true and correct';

    const itemsBySupplier = operation.items.reduce((acc, item) => {
        const supplierId = item.supplierId || 'unknown';
        if (!acc[supplierId]) acc[supplierId] = [];
        acc[supplierId].push(item);
        return acc;
    }, {});

    for (const supplierId in itemsBySupplier) {
        addSupplierGroup();
        const groups = document.querySelectorAll('#supplier-list .supplier-group');
        const currentGroup = groups[groups.length - 1];
        const supplier = allSuppliers.find(s => s.id === supplierId);
        
        if (supplier) {
            currentGroup.querySelector('[name=supplier_info]').value = `FDA#${supplier.fda || ''} - ${supplier.name}`;
        }

        const addButton = currentGroup.querySelector('button[onclick="addItem(this)"]');
        itemsBySupplier[supplierId].forEach(item => {
            addItem(addButton);
            const itemForms = currentGroup.querySelectorAll('.item');
            const currentItemForm = itemForms[itemForms.length - 1];
            
            const boxes = Math.floor(item.operationQuantity / (item.unitsPerPackage || 1));
            currentItemForm.querySelector('[name=qty]').value = boxes;
            currentItemForm.querySelector('[name=ncm]').value = item.ncm;
            currentItemForm.querySelector('[name=desc]').value = item.nameEn || item.name;
            currentItemForm.querySelector('[name=qty_unit]').value = `${item.unitsPerPackage || 1}x${item.unitMeasureValue}${item.unitMeasureType}`;
            
            let itemNetWeight = item.operationQuantity * (item.unitMeasureValue || 0);
            if (item.unitMeasureType === 'g' || item.unitMeasureType === 'ml') {
                itemNetWeight /= 1000;
            }
            currentItemForm.querySelector('[name=qty_kg]').value = itemNetWeight.toFixed(2);
            currentItemForm.querySelector('[name=price]').value = item.operationPrice.toFixed(2);
        });
    }
}

// Lógica da Janela Flutuante (Floating Window)
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = document.getElementById("floating-window-header");

    if (header) {
        header.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}


function initialize() {
    console.log("Initializing...");
    makeDraggable(document.getElementById('unit-floating-window')); // Ativa o arraste na janela
    const invoiceDataString = sessionStorage.getItem('invoiceData');
    
    if (invoiceDataString) {
        const invoiceData = JSON.parse(invoiceDataString);
        populateWithOperationData(invoiceData);
        sessionStorage.removeItem('invoiceData');
    } else {
        document.getElementById('invoiceNumber').value = '2060';
        document.getElementById('invoiceDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('importerInfo').value = 'Loia Foods Import Export & Export LLC\n63-65 Gotthardt Street\nNewark, NJ , 07105 USA\nEmail: operations@loiafood.com\nCONSIGNER: 27 Malvern st. Newark, NJ 07105';
        document.getElementById('booking').value = '255641399';
        document.getElementById('paymentTerm').value = 'Due on receipt - US DOLLAR';
        document.getElementById('portOfDeparture').value = 'SANTOS ( SP)';
        document.getElementById('destinationPort').value = 'NY / NJ';
        document.getElementById('incoterm').value = 'FOB';
        document.getElementById('footerInfo').value = 'Bank Information : Sent in document attached to the email where this proforma was also attached\nCredit To : Alibras Alimentos Brasil - CNPJ: 18.629.179/0001-06\nPayment Term : 100% advance - US Dollar\n\nI declare all the information contained in this invoice to be true and correct';
        addSupplierGroup();
        const group1 = document.querySelector('#supplier-list .supplier-group:nth-child(1)');
        group1.querySelector('[name=supplier_info]').value = 'FDA#17405485860-RIVELLI E BEZERRA INDUSTRIA E COMERCIO DE ALIMENTOS LTDA';
        
        const addButton1 = group1.querySelector('button[onclick="addItem(this)"]');
        addItem(addButton1);
        let p1 = group1.querySelector('.item:nth-child(1)');
        p1.querySelector('[name=qty]').value = 30;
        p1.querySelector('[name=ncm]').value = '20052000';
        p1.querySelector('[name=desc]').value = 'Loia-Potato Chips (PALHA) 10X800Gr';
        p1.querySelector('[name=qty_unit]').value = '10X800G';
        p1.querySelector('[name=qty_kg]').value = 240;
        p1.querySelector('[name=price]').value = 38.68;
        
        addItem(addButton1);
        let p2 = group1.querySelector('.item:nth-child(2)');
        p2.querySelector('[name=qty]').value = 70;
        p2.querySelector('[name=ncm]').value = '20052000';
        p2.querySelector('[name=desc]').value = 'Loia-Potato Chips (PALHA) 20X300Gr';
        p2.querySelector('[name=qty_unit]').value = '20X300G';
        p2.querySelector('[name=qty_kg]').value = 420;
        p2.querySelector('[name=price]').value = 29.50;

        addCost();
        let c1 = document.querySelector('#cost-list .item');
        c1.querySelector('[name=cost_desc]').value = 'EXPRESSO RADIANTE +13 Pallets';
        c1.querySelector('[name=cost_value]').value = 2596.68;
    }

    document.querySelectorAll('.accordion-header').forEach(button => {
        button.addEventListener('click', () => {
            const content = button.nextElementSibling;
            button.classList.toggle('active');
            content.classList.toggle('expanded');
            
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + 32 + "px";
            } 
        });
    });

    fetchExchangeRate();
}

async function handlePdfUpload(event) {
    console.log("handlePdfUpload: Function started.");
    const file = event.target.files[0];
    if (!file) {
        console.log("handlePdfUpload: No file selected.");
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const preview = document.getElementById('invoice-preview');
    const originalContent = preview.innerHTML;
    preview.innerHTML = `<div class="text-center p-8"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-4">Processando PDF...</p></div>`;

    try {
        console.log("handlePdfUpload: Sending fetch request...");
        const response = await fetch('http://127.0.0.1:8000/extract-pdf-data/', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': 'secret' // Chave de API definida no backend
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("handlePdfUpload: Server response not OK:", errorData);
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const data = await response.json();
        console.log("handlePdfUpload: PDF data received:", data);
        currentProducts = data.produtos;
        showUnitModal(data);

    } catch (error) {
        console.error('handlePdfUpload: Error processing PDF:', error);
        alert(`Falha ao processar PDF: ${error.message}`);
        preview.innerHTML = originalContent;
    }
}

function showUnitModal(data) {
    const windowEl = document.getElementById('unit-floating-window');
    const backdrop = document.getElementById('modal-backdrop-invoice');
    const productList = document.getElementById('modal-product-list');
    productList.innerHTML = '';

    // Apenas preenche a lista, o CSS cuidará do tamanho e rolagem
    if (data.produtos && data.produtos.length > 0) {
        data.produtos.forEach((product, index) => {
            const productDiv = document.createElement('div');
            productDiv.className = 'flex items-center justify-between p-3 bg-white rounded-md border';
            productDiv.innerHTML = `
                <div class="flex-1 mr-4 text-left">
                    <p class="font-medium text-gray-800">${product.name}</p>
                    <p class="text-xs text-gray-500">CÓD: ${product.code || 'N/A'}</p>
                </div>
                <select data-product-index="${index}" class="unit-select input-field" style="width: 100px; padding: 0.5rem; font-size: 0.875rem;">
                    <option value="g">g</option>
                    <option value="kg" selected>kg</option>
                    <option value="ml">ml</option>
                    <option value="l">L</option>
                </select>
            `;
            productList.appendChild(productDiv);
        });
    }
    
    // Mostra o modal usando as novas classes CSS
    backdrop.classList.add('visible');
    windowEl.classList.add('visible');

    document.getElementById('confirm-units-btn').onclick = () => confirmUnits(data);
}

function closeUnitModal() {
    const windowEl = document.getElementById('unit-floating-window');
    const backdrop = document.getElementById('modal-backdrop-invoice');
    
    // Esconde o modal usando as novas classes CSS
    backdrop.classList.remove('visible');
    windowEl.classList.remove('visible');
}

function confirmUnits(data) {
    const selects = document.querySelectorAll('.unit-select');

    selects.forEach(select => {
        const productIndex = parseInt(select.dataset.productIndex, 10);
        const selectedUnit = select.value;
        if (currentProducts[productIndex]) {
            currentProducts[productIndex].unitMeasureType = selectedUnit;
        }
    });

    closeUnitModal();

    try {
        populateFormWithPDFData(data);
        updatePreview();
    } catch (error) {
        console.error("Error during form population or preview update:", error);
    }
}


function populateFormWithPDFData(data) {
    document.getElementById('supplier-list').innerHTML = '';
    document.getElementById('cost-list').innerHTML = '';

    addSupplierGroup();
    const group = document.querySelector('#supplier-list .supplier-group');

    if (data.fornecedor && data.fornecedor.nome) {
        group.querySelector('[name=supplier_info]').value = data.fornecedor.nome;
    }
    
    if (data.notaFiscal && data.notaFiscal.numero) {
        document.getElementById('invoiceNumber').value = data.notaFiscal.numero;
    }

    const addButton = group.querySelector('button[onclick="addItem(this)"]');

    if (currentProducts && currentProducts.length > 0) {
        currentProducts.forEach(product => {
            addItem(addButton);
            const itemForms = group.querySelectorAll('.item');
            const currentItemForm = itemForms[itemForms.length - 1];

            currentItemForm.querySelector('[name=ncm]').value = product.ncm || '';
            currentItemForm.querySelector('[name=desc]').value = product.name || '';
            
            const qtyUnitMatch = product.name.match(/(\d+)\s*[Xx]\s*(\d+)/);
            currentItemForm.querySelector('[name=qty_unit]').value = qtyUnitMatch ? qtyUnitMatch[0] : '';

            currentItemForm.querySelector('[name=qty]').value = (product.quantity || 0);
            
            let qtyKgValue = 0;
            if (qtyUnitMatch && qtyUnitMatch[1] && qtyUnitMatch[2]) {
                const part1 = parseFloat(qtyUnitMatch[1]);
                const part2 = parseFloat(qtyUnitMatch[2]);
                const totalWeight = part1 * part2 * (product.quantity || 0);

                if (product.unitMeasureType === 'g' || product.unitMeasureType === 'ml') {
                    qtyKgValue = totalWeight / 1000;
                } else {
                    qtyKgValue = totalWeight;
                }
            }
            currentItemForm.querySelector('[name=qty_kg]').value = qtyKgValue.toFixed(2);
            
            currentItemForm.querySelector('[name=price]').value = (product.costPrice || 0).toFixed(2);
            currentItemForm.dataset.totalPriceBRL = product.totalPriceBRL || 0;
        });
    }

    updatePreview();
}

window.onload = initialize;