-- Arquivo: create_get_users_rpc.sql
-- Objetivo: Criar a função RPC 'get_all_users' que permite a um administrador buscar todos os usuários.

-- Remove a função antiga se ela existir
DROP FUNCTION IF EXISTS public.get_all_users();

-- Cria a nova função
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE(
    id uuid,
    email text,
    role text,
    status text,
    created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com os privilégios do criador da função (geralmente, o administrador)
SET search_path = public, auth
AS $$
BEGIN
    -- Verifica se o usuário que está chamando a função é um administrador
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'admin' THEN
        RAISE EXCEPTION 'Acesso negado: Apenas administradores podem listar usuários.';
    END IF;

    -- Se for admin, retorna a lista de usuários
    RETURN QUERY
    SELECT
        u.id,
        u.email,
        p.role,
        p.status,
        u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    ORDER BY u.created_at DESC;
END;
$$;

-- Mensagem para o desenvolvedor:
-- Após executar este script no SQL Editor do Supabase, você terá uma função 'get_all_users'
-- que pode ser chamada do seu código do frontend (usando supabase.rpc('get_all_users'))
-- para buscar a lista de todos os usuários, desde que o usuário logado seja um admin.
