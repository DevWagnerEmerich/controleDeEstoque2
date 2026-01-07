-- SCRIPT DE LIMPEZA DE DADOS DE TESTE
-- ATENÇÃO: ISTO APAGARÁ TODOS OS DADOS DAS TABELAS ABAIXO!
-- Este script não apaga os usuários (tabela profiles), apenas os dados operacionais.

-- Truncate limpa a tabela e reinicia os IDs (se RESTART IDENTITY for usado).
-- CASCADE garante que dados dependentes também sejam apagados (ex: movimentos de um item).

TRUNCATE TABLE 
  public.movements,
  public.operations,
  public.purchase_orders,
  public.items, 
  public.suppliers 
RESTART IDENTITY CASCADE;

-- Se houver outras tabelas auxiliares que criei e esqueci, adicione aqui.
-- Mas estas são as principais identificadas no código.
