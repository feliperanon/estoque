Feature: Operacao de estoque offline-first
  Como time de operacao
  Quero executar os modulos com rastreabilidade
  Para reduzir erros, perdas e retrabalho

  Scenario: Registrar contagem com sucesso
    Given que o operador esta autenticado
    And existe uma contagem aberta para o local "DEPOSITO_A"
    When o operador escaneia o produto "7890000000011" e informa quantidade "12"
    Then o sistema salva o item na contagem
    And gera log de auditoria com usuario, data e hora

  Scenario: Gerar recontagem para divergencia
    Given que existe divergencia acima da tolerancia configurada
    When a contagem e fechada
    Then o sistema cria automaticamente uma tarefa de recontagem
    And marca o item como pendente de validacao

  Scenario: Bloquear puxada sem saldo na origem
    Given que o local "DEPOSITO_A" possui saldo "2" para o produto "P-100"
    When o operador tenta puxar quantidade "5" para "AREA_VENDA"
    Then o sistema bloqueia a operacao
    And exibe mensagem "Saldo insuficiente na origem"

  Scenario: Enviar devolucao impropria para quarentena
    Given que o operador registra devolucao de cliente
    And informa condicao "improprio para venda"
    When confirma a devolucao
    Then o sistema move o item para local "QUARENTENA"
    And registra motivo obrigatorio no log

  Scenario: Exigir aprovacao para quebra
    Given que o operador registra quebra com motivo "AVARIA"
    When salva a solicitacao de quebra
    Then o status fica "PENDENTE_APROVACAO"
    And apenas supervisor ou administrador pode aprovar

  Scenario: Impedir venda direta de lote vencido
    Given que o produto "P-200" tem lote "L-01" com validade vencida
    When o operador tenta registrar venda direta
    Then o sistema bloqueia a venda
    And orienta destino para quebra ou devolucao fornecedor

  Scenario: Sincronizar fila offline sem duplicidade
    Given que existem eventos pendentes no dispositivo
    And cada evento possui "idempotency_key" unico
    When a conexao e restabelecida
    Then o sistema envia os eventos em lote
    And nao duplica eventos ja confirmados no servidor

  Scenario: Registrar conflito de sincronizacao
    Given que um evento offline conflita com saldo ja alterado no servidor
    When o servidor processa o lote
    Then o evento recebe status "CONFLICT"
    And o sistema cria item em fila de resolucao com payload local e remoto
