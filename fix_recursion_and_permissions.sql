-- FUNÇÕES SEGURAS (SECURITY DEFINER) PARA ACESSO A PERFIS
-- Estas funções evitam o "stack depth limit exceeded" (loop infinito)
-- pois executam com privilégios de sistema, sem acionar as policies da tabela profiles novamente.

-- 1. Verifica se o usuário está ativo (para login/leitura básica)
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
DECLARE
  active_status BOOLEAN;
BEGIN
  SELECT is_active INTO active_status
  FROM public.profiles 
  WHERE id = auth.uid();
  
  RETURN active_status IS TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Verifica se o usuário é admin (para acesso total)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles 
  WHERE id = auth.uid();
  
  RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Verifica permissão específica (granular) OU se é admin
CREATE OR REPLACE FUNCTION public.check_user_permission(perm_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_perms JSONB;
BEGIN
  SELECT role, permissions INTO user_role, user_perms
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Admin tem permissão para tudo
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Verifica se a permissão específica está true no JSONB
  IF user_perms IS NOT NULL AND (user_perms->perm_key)::boolean IS TRUE THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ATUALIZANDO AS POLÍTICAS (POLICIES) DAS TABELAS
-- Removemos as antigas e aplicamos as novas usando as funções seguras acima.

-- === TABELA ITEMS ===
DROP POLICY IF EXISTS "Public items are viewable by everyone" ON public.items;
DROP POLICY IF EXISTS "Items viewable by active users" ON public.items;
DROP POLICY IF EXISTS "Items insertable by permission" ON public.items;
DROP POLICY IF EXISTS "Items updatable by permission" ON public.items;
DROP POLICY IF EXISTS "Items deletable by permission" ON public.items;

CREATE POLICY "Items viewable by active users"
ON public.items FOR SELECT
USING ( is_active_user() );

CREATE POLICY "Items insertable by permission"
ON public.items FOR INSERT
WITH CHECK ( check_user_permission('add') );

CREATE POLICY "Items updatable by permission"
ON public.items FOR UPDATE
USING ( check_user_permission('edit') );

CREATE POLICY "Items deletable by permission"
ON public.items FOR DELETE
USING ( check_user_permission('delete') );


-- === TABELA SUPPLIERS ===
DROP POLICY IF EXISTS "Public suppliers are viewable by everyone" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers viewable by active users" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers manage by permission" ON public.suppliers;

CREATE POLICY "Suppliers viewable by active users"
ON public.suppliers FOR SELECT
USING ( is_active_user() );

CREATE POLICY "Suppliers manage by permission"
ON public.suppliers FOR ALL
USING ( check_user_permission('add') OR check_user_permission('edit') ); -- Simplificado, ou crie granular se quiser


-- === TABELA OPERATIONS ===
DROP POLICY IF EXISTS "Public operations are viewable by everyone" ON public.operations;
DROP POLICY IF EXISTS "Operations viewable by active users" ON public.operations;
DROP POLICY IF EXISTS "Operations insertable by permission" ON public.operations;
DROP POLICY IF EXISTS "Operations deletable by permission" ON public.operations;

CREATE POLICY "Operations viewable by active users"
ON public.operations FOR SELECT
USING ( is_active_user() );

CREATE POLICY "Operations insertable by permission"
ON public.operations FOR INSERT
WITH CHECK ( check_user_permission('operation') );

CREATE POLICY "Operations deletable by permission"
ON public.operations FOR DELETE
USING ( check_user_permission('delete') ); -- Ou permissão específica se houver


-- === TABELA MOVEMENTS ===
-- Verifica se a tabela movements existe antes de aplicar
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'movements') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Public movements are viewable by everyone" ON public.movements';
        EXECUTE 'DROP POLICY IF EXISTS "Movements viewable by active users" ON public.movements';
        EXECUTE 'DROP POLICY IF EXISTS "Movements insertable by active users" ON public.movements';
        EXECUTE 'DROP POLICY IF EXISTS "Movements deletable by admin" ON public.movements';
        
        EXECUTE 'CREATE POLICY "Movements viewable by active users" ON public.movements FOR SELECT USING ( is_active_user() )';
        
        -- Movements geralmente são criados junto com operações ou manual
        EXECUTE 'CREATE POLICY "Movements insertable by active users" ON public.movements FOR INSERT WITH CHECK ( is_active_user() )'; 
        
        EXECUTE 'CREATE POLICY "Movements deletable by admin" ON public.movements FOR DELETE USING ( is_admin() )';
    END IF;
END
$$;

-- === TABELA PROFILES ===
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users who own them or admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by owner or admin" ON public.profiles;

-- LEITURA: Dono ou Admin
CREATE POLICY "Profiles viewable by owner or admin" 
ON public.profiles FOR SELECT 
USING (
  auth.uid() = id OR is_admin()
);

-- INSERÇÃO: Auto-inscrição (trigger) ou Admin
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (
  auth.uid() = id OR is_admin()
);

-- ATUALIZAÇÃO: Dono ou Admin
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (
  auth.uid() = id OR is_admin()
);

-- DELEÇÃO: Apenas Admin
CREATE POLICY "Profiles deletable by admin"
ON public.profiles FOR DELETE
USING ( is_admin() );

