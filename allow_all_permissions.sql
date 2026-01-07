-- LIBERAR GERAL: Todas as ações permitidas para qualquer usuário ATIVO
-- Substitui as políticas anteriores que checavam permissões específicas.

-- === TABELA ITEMS ===
DROP POLICY IF EXISTS "Public items are viewable by everyone" ON public.items;
DROP POLICY IF EXISTS "Items viewable by active users" ON public.items;
DROP POLICY IF EXISTS "Items insertable by permission" ON public.items;
DROP POLICY IF EXISTS "Items updatable by permission" ON public.items;
DROP POLICY IF EXISTS "Items deletable by permission" ON public.items;

CREATE POLICY "Items viewable by active users" ON public.items FOR SELECT USING ( is_active_user() );
CREATE POLICY "Items insertable by active users" ON public.items FOR INSERT WITH CHECK ( is_active_user() );
CREATE POLICY "Items updatable by active users" ON public.items FOR UPDATE USING ( is_active_user() );
CREATE POLICY "Items deletable by active users" ON public.items FOR DELETE USING ( is_active_user() );

-- === TABELA SUPPLIERS ===
DROP POLICY IF EXISTS "Public suppliers are viewable by everyone" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers viewable by active users" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers manage by permission" ON public.suppliers;

CREATE POLICY "Suppliers viewable by active users" ON public.suppliers FOR SELECT USING ( is_active_user() );
CREATE POLICY "Suppliers manage by active users" ON public.suppliers FOR ALL USING ( is_active_user() );

-- === TABELA OPERATIONS ===
DROP POLICY IF EXISTS "Public operations are viewable by everyone" ON public.operations;
DROP POLICY IF EXISTS "Operations viewable by active users" ON public.operations;
DROP POLICY IF EXISTS "Operations insertable by permission" ON public.operations;
DROP POLICY IF EXISTS "Operations deletable by permission" ON public.operations;

CREATE POLICY "Operations viewable by active users" ON public.operations FOR SELECT USING ( is_active_user() );
CREATE POLICY "Operations insertable by active users" ON public.operations FOR INSERT WITH CHECK ( is_active_user() );
CREATE POLICY "Operations deletable by active users" ON public.operations FOR DELETE USING ( is_active_user() );

-- === TABELA MOVEMENTS ===
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'movements') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Public movements are viewable by everyone" ON public.movements';
        EXECUTE 'DROP POLICY IF EXISTS "Movements viewable by active users" ON public.movements';
        EXECUTE 'DROP POLICY IF EXISTS "Movements insertable by active users" ON public.movements';
        EXECUTE 'DROP POLICY IF EXISTS "Movements deletable by admin" ON public.movements';
        
        EXECUTE 'CREATE POLICY "Movements viewable by active users" ON public.movements FOR SELECT USING ( is_active_user() )';
        EXECUTE 'CREATE POLICY "Movements insertable by active users" ON public.movements FOR INSERT WITH CHECK ( is_active_user() )'; 
        EXECUTE 'CREATE POLICY "Movements deletable by active users" ON public.movements FOR DELETE USING ( is_active_user() )';
    END IF;
END
$$;

-- === TABELA PROFILES (Usuários) ===
-- Mantemos um pouco de segurança aqui: Apenas Admin pode ver/editar OUTROS usuários e DELETAR.
-- Mas permitimos que qualquer um leia todos para listar no menu se quiser (opcional, mantendo padrão seguro por enquanto).
-- Se quiser liberar TUDO mesmo (perigoso pois permite um user deletar outro), avise. 
-- Vou manter: Leitura (Todos ativos podem ver lista de users?), Edição (Só Admin), Delete (Só Admin).
-- O pedido foi sobre "funções" do app (estoque), não necessariamente gestão de usuários.
-- Vou liberar LEITURA da lista de usuários para todos.
DROP POLICY IF EXISTS "Profiles viewable by owner or admin" ON public.profiles;
CREATE POLICY "Profiles viewable by all active users" ON public.profiles FOR SELECT USING ( is_active_user() );

-- Permitir INSERT e UPDATE apenas para o próprio (auto-gestão) ou Admin (gestão).
-- (Mantém lógica anterior que já era permissiva o suficiente para o user operar)
