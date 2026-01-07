// js/session.js
import { supabaseClient } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        // Se não houver sessão, o usuário não está logado.
        // Redireciona para a página de login.
        console.warn('Nenhuma sessão de usuário encontrada. Redirecionando para a página de login.');
        window.location.replace('/index.html'); // Use replace para não adicionar ao histórico de navegação
    } else {
        // O usuário está logado, a página pode continuar a carregar.
        console.log('Sessão de usuário verificada com sucesso.');
    }
});
