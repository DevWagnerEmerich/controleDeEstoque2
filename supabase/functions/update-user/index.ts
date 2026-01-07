// v1.1 - Forçando o deploy para limpar o cache do esquema do banco de dados
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Esta função atualiza o cargo, status e permissões de um usuário.
// Apenas administradores podem chamar esta função.

serve(async (req) => {
  // Trata a requisição preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Extrai os dados, incluindo o novo campo 'is_active' (ou 'status' legado) e 'password'
    const { userId, role, status, is_active, permissions, password } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables: SUPABASE_URL or SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing secrets.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Cria um cliente Supabase com privilégios de administrador
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // --- VERIFICAÇÃO DE SEGURANÇA ---
    // Garante que quem está chamando a função é um administrador
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization header missing');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: adminUser } } = await supabaseAdmin.auth.getUser(token);
    if (!adminUser) throw new Error('Invalid token');

    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single();

    if (adminProfile?.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can update users.');
    }
    // --- FIM DA VERIFICAÇÃO ---

    // --- VALIDAÇÃO DE INPUT ---
    if (password !== undefined && password !== null && password.trim() !== '') {
      if (String(password).length < 6) {
        return new Response(JSON.stringify({ error: 'Password must be at least 6 characters long.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }
    // --- FIM VALIDAÇÃO ---

    // Constrói o objeto de atualização dinamicamente
    const updateData: any = {};
    if (role) updateData.role = role;
    if (permissions) updateData.permissions = permissions;
    if (status) updateData.status = status;
    if (typeof is_active !== 'undefined') updateData.is_active = is_active;

    // Atualiza o perfil do usuário alvo na tabela 'profiles'
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData) // Usa o objeto dinâmico
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw new Error('Failed to update user profile.');
    }

    // Atualiza também os metadados na tabela auth.users para consistência
    // E ATUALIZA A SENHA SE FORNECIDA
    const authUpdatePayload: any = {
      user_metadata: { role, permissions, status, is_active }
    };

    if (password && password.trim() !== '') {
      authUpdatePayload.password = password;
    }

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      authUpdatePayload
    );

    if (authUpdateError) {
      console.error('Error updating auth user:', authUpdateError);
      throw new Error('Failed to update user authentication details.');
    }

    // Retorna o perfil atualizado
    return new Response(JSON.stringify(updatedProfile), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Unexpected error in update-user:', error);
    // Retorna um erro genérico em caso de falha, a menos que seja um erro conhecido que jogamos
    const errorMessage = error.message === 'Authorization header missing' || error.message === 'Invalid token' || error.message.startsWith('Permission denied')
      ? error.message
      : 'Internal Server Error';

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
