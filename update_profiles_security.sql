-- Adiciona a coluna 'is_active' na tabela profiles, se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

-- Garante que o usuário admin inicial (você) esteja ativo
-- Substitua 'seu-email@exemplo.com' pelo seu email de admin, se necessário, 
-- ou rode um UPDATE manualmente após criar a coluna.
-- UPDATE public.profiles SET is_active = TRUE WHERE role = 'admin';

-- Atualiza a função que cria o perfil automaticamente para definir is_active como FALSE por padrão
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, is_active)
  VALUES (new.id, new.email, 'user', FALSE); -- Padrão agora é FALSE
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário: Execute este script no SQL Editor do Supabase para aplicar as mudanças de segurança.
