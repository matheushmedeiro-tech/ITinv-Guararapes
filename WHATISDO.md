# ITINV - Apresentação do Sistema

## 1. O que é o ITINV

O ITINV é o sistema de controle de inventário de TI da empresa.
Ele foi criado para organizar equipamentos, acompanhar status técnico e controlar empréstimos entre setores.

## 2. Para que serve

O sistema centraliza, em um único painel:

- Cadastro de equipamentos de TI
- Classificação por tipo e origem
- Registro de status (OK ou com problema)
- Detalhamento de problema técnico
- Controle de empréstimo por setor
- Histórico visual da situação atual dos ativos

## 3. Quem usa

Público principal:

- Time de TI
- Liderança técnica
- Áreas de apoio que solicitam equipamentos

## 4. Benefícios para a operação

- Menos planilhas paralelas
- Padronização do cadastro
- Visão rápida do parque de equipamentos
- Controle claro de quem está com equipamento emprestado
- Priorização de itens com problema

## 5. Fluxo de uso no dia a dia

### 5.1 Login

1. Acesse a tela de login.
2. Informe e-mail e senha de acesso administrativo.
3. Clique em Entrar.

### 5.2 Cadastro de equipamento

1. Clique em Novo equipamento.
2. Preencha nome, tipo e origem.
3. Marque se está formatado e configurado.
4. Defina status:
- OK: equipamento pronto para uso.
- Problem: equipamento com falha.
5. Salve o cadastro.

### 5.3 Registro de problema

Quando o status for Problem:

1. Selecione o tipo de problema.
2. Descreva o problema encontrado.
3. Salve para manter rastreabilidade técnica.

### 5.4 Controle de empréstimo

Quando o item estiver emprestado:

1. Marque Emprestado.
2. Selecione o Destino/Setor (mesma base de setores da Origem).
3. A data do empréstimo é preenchida automaticamente com a data atual (pode ser alterada, se necessário).
4. Salve.

### 5.5 Atualizações no ciclo de vida

- Editar: ajusta dados do equipamento.
- Resolver: muda item com problema para OK.
- Reabrir: volta item para Problem quando necessário.
- Remover: exclui cadastro.

## 6. Leitura rápida do painel

Indicadores principais:

- Total de equipamentos
- Quantidade com problemas
- Quantidade prontos

Filtros disponíveis:

- Nome
- Tipo
- Origem
- Tipo de problema

## 7. Padrão de dados recomendado

Para manter qualidade das informações:

- Usar nomes claros de equipamento (ex.: Notebook Dell 5420 - Fiscal)
- Evitar abreviações diferentes para o mesmo setor
- Preencher descrição de problema com objetividade
- Atualizar status assim que houver intervenção técnica

## 8. Regras importantes

- Equipamento com problema deve ficar em status Problem até validação técnica.
- Equipamento emprestado deve ter Destino/Setor registrado.
- Dados do painel representam a operação atual, então atualização contínua é essencial.

## 9. Boas práticas para a equipe

- Revisar itens com Problem diariamente
- Revisar itens emprestados semanalmente
- Padronizar criação de novos tipos e origens
- Evitar exclusões sem alinhamento (preferir editar quando possível)

## 10. Mensagem para apresentação ao Tech Lead

O ITINV reduz risco operacional ao consolidar inventário, problemas técnicos e empréstimos em um único fluxo.
Com isso, a equipe ganha rastreabilidade, previsibilidade e padronização na gestão de ativos de TI.

## 11. Canais e próximos passos

Sugestão de evolução do uso interno:

- Definir responsável por atualização diária
- Criar rotina de revisão semanal com indicadores
- Expandir campos conforme necessidade da operação (patrimônio, serial, SLA, fornecedor)
