// js/backup.js
import { supabaseClient } from './auth.js';
import { showNotification } from './ui.js';

/**
 * Lida com a exportação de dados do banco de dados chamando a API de backend.
 */
export async function handleExportData() {
    console.log("Iniciando processo de exportação de dados...");
    showNotification('Iniciando exportação de dados... Isso pode levar um momento.', 'info');

    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('hidden');

    try {
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError || !session) {
            throw new Error('Sessão não encontrada. Faça login novamente.');
        }

        const response = await fetch('/api/export', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
            },
        });

        if (!response.ok) {
            // Tenta ler a mensagem de erro do corpo da resposta
            const errorData = await response.json();
            throw new Error(errorData.detail || `Falha na exportação: ${response.statusText}`);
        }

        // Pega o nome do arquivo do header 'Content-Disposition'
        const disposition = response.headers.get('Content-Disposition');
        let filename = 'backup.json'; // fallback
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        const blob = await response.blob();
        
        // Cria um link temporário para iniciar o download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        
        // Limpa o link temporário
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showNotification('Exportação concluída com sucesso!', 'success');

    } catch (error) {
        console.error('Erro durante a exportação de dados:', error);
        showNotification(`Erro: ${error.message}`, 'danger');
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}
