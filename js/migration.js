import { items, operationsHistory, suppliers, updateOperation } from './database.js';
import { showNotification, normalizeCnpj, fullUpdate } from './ui.js';

export async function migrateOperationsToUUIDs() {
    console.log("Iniciando migração de operações para UUIDs...");
    let totalUpdatedOps = 0;
    let totalLinkedItems = 0;
    const updates = [];

    // Iterar sobre todas as operações no histórico
    for (const op of operationsHistory) {
        let opModified = false;

        // Verificar se é uma operação com itens (importação ou manual)
        if (!op.items || !Array.isArray(op.items)) continue;

        // Se for uma operação de importação, ela pode ter estrutura nfeData
        // Mas a 'invoice' usa op.items ou op.nfeData. Vamos focar em op.items se existir, 
        // ou reconstruir se necessário. Mas geralmente op.items é o que importa para manual.
        // Para importação XML, os dados estruturados ficam em nfeData, mas op.items deve conter a lista plana.

        // Estratégia: Atualizar op.items e op.nfeData se existir.

        // 1. Atualizar op.items (Lista plana)
        op.items.forEach(opItem => {
            if (opItem.item_id) return; // Já tem UUID, pula

            // Tenta encontrar no estoque
            let stockItem = null;

            // Se o item da operação já tem supplier_id (manual ou já processado)
            if (opItem.supplier_id || opItem.supplierId) {
                const sId = opItem.supplier_id || opItem.supplierId;
                stockItem = items.find(i => i.code === opItem.code && i.supplier_id === sId);
            }
            // Se não tem supplier_id direto, tenta inferir (complicado sem nfeData)
            else if (op.type === 'manual') {
                // Em operações manuais antigas, talvez não tenhamos o supplier_id fácil se não foi salvo.
                // Mas geralmente item manual tem supplier_id salvo do objeto item original.
            }

            // Se achou, vincula
            if (stockItem) {
                opItem.item_id = stockItem.id;
                opModified = true;
                totalLinkedItems++;
            }
        });

        // 2. Atualizar op.nfeData (Estrutura hierárquica de XMLs importados)
        if (op.nfeData && Array.isArray(op.nfeData)) {
            op.nfeData.forEach(nfe => {
                const cnpj = nfe.fornecedor?.cnpj ? normalizeCnpj(nfe.fornecedor.cnpj) : null;
                const supplier = suppliers.find(s => normalizeCnpj(s.cnpj) === cnpj);

                if (supplier && nfe.produtos) {
                    nfe.produtos.forEach(prod => {
                        if (prod.item_id) return; // Já tem

                        const stockItem = items.find(i => i.code === prod.code && i.supplier_id === supplier.id);

                        if (stockItem) {
                            prod.item_id = stockItem.id;
                            opModified = true;
                            totalLinkedItems++;
                        }
                    });
                }
            });
        }

        // 3. Atualizar op.suppliers (Usado pela UI da Invoice)
        // Precisamos propagar os IDs encontrados em op.nfeData ou op.items para op.suppliers
        if (op.suppliers && Array.isArray(op.suppliers)) {
            op.suppliers.forEach(supp => {
                supp.items.forEach(suppItem => {
                    if (suppItem.item_id) return; // Já linkado

                    // Tentativa 1: Buscar correspondência em op.nfeData (pelo nome/desc)
                    if (op.nfeData) {
                        for (const nfe of op.nfeData) {
                            if (!nfe.produtos) continue;
                            // Match exato de nome. É seguro pois suppItem vem de nfe.produtos originalmente
                            const docMatch = nfe.produtos.find(p => p.name === suppItem.desc && p.item_id);
                            if (docMatch) {
                                suppItem.item_id = docMatch.item_id;
                                opModified = true;
                                totalLinkedItems++;
                                return;
                            }
                        }
                    }

                    // Tentativa 2: Tentar match direto pelo código (se existir) ou fallback
                    // Como op.suppliers muitas vezes não tinha 'code' salvo, isso é difícil.
                    // Mas agora salvamos. Se for antigo, não tem code.

                    // Se tiver code:
                    if (suppItem.code) {
                        const sId = supp.id; // Precisa do ID do fornecedor exato na invoice
                        // As vezes supp.id não está populado em dados antigos, cuidado.
                        // Mas vamos tentar.
                        if (sId) {
                            const stockItem = items.find(i => i.code === suppItem.code && i.supplier_id === sId);
                            if (stockItem) {
                                suppItem.item_id = stockItem.id;
                                opModified = true;
                                totalLinkedItems++;
                            }
                        }
                    }
                });
            });
        }

        if (opModified) {
            updates.push(updateOperation(op.id, op));
            totalUpdatedOps++;
        }
    }

    if (updates.length > 0) {
        showNotification(`Migrando ${totalUpdatedOps} operações e ${totalLinkedItems} itens...`, 'info');
        try {
            await Promise.all(updates);
            showNotification(`Migração concluída! ${totalUpdatedOps} operações atualizadas.`, 'success');
            console.log(`Sucesso: ${totalUpdatedOps} operações atualizadas com ${totalLinkedItems} itens vinculados.`);
            fullUpdate();
        } catch (error) {
            console.error("Erro na migração:", error);
            showNotification(`Erro parcial na migração: ${error.message}`, 'danger');
        }
    } else {
        showNotification("Nenhuma operação precisou de atualização. Tudo certo!", 'success');
    }
}
