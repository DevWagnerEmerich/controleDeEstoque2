-- Arquivo: update_user_schema.sql
-- Objetivo: Atualizar o esquema de usuários para suportar aprovação de contas.

-- Passo 1: Adicionar a coluna 'status' à tabela de perfis.
-- Esta coluna controlará se a conta de um usuário está 'pending', 'approved', ou 'rejected'.
-- O valor padrão para novos registros será 'pending', mas a função de trigger abaixo irá garantir isso explicitamente.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status TEXT;

-- Passo 2: Atualizar a função 'handle_new_user' que é acionada na criação de um novo usuário.
-- A função agora definirá explicitamente o status como 'pending' para novos usuários.
-- A role continua 'user' por padrão, como antes.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insere o novo usuário com role 'user' e status 'pending'.
  INSERT INTO public.profiles (id, role, status)
  VALUES (new.id, 'user', 'pending');
  RETURN new;
END;
$$;

-- Passo 3: Atualizar perfis existentes para o status 'approved'.
-- IMPORTANTE: Execute isso para garantir que os usuários que você já tinha antes
-- desta mudança possam continuar a fazer login.
UPDATE public.profiles
SET status = 'approved'
WHERE status IS NULL;

-- Passo 4: Atualizar as políticas de segurança (RLS) para a tabela 'profiles'.
-- Isso permite que administradores ('admin') vejam e modifiquem todos os perfis,
-- o que é necessário para aprovar ou gerenciar usuários.

-- Remove a política antiga se ela existir com um nome diferente
DROP POLICY IF EXISTS "Enable access to all for admins" ON public.profiles;

-- Permite que administradores gerenciem todos os perfis (SELECT, UPDATE, etc.)
CREATE POLICY "Enable full access for admins" ON public.profiles
  FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- Garante que a política para usuários visualizarem seus próprios perfis ainda exista.
-- A recriamos para garantir a ordem e evitar conflitos.
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Mensagem para o desenvolvedor:
-- Após executar este script no SQL Editor do Supabase, a estrutura do seu banco
-- de dados estará pronta para o fluxo de aprovação de usuários. O próximo passo
-- é ajustar o código da aplicação para impedir o login de usuários com status 'pending'
-- e construir a interface de gerenciamento para os administradores.
