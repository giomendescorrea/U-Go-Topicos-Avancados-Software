# Contratos dos componentes U-Go

## Componentes selecionados

### ComponenteUsuario

Responsável por cadastro, autenticação, sessão e consulta do usuário autenticado. A implementação
`userService`, em `src/features/users/services/userService.ts`, adapta o Supabase Auth à interface
`IUsuario`.

**Interface fornecida:** `IUsuario`.

**Consumidores que requerem a interface:**

- `ComponenteContratos`: valida o usuário antes de gerar uma adesão;
- `ComponenteFuncionarios`: vincula um colaborador a um usuário cadastrado;
- telas de cadastro e login: criam usuário e sessão.

### ComponenteContratos

Responsável por associar usuário e rota, gerar adesões, listar contratos, verificar vigência, atualizar
status e gerar PDF. A implementação está em
`src/features/contracts/services/contractService.ts`; a apresentação reutilizável está em
`src/features/contracts/components/ContractsPanel.tsx`.

**Interface fornecida:** `IContratos`.

**Consumidores que requerem a interface:**

- `ComponentePagamento`: exige contrato ativo e vigente antes de cobrar;
- `ComponenteReserva`: exige contrato válido antes de reservar uma vaga;
- dashboards dos quatro perfis: listam, baixam e atualizam contratos.

As interfaces ficam em `src/features/users/types.ts` e `src/features/contracts/types.ts`.

### Estrutura dos contratos empresariais

Para o perfil empresa, cada contrato representa uma prestadora de fretamento e pode conter vários
ônibus. A hierarquia é:

```text
Contrato / empresa de fretamento
└── Ônibus
    └── Colaboradores passageiros
```

Cada ônibus registra identificador, nome, placa, capacidade, rota e passageiros. Cada passageiro
referencia um colaborador cadastrado pela empresa por identificador, nome e e-mail.

No painel de contratos, a empresa pode:

- informar a empresa de fretamento responsável ao cadastrar uma rota;
- gerar automaticamente o contrato associado à nova rota;
- visualizar as empresas que prestam fretamento;
- consultar os ônibus de cada contrato;
- acompanhar ocupação e capacidade;
- visualizar os colaboradores que utilizam cada ônibus;
- vincular um colaborador ativo ainda não alocado;
- remover um colaborador de um ônibus;
- incluir ônibus e passageiros no PDF do contrato.

O cadastro do colaborador continua sendo responsabilidade da área **Colaboradores**. O contrato apenas
faz a associação entre o usuário cadastrado e o ônibus da prestadora, preservando a separação entre
`ComponenteUsuario`, `ComponenteFuncionarios` e `ComponenteContratos`.

Ao editar uma rota empresarial, nome da rota, prestadora e valor também são atualizados no contrato
vinculado. Ao excluir a rota, o contrato associado é removido da listagem.

## Matriz de interfaces

| Interface | Componente | Direção | Operações |
| --- | --- | --- | --- |
| `IUsuario` | ComponenteUsuario | Fornecida | Cadastrar usuário; autenticar; gerar sessão; obter usuário atual |
| `IUsuario` | ComponenteContratos | Requerida | Verificar dados e identidade do contratante |
| `IUsuario` | ComponenteFuncionarios | Requerida | Vincular funcionário ao usuário cadastrado |
| `IContratos` | ComponenteContratos | Fornecida | Associar rota; gerar adesão; listar; atualizar status; verificar validade; gerar PDF |
| `IContratos` | ComponentePagamento | Requerida | Confirmar contrato ativo e vigente antes do pagamento |
| `IContratos` | ComponenteReserva | Requerida | Confirmar validade antes da reserva |

## Contratos das operações

Todas as operações retornam `Promise<OperationResult<T>>`. O resultado tem `success`, `data` quando a
operação conclui e `error` quando há falha. Senhas e tokens não são persistidos pelo componente de
contratos.

### IUsuario.cadastrarUsuario

- **Entrada:** e-mail, senha, perfil e metadados.
- **Pré-condições:** e-mail válido; senha aceita pelo Supabase; perfil suportado.
- **Pós-condições:** usuário criado no Supabase Auth; perfil básico retornado.
- **Falhas:** e-mail já cadastrado, senha inválida ou indisponibilidade do Supabase.

### IUsuario.autenticarUsuario

- **Entrada:** e-mail e senha.
- **Pré-condições:** usuário existente e credenciais válidas.
- **Pós-condições:** sessão Supabase criada e `AccessSession` retornada.
- **Falhas:** credenciais inválidas, e-mail não confirmado ou usuário bloqueado.

### IUsuario.gerarSessaoAcesso

- **Entrada:** nenhuma; usa a sessão armazenada pelo cliente Supabase.
- **Pré-condições:** sessão autenticada existente.
- **Pós-condições:** token, expiração e usuário retornados.
- **Falhas:** sessão ausente ou expirada.

### IUsuario.obterUsuarioAtual

- **Entrada:** nenhuma.
- **Pré-condições:** sessão autenticada.
- **Pós-condições:** identidade validada no servidor do Supabase.
- **Falhas:** token inválido, expirado ou usuário inexistente.

### IContratos.associarUsuarioRota / gerarContratoAdesao

- **Entrada:** rota, perfil, nome do usuário, prestador, início e duração opcional.
- **Pré-condições:** usuário autenticado; rota válida; ausência de contrato não cancelado para a mesma
  combinação usuário/rota.
- **Pós-condições:** contrato ativo criado com identificador único, vigência, valor e referência da rota.
- **Falhas:** usuário não autenticado ou adesão duplicada.

### IContratos.listarContratos

- **Entrada:** identificador opcional do usuário.
- **Pré-condições:** quando o identificador não é informado, deve existir sessão autenticada.
- **Pós-condições:** retorna somente contratos do usuário solicitado/autenticado.
- **Falhas:** sessão ausente quando necessária ou armazenamento indisponível.

### IContratos.atualizarStatusContrato

- **Entrada:** identificador do contrato e novo status (`active`, `pending`, `expired` ou `cancelled`).
- **Pré-condições:** contrato existente; transição autorizada pelo perfil consumidor.
- **Pós-condições:** status atualizado e contrato resultante retornado.
- **Falhas:** contrato não encontrado ou status não autorizado.

### IContratos.verificarValidadeContrato

- **Entrada:** identificador do contrato.
- **Regra:** válido somente quando o status é `active` e a data atual está entre início e fim, inclusive.
- **Pós-condições:** retorna `true` ou `false` sem alterar o contrato.
- **Uso obrigatório:** pagamento e reserva devem interromper suas operações quando o resultado não for
  `true`.

### IContratos.gerarPdfContrato

- **Entrada:** contrato completo.
- **Pré-condições:** contrato existente e dados mínimos preenchidos.
- **Pós-condições:** arquivo PDF baixado no navegador.
- **Falhas:** dados inválidos ou erro do gerador de PDF.

## Persistência

Não há fallback em `localStorage`. Usuários e sessões ficam no Supabase Auth. Rotas de motoristas e
adesões universitárias ficam em `driver_routes` e `route_memberships`. Rotas, contratos e colaboradores
empresariais ficam em `company_routes`, `company_contracts` e `company_collaborators`.

As tabelas usam RLS para limitar cada motorista ou empresa aos próprios dados. A criação de usuários
colaboradores é feita pela Edge Function com a chave de serviço, depois de validar que a sessão
solicitante pertence a uma empresa. As migrations em `supabase/migrations` devem ser aplicadas em ordem
e a Edge Function deve ser publicada após alterações.
