import type { Contract, ContractStatus, Route, UserRole } from "../../types"
import type { OperationResult } from "../shared/types"

export type { OperationResult } from "../shared/types"

export interface GenerateContractInput {
  route: Route
  userRole: UserRole
  userName: string
  provider?: string
  startDate?: string
  durationMonths?: number
}

export interface IContratos {
  associarUsuarioRota(
    input: GenerateContractInput,
  ): Promise<OperationResult<Contract>>
  gerarContratoAdesao(
    input: GenerateContractInput,
  ): Promise<OperationResult<Contract>>
  listarContratos(userId?: string): Promise<OperationResult<Contract[]>>
  listarContratosDoPrestador(): Promise<OperationResult<Contract[]>>
  atualizarStatusContrato(
    id: string,
    status: ContractStatus,
  ): Promise<OperationResult<Contract>>
  atualizarVeiculosContrato(
    contract: Contract,
  ): Promise<OperationResult<Contract>>
  verificarValidadeContrato(id: string): Promise<OperationResult<boolean>>
  gerarPdfContrato(contract: Contract): Promise<OperationResult<void>>
}
