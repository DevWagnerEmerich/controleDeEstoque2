async function fetchExchangeRate() {
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
        console.error('Falha ao obter a taxa de câmbio:', error);
        alert('Não foi possível obter a cotação do dólar automaticamente. Por favor, insira manualmente.');
    } finally {
        button.classList.remove('fa-spin');
    }
}

function updatePreview() {
    const preview = document.getElementById('invoice-preview');
    
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const invoiceDate = document.getElementById('invoiceDate').value;
    const importerInfo = document.getElementById('importerInfo').value;
    const container = document.getElementById('container').value;
    const booking = document.getElementById('booking').value;
    const paymentTerm = document.getElementById('paymentTerm').value;
    const portOfDeparture = document.getElementById('portOfDeparture').value;
    const destinationPort = document.getElementById('destinationPort').value;
    const incoterm = document.getElementById('incoterm').value;
    
    const ptaxRate = parseFloat(document.getElementById('ptaxRate').value) || 0;
    const countryOrigin = document.getElementById('countryOrigin').value;
    const countryDestination = document.getElementById('countryDestination').value;
    let ptaxInfo = document.getElementById('ptaxInfo').value;
    const declarationText = document.getElementById('declarationText').value;

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

    let itemsAndSuppliersHTML = '';
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

            totalPackages += qty;
            netWeight += qty_kg;
            
            itemsAndSuppliersHTML += `
                <tr>
                    <td class="text-center">${qty}</td>
                    <td>${desc}</td>
                    <td class="text-center">${qty_unit}</td>
                    <td class="text-center">${qty_kg.toFixed(2)}</td>
                    <td class="text-center">${um}</td>
                    <td class="text-center">${ncm}</td>
                </tr>
            `;
        });
        
        const supplierInfo = group.querySelector('[name=supplier_info]').value;
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
    
    const grossWeight = netWeight > 0 ? netWeight * 1.035 : 0;
    const ptaxLine = `PTAX : ${ptaxRate.toFixed(4)} USD`;
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
                            Country of Origin of goods : ${countryOrigin}<br>
                            Country of final Destination : ${countryDestination}
                        </td>
                        <td style="border:none; text-align: right; font-size: 10px; vertical-align: top; padding: 8px 0; line-height: 1.4;">
                            ${fullPtaxInfo}
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="border: none; padding-top: 8px;" class="bold">
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
            DATE: ${formattedDate}<br>
            INVOICE #: ${invoiceNumber}<br>
            CONTAINER: ${container}<br>
            PORT OF DEPARTURE: ${portOfDeparture}<br>
            INCONTERM: ${incoterm}<br>
            DESTINATION PORT: ${destinationPort}<br>
            BOOKING: ${booking}
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
                        <b class="bold">ALIBRAS ALIMENTOS BRASIL</b><br>
                        Av:Washington Luiz,585,Ap101,<
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

function addSupplierGroup() {
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
    updatePreview();
}

function addItem(button) {
    const itemList = button.previousElementSibling;
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
        <div class="item-header">
            <span class="font-semibold text-slate-600">Produto</span>
            <button class="btn-icon-danger" onclick="this.parentElement.parentElement.remove(); updatePreview();"><i class="fas fa-times"></i></button>
        </div>
        <div class="form-group"><label>Quantidade (QTYCX)</label><input type="number" name="qty" value="1" min="0" oninput="updatePreview()"></div>
        <div class="form-group"><label>Descrição</label><input type="text" name="desc" oninput="updatePreview()"></div>
        <div class="form-group"><label>Unidade Qtd.</label><input type="text" name="qty_unit" oninput="updatePreview()"></div>
        <div class="form-group"><label>Peso (KG)</label><input type="number" name="qty_kg" value="0.00" step="0.01" min="0" oninput="updatePreview()"></div>
        <div class="form-group"><label>U/M</label><input type="text" name="um" value="CS" oninput="updatePreview()"></div>
        <div class="form-group"><label>NCM</label><input type="text" name="ncm" oninput="this.value = this.value.replace(/[^0-9]/g, ''); updatePreview();"></div>
    `;
    itemList.appendChild(item);

    const content = itemList.closest('.accordion-content');
    if (content && content.classList.contains('expanded')) {
        content.style.maxHeight = content.scrollHeight + "px";
    }
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    updatePreview();
}

function printInvoice() {
    window.print();
}

function populateWithOperationData(data) {
    const { operation, allSuppliers } = data;
    
    document.getElementById('supplier-list').innerHTML = '';

    document.getElementById('invoiceNumber').value = operation.id.replace('OP-', '');
    document.getElementById('invoiceDate').value = new Date(operation.date).toISOString().split('T')[0];
    
    document.getElementById('importerInfo').value = 'Loia Foods Import Export & Export LLC\n27 Malvern st. Newark, NJ 07105\nNewark, NJ , 07105 USA - Phone: 1 973 350 6197\nEmail: operations@loiafood.com';
    document.getElementById('container').value = '';
    document.getElementById('booking').value = '255641399';
    document.getElementById('paymentTerm').value = 'Due on receipt - US DOLLAR';
    document.getElementById('portOfDeparture').value = 'SANTOS ( SP)';
    document.getElementById('destinationPort').value = 'NY / NJ';
    document.getElementById('incoterm').value = 'FOB';

    document.getElementById('countryOrigin').value = 'Brazil';
    document.getElementById('countryDestination').value = 'USA';
    document.getElementById('ptaxInfo').value = 'CONTRATO DE CAMBIO ACC BANCO BRADESCO,\nDESAGIO:10.10%aa,NUMERO DO CONTRATO:
498476052';
    document.getElementById('declarationText').value = 'I declare all the information contained in this packing list to be true and correct';

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
            
            const boxes = (item.unitsPerPackage > 0) ? Math.floor(item.operationQuantity / item.unitsPerPackage) : 0;
            currentItemForm.querySelector('[name=qty]').value = boxes;
            currentItemForm.querySelector('[name=ncm]').value = item.ncm;
            currentItemForm.querySelector('[name=desc]').value = item.nameEn || item.name;
            currentItemForm.querySelector('[name=qty_unit]').value = `${item.unitsPerPackage || 1}x${item.unitMeasureValue}${item.unitMeasureType}`;
            
            let itemNetWeight = item.operationQuantity * (item.unitMeasureValue || 0);
            if (item.unitMeasureType === 'g' || item.unitMeasureType === 'ml') {
                itemNetWeight /= 1000;
            }
            currentItemForm.querySelector('[name=qty_kg]').value = itemNetWeight.toFixed(2);
        });
    }
}

function initialize() {
    const packlistDataString = sessionStorage.getItem('packlistData');
    
    if (packlistDataString) {
        const packlistData = JSON.parse(packlistDataString);
        populateWithOperationData(packlistData);
        sessionStorage.removeItem('packlistData');
    } else {
        document.getElementById('invoiceNumber').value = '2060';
        document.getElementById('invoiceDate').value = '2025-07-04';
        document.getElementById('importerInfo').value = 'Loia Foods Import Export & Export LLC\n27 Malvern st. Newark, NJ 07105\nNewark, NJ , 07105 USA - Phone: 1 973 350 6197\nEmail: operations@loiafood.com';
        
        document.getElementById('container').value = '';
        document.getElementById('booking').value = '255641399';
        document.getElementById('paymentTerm').value = 'Due on receipt - US DOLLAR';
        document.getElementById('portOfDeparture').value = 'SANTOS. SP.';
        document.getElementById('destinationPort').value = 'NY / NJ';
        document.getElementById('incoterm').value = 'FOB';
        
        document.getElementById('countryOrigin').value = 'Brazil';
        document.getElementById('countryDestination').value = 'USA';
        document.getElementById('ptaxInfo').value = 'CONTRATO DE CAMBIO ACC BANCO BRADESCO,\nDESAGIO:10.10%aa,NUMERO DO CONTRATO:
498476052';
        document.getElementById('declarationText').value = 'I declare all the information contained in this packing list to be true and correct';

        addSupplierGroup();
        const group1 = document.querySelector('#supplier-list .supplier-group:nth-child(1)');
        group1.querySelector('[name=supplier_info]').value = 'FDA#17405485860-RIVELLI E BEZERRA INDUSTRIA E COMERCIO DE ALIMENTOS LTDA';
        
        const addButton1 = group1.querySelector('button[onclick="addItem(this)"]');
        addItem(addButton1);
        let p1 = group1.querySelector('.item:nth-child(1)');
        p1.querySelector('[name=qty]').value = 2095;
        p1.querySelector('[name=ncm]').value = '20052000';
        p1.querySelector('[name=desc]').value = 'Loia-Potato Chips (PALHA) 10X800Gr';
        p1.querySelector('[name=qty_unit]').value = '10X800G';
        p1.querySelector('[name=qty_kg]').value = 21052.00;
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

window.onload = initialize;
