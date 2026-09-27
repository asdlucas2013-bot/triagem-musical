SISTEMA TRIAGEM MUSICAL - VERSÃO 4
Baseado na planilha original enviada pelo usuário.

Esta versão mantém o login/controle de usuários e usa:
- TRIAGEM_IRMÃOS: 15 itens de ministério, 22 instrumentos e 47 localidades.
- QUANTITATIVO GERAL: campos do ensaio, ministério, instrumentos, organistas e totais.
- FOLDER: resumo para conferência e impressão.

IMPORTANTE:
1. O banco já deve ter sido configurado conforme os passos anteriores.
2. Não execute novamente o supabase_setup.sql antigo se o banco já estiver funcionando.
3. Abra index.html desta pasta para testar.


V12: impressão da FOLDER otimizada para A4 horizontal, 3 colunas na mesma página, cabeçalho centralizado e tipografia compacta.


V23 - HISTÓRICO DE ALTERAÇÕES
1. No Supabase, abra SQL Editor.
2. Execute o bloco da tabela "historico_alteracoes" que está no arquivo supabase_setup.sql.
3. Publique/substitua os arquivos desta versão no seu local de hospedagem.
4. Entre como Administrador. A nova aba "Histórico" ficará disponível.
5. Alterações feitas em Triagem Irmãos, Quantitativo Geral e Usuários passam a ser registradas.
6. O histórico é somente consulta para administradores; usuários comuns não veem a aba.


RECUPERAÇÃO DE SENHA

A opção “Esqueci minha senha” funciona com o Supabase Auth. Para que o link do e-mail volte para o sistema publicado, configure no Supabase em Authentication > URL Configuration a Site URL e/ou Redirect URLs com o endereço público do sistema.

O formulário de recuperação foi mantido fora do formulário de login para evitar que o navegador exija a senha ao clicar em “Enviar link”.
