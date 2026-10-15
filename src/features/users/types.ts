import type { UserProfile, UserRole } from "../../types"
import type { OperationResult } from "../shared/types"

export type { OperationResult } from "../shared/types"

export interface RegisterUserInput {
  email: string
  password: string
  role: UserRole
  metadata: Record<string, unknown>
}

export interface AuthenticateUserInput {
  email: string
  password: string
}

export interface AccessSession {
  accessToken: string
  expiresAt: number | null
  user: UserProfile
}

export interface IUsuario {
  cadastrarUsuario(
    input: RegisterUserInput,
  ): Promise<OperationResult<UserProfile>>
  autenticarUsuario(
    input: AuthenticateUserInput,
  ): Promise<OperationResult<AccessSession>>
  gerarSessaoAcesso(): Promise<OperationResult<AccessSession>>
  obterUsuarioAtual(): Promise<OperationResult<UserProfile>>
}
