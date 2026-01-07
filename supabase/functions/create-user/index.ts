import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Esta função cria um usuário no Supabase Auth e define seu perfil na tabela 'profiles'.
// Apenas administradores podem chamar esta função.

serve(async (req) => {
  // Lida com requisições OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, role, permissions } = await req.json();

    // Crie um cliente Supabase com a chave de service_role
    // Isso permite que a função ignore as políticas de RLS e atue como um administrador.
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables: SUPABASE_URL or SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing secrets.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // --- VERIFICAÇÃO DE SEGURANÇA: APENAS ADMIN PODE CRIAR USUÁRIOS ---
    // Obtenha o token de autorização do cabeçalho da requisição
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userAuth, error: userAuthError } = await supabaseAdmin.auth.getUser(token);

    if (userAuthError || !userAuth.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Verifique o cargo do usuário logado
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userAuth.user.id)
      .single();

    if (profileError || userProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Permission denied: Only administrators can create users.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }
    // --- FIM DA VERIFICAÇÃO DE SEGURANÇA ---


    // --- VALIDAÇÃO DE INPUT ---
    if (!email || !String(email).includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email address.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!password || String(password).length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters long.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    // --- FIM VALIDAÇÃO ---

    // 1. Crie o usuário no sistema de autenticação do Supabase
    const { data: newUserAuth, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirma o e-mail automaticamente
      user_metadata: { role }, // Define o cargo nos metadados do usuário
    });

    if (createUserError) {
      console.error('Error creating auth user:', createUserError);
      return new Response(JSON.stringify({ error: 'Error creating user account. Please check the email and try again.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 2. Atualize o perfil do usuário na tabela 'profiles'
    // O trigger 'on_auth_user_created' já criou a linha. Apenas atualizamos o role e permissões.
    const updatePayload: any = { role, is_active: true };
    if (permissions) updatePayload.permissions = permissions;

    const { data: updatedProfile, error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload) // Admin users are active by default
      .eq('id', newUserAuth.user.id)
      .select()
      .single();

    if (updateProfileError) {
      console.error('Error updating profile:', updateProfileError);
      // Se a atualização do perfil falhar, tente deletar o usuário da autenticação para evitar inconsistência
      await supabaseAdmin.auth.admin.deleteUser(newUserAuth.user.id);
      return new Response(JSON.stringify({ error: 'Failed to configure user profile.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify(updatedProfile), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Unexpected error in create-user:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});