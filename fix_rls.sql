-- SOLUÇÃO PARA O ERRO "STACK DEPTH LIMIT EXCEEDED"
-- Este script cria uma função segura para verificar se é admin sem causar loop infinito

-- 1. Cria a função is_admin com SECURITY DEFINER (Burlam as regras de RLS para checagem)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica se existe um perfil com este ID e role = 'admin'
  -- Como é SECURITY DEFINER, esta consulta não aciona as políticas de RLS novamente
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Remove as políticas antigas que podem estar causando o loop (se existirem com estes nomes comuns)
-- Se a sua política tiver outro nome, você terá que removê-la manualmente no painel
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users who own them or admins" ON public.profiles;

-- 3. Cria novas políticas seguras usando a função is_admin()

-- LEITURA (SELECT): Dono do perfil OU Admin pode ver
CREATE POLICY "Profiles are viewable by owner or admin" 
ON public.profiles FOR SELECT 
USING (
  auth.uid() = id OR is_admin()
);

-- INSERÇÃO (INSERT): Apenas o próprio usuário (via trigger) ou Admin
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (
  auth.uid() = id OR is_admin()
);

-- ATUALIZAÇÃO (UPDATE): Dono ou Admin
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (
  auth.uid() = id OR is_admin()
);
