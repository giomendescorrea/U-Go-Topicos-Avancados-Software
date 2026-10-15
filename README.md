# U-Go — Componentes Usuário e Contratos

Recorte do aplicativo U-Go contendo os dois componentes escolhidos para o trabalho:

- **ComponenteUsuario** — cadastro, autenticação, sessão e dados bancários.
- **ComponenteContratos** — adesão a rotas, geração de contratos, listagem, status e PDF.

## Tecnologias

React 19 · TypeScript 5.7 · Vite 8 · Tailwind CSS 4 · Supabase (Auth + Postgres + RLS) · jsPDF · cpf-cnpj-validator · Vitest.

## Estrutura dos componentes
src/features/
├── shared/types.ts # OperationResult<T>

├── users/ # ► ComponenteUsuario

│ ├── types.ts # IUsuario e entradas

│ ├── services/userService.ts # implementação de IUsuario

│ └── components/UserPanel.tsx # UI de cadastro/login/dados bancários

└── contracts/ # ► ComponenteContratos

├── types.ts # IContratos e entradas

├── services/contractService.ts # implementação de IContratos

└── components/ContractsPanel.tsx


- O **ComponenteUsuario** concentra tudo relacionado a identidade: cadastro, login, sessão e dados bancários, implementados em `userService` e expostos via `IUsuario`.
- O **ComponenteContratos** concentra tudo relacionado a adesão e contrato: criação, listagem, mudança de status, verificação de validade e PDF, implementados em `contractService` e expostos via `IContratos`.
- Os dois compartilham o tipo `OperationResult<T>` (`{ success, data?, error? }`) em `features/shared/types.ts`.

## Interfaces e operações

### `IUsuario` (fornecida pelo ComponenteUsuario)

| Operação | O que faz |
| --- | --- |
| `cadastrarUsuario` | Cria o usuário no Supabase Auth com os metadados do perfil. |
| `autenticarUsuario` | Faz login por e-mail/senha e retorna a sessão com token. |
| `gerarSessaoAcesso` | Recupera a sessão já persistida do cliente Supabase. |
| `obterUsuarioAtual` | Valida a identidade do usuário no servidor. |
| `cadastrarDadosBancarios` | Salva banco, agência, conta, tipo e CPF/CNPJ do usuário. |
| `validarDadosBancarios` | Valida o formato dos dados bancários antes de salvar. |

### `IContratos` (fornecida pelo ComponenteContratos)

| Operação | O que faz |
| --- | --- |
| `associarUsuarioRota` | Cria o vínculo entre usuário e rota (alias de adesão). |
| `gerarContratoAdesao` | Gera o contrato ativo com vigência, valor e rota. |
| `listarContratos` | Lista os contratos do usuário autenticado. |
| `listarContratosDoPrestador` | Lista os contratos do motorista/empresa. |
| `atualizarStatusContrato` | Muda o status (`active`, `pending`, `expired`, `cancelled`). |
| `verificarValidadeContrato` | Retorna `true` se o contrato está ativo e dentro da vigência. |
| `gerarPdfContrato` | Gera e baixa o PDF do contrato. |

**Dependência entre os componentes:** `IContratos` **requer** `IUsuario`. Antes de gerar a adesão, `contractService.gerarContratoAdesao` chama `userService.obterUsuarioAtual()` para confirmar que o contratante está autenticado. Sem isso, a operação falha com "É necessário estar autenticado para gerar o contrato."

## Como os componentes se comunicam
ComponenteUsuario ──(IUsuario)──▶ ComponenteContratos
userService contractService
│
▼
Contrato ativo + PDF

Testes realizados
Os testes automatizados cobrem o fluxo principal dos dois componentes:

ComponenteUsuario: cadastro e login funcionando — criação de usuário no Auth, autenticação com credenciais válidas, rejeição de credenciais inválidas e validação de dados bancários.

ComponenteContratos: geração de contratos funcionando — criação da adesão com usuário autenticado, listagem, atualização de status, verificação de validade e geração de PDF.

Integração: a geração de contrato exige o usuário autenticado, comprovando a comunicação entre contractService e userService.
