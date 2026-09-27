-- SISTEMA TRIAGEM MUSICAL - ETAPA 3
-- Execute este SQL no Supabase > SQL Editor.

ALTER TABLE public.triagem_irmaos
  ADD COLUMN IF NOT EXISTS grupo text,
  ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS triagem_irmaos_grupo_nome_uidx
  ON public.triagem_irmaos (grupo, nome);

ALTER TABLE public.quantitativo_geral
  ADD COLUMN IF NOT EXISTS chave text,
  ADD COLUMN IF NOT EXISTS valor_texto text,
  ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS quantitativo_geral_chave_uidx
  ON public.quantitativo_geral (chave)
  WHERE chave IS NOT NULL;

-- Função para confirmar que o usuário autenticado está ativo.
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_user_id = auth.uid()
      AND ativo = true
  );
$$;

-- Permissões para usuários autenticados trabalharem no sistema.
DROP POLICY IF EXISTS "usuarios ativos podem ver triagem" ON public.triagem_irmaos;
DROP POLICY IF EXISTS "usuarios ativos podem inserir triagem" ON public.triagem_irmaos;
DROP POLICY IF EXISTS "usuarios ativos podem alterar triagem" ON public.triagem_irmaos;
DROP POLICY IF EXISTS "usuarios ativos podem excluir triagem" ON public.triagem_irmaos;

CREATE POLICY "usuarios ativos podem ver triagem"
ON public.triagem_irmaos FOR SELECT TO authenticated
USING (public.is_active_user());

CREATE POLICY "usuarios ativos podem inserir triagem"
ON public.triagem_irmaos FOR INSERT TO authenticated
WITH CHECK (public.is_active_user());

CREATE POLICY "usuarios ativos podem alterar triagem"
ON public.triagem_irmaos FOR UPDATE TO authenticated
USING (public.is_active_user()) WITH CHECK (public.is_active_user());

CREATE POLICY "usuarios ativos podem excluir triagem"
ON public.triagem_irmaos FOR DELETE TO authenticated
USING (public.is_active_user());

DROP POLICY IF EXISTS "usuarios ativos podem ver quantitativo" ON public.quantitativo_geral;
DROP POLICY IF EXISTS "usuarios ativos podem inserir quantitativo" ON public.quantitativo_geral;
DROP POLICY IF EXISTS "usuarios ativos podem alterar quantitativo" ON public.quantitativo_geral;
DROP POLICY IF EXISTS "usuarios ativos podem excluir quantitativo" ON public.quantitativo_geral;

CREATE POLICY "usuarios ativos podem ver quantitativo"
ON public.quantitativo_geral FOR SELECT TO authenticated
USING (public.is_active_user());

CREATE POLICY "usuarios ativos podem inserir quantitativo"
ON public.quantitativo_geral FOR INSERT TO authenticated
WITH CHECK (public.is_active_user());

CREATE POLICY "usuarios ativos podem alterar quantitativo"
ON public.quantitativo_geral FOR UPDATE TO authenticated
USING (public.is_active_user()) WITH CHECK (public.is_active_user());

CREATE POLICY "usuarios ativos podem excluir quantitativo"
ON public.quantitativo_geral FOR DELETE TO authenticated
USING (public.is_active_user());

DROP POLICY IF EXISTS "usuarios ativos podem ver folder" ON public.folder;
DROP POLICY IF EXISTS "usuarios ativos podem inserir folder" ON public.folder;
DROP POLICY IF EXISTS "usuarios ativos podem alterar folder" ON public.folder;
DROP POLICY IF EXISTS "usuarios ativos podem excluir folder" ON public.folder;

CREATE POLICY "usuarios ativos podem ver folder"
ON public.folder FOR SELECT TO authenticated
USING (public.is_active_user());

CREATE POLICY "usuarios ativos podem inserir folder"
ON public.folder FOR INSERT TO authenticated
WITH CHECK (public.is_active_user());

CREATE POLICY "usuarios ativos podem alterar folder"
ON public.folder FOR UPDATE TO authenticated
USING (public.is_active_user()) WITH CHECK (public.is_active_user());

CREATE POLICY "usuarios ativos podem excluir folder"
ON public.folder FOR DELETE TO authenticated
USING (public.is_active_user());

-- Catálogo inicial baseado na planilha original.
INSERT INTO public.triagem_irmaos (grupo, ordem, nome, quantidade)
VALUES
('ministerio',1,'ANCIÕES',0),
('ministerio',2,'DIÁCONOS',0),
('ministerio',3,'COOPERADORES',0),
('ministerio',4,'COOP. JOVENS E MENORES',0),
('ministerio',5,'ENC. REGIONAIS',0),
('ministerio',6,'ENC. LOCAIS',0),
('ministerio',7,'INSTRUTORES',0),
('ministerio',8,'CANDIDATOS',0),
('ministerio',9,'IRMÃOS',0),
('ministerio',10,'EXAMINADORAS',0),
('ministerio',11,'INSTRUTORAS',0),
('ministerio',12,'ORGANISTAS',0),
('ministerio',13,'ORGANISTAS DE RJM',0),
('ministerio',14,'CANDIDATAS',0),
('ministerio',15,'IRMÃS',0),
('musicos',1,'VIOLINO',0),
('musicos',2,'VIOLAS',0),
('musicos',3,'VIOLONCELOS',0),
('musicos',4,'FLAUTAS',0),
('musicos',5,'CLARINETES',0),
('musicos',6,'CLARONES',0),
('musicos',7,'OBOÉ/CORNE INGLÊS',0),
('musicos',8,'FAGOTES',0),
('musicos',9,'SAX SOPRANINO',0),
('musicos',10,'SAX SOPRANO',0),
('musicos',11,'SAX ALTO',0),
('musicos',12,'SAX TENOR',0),
('musicos',13,'SAX BARÍTONO',0),
('musicos',14,'TROMPETES',0),
('musicos',15,'POCKET',0),
('musicos',16,'FLUGELHORN',0),
('musicos',17,'TROMPA',0),
('musicos',18,'TROMBONES',0),
('musicos',19,'TROMBONITOS',0),
('musicos',20,'BOMBARDINO',0),
('musicos',21,'TUBAS',0),
('musicos',22,'HARMÔNICAS',0),
('localidades',1,'BANZAE',0),
('localidades',2,'IRMAS',0),
('localidades',3,'CAMANDAROBA',0),
('localidades',4,'ORGANISTA',0),
('localidades',5,'CANDIDATA',0),
('localidades',6,'CÍCERO DANTAS - CAMPINAS DE CASTRO',0),
('localidades',7,'CÍCERO DANTAS',0),
('localidades',8,'INTIUBA',0),
('localidades',9,'CÍCERO DANTAS - POVOADO SÃO JOÃO DA FORTALEZA',0),
('localidades',10,'CÍCERO DANTAS - POVOADO VILA SÃO PEDRO',0),
('localidades',11,'FILADELFIA',0),
('localidades',12,'HELIÓPOLIS',0),
('localidades',13,'HELIÓPOLIS - POVOADO TIJUCO',0),
('localidades',14,'JAGUARARI',0),
('localidades',15,'PARIPIRANGA',0),
('localidades',16,'PARIPIRANGA - FEIRINHA DO APERTADO DE PEDRAS',0),
('localidades',17,'RIBEIRA DO AMPARO - POVOADO RASPADOR',0),
('localidades',18,'RIBEIRA DO POMBAL',0),
('localidades',19,'RIBEIRA DO POMBAL - FAZENDA CANAVIEIRA',0),
('localidades',20,'RIBEIRA DO POMBAL - POMBALZINHO',0),
('localidades',21,'RIBEIRA DO POMBAL - POVOADO BOCA DA MATA',0),
('localidades',22,'RIBEIRA DO POMBAL - POVOADO NOVA ESPERANÇA',0),
('localidades',23,'COLONIA SERGIPE',0),
('localidades',24,'NOVA SOURE',0),
('localidades',25,'SALVADOR',0),
('localidades',26,'JINDIAROBA',0),
('localidades',27,'MALHADA NOVA',0),
('localidades',28,'JORRO',0),
('localidades',29,'OLINDINA',0),
('localidades',30,'POÇO VERDE',0),
('localidades',31,'MINAS',0),
('localidades',32,'BELO HORIZONTE',0),
('localidades',33,'ITAPICURU',0),
('localidades',34,'TUCANO',0),
('localidades',35,'PAULO AFONSO',0),
('localidades',36,'ARACAJU',0),
('localidades',37,'CRISOPOLIS',0),
('localidades',38,'KM 42',0),
('localidades',39,'CALOMBI',0),
('localidades',40,'SANTA BRIGIDA',0),
('localidades',41,'SP',0),
('localidades',42,'TOBIAS BARRETO',0),
('localidades',43,'FEIRA DE SANTANA',0),
('localidades',44,'CATU',0),
('localidades',45,'EUCLIDES DA CUNHA',0),
('localidades',46,'INHABUPE',0),
('localidades',47,'SERRINHA',0)
ON CONFLICT (grupo, nome) DO NOTHING;

-- Campos do ensaio usados no Quantitativo Geral.
INSERT INTO public.quantitativo_geral (chave, descricao, valor_texto, ordem)
VALUES
('ensaio_titulo','Título do ensaio','ENSAIO GERAL',1),
('ensaio_data','Data/local do ensaio','',2),
('anciao','Ancião','',3),
('palavra','Palavra','',4),
('encarregados','Encarregados','',5),
('regencia','Regência','',6)
ON CONFLICT (chave) DO NOTHING;


-- HISTÓRICO DE ALTERAÇÕES
CREATE TABLE IF NOT EXISTS public.historico_alteracoes (
  id bigint generated by default as identity primary key,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usuario_nome text,
  modulo text NOT NULL,
  item text NOT NULL,
  valor_anterior text,
  valor_novo text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historico_alteracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario pode registrar proprio historico" ON public.historico_alteracoes;
CREATE POLICY "usuario pode registrar proprio historico"
ON public.historico_alteracoes
FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user()
  AND usuario_id = (
    SELECT id FROM public.usuarios
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  )
);

DROP POLICY IF EXISTS "admin pode consultar historico" ON public.historico_alteracoes;
CREATE POLICY "admin pode consultar historico"
ON public.historico_alteracoes
FOR SELECT TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS historico_alteracoes_criado_em_idx
ON public.historico_alteracoes (criado_em DESC);

CREATE INDEX IF NOT EXISTS historico_alteracoes_modulo_idx
ON public.historico_alteracoes (modulo);
