import { supabase } from "../../../lib/supabase"
import { getEmailRedirectUrl } from "../../../lib/auth"
import type {
  AccessSession,
  AuthenticateUserInput,
  IUsuario,
  OperationResult,
  RegisterUserInput,
} from "../types"
import type { UserProfile } from "../../../types"

function toProfile(user: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
  created_at?: string
}): UserProfile {
  return {
    id: user.id,
    email: user.email ?? "",
    role: user.user_metadata?.role as UserProfile["role"] ?? "student",
    ...user.user_metadata,
    createdAt: user.created_at ?? new Date().toISOString(),
  }
}

export const userService: IUsuario = {
  async cadastrarUsuario(input: RegisterUserInput) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { ...input.metadata, role: input.role },
        emailRedirectTo: getEmailRedirectUrl(),
      },
    })
    if (error || !data.user)
      return { success: false, error: error?.message ?? "Usuário não criado." }
    return { success: true, data: toProfile(data.user) }
  },
  async autenticarUsuario(input: AuthenticateUserInput) {
    const { data, error } = await supabase.auth.signInWithPassword(input)
    if (error || !data.session)
      return { success: false, error: error?.message ?? "Sessão não criada." }
    return {
      success: true,
      data: {
        accessToken: data.session.access_token,
        expiresAt: data.session.expires_at ?? null,
        user: toProfile(data.session.user),
      },
    }
  },
  async gerarSessaoAcesso(): Promise<OperationResult<AccessSession>> {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session)
      return { success: false, error: error?.message ?? "Sessão inexistente." }
    return {
      success: true,
      data: {
        accessToken: data.session.access_token,
        expiresAt: data.session.expires_at ?? null,
        user: toProfile(data.session.user),
      },
    }
  },
  async obterUsuarioAtual() {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user)
      return {
        success: false,
        error: error?.message ?? "Usuário não autenticado.",
      }
    return { success: true, data: toProfile(data.user) }
  },
}
