import {
  capturePasswordRecoveryIntent,
  clearPasswordRecoveryIntent,
  PASSWORD_RECOVERY_PARAM,
} from "./authRecovery"

export function getEmailRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`
}

export function getPasswordRecoveryRedirectUrl() {
  const url = new URL(getEmailRedirectUrl())
  url.searchParams.set(PASSWORD_RECOVERY_PARAM, "1")
  return url.toString()
}

export function isPasswordRecoveryUrl() {
  return capturePasswordRecoveryIntent()
}

export function clearPasswordRecoveryUrl() {
  clearPasswordRecoveryIntent()
  const url = new URL(window.location.href)
  url.searchParams.delete(PASSWORD_RECOVERY_PARAM)
  url.searchParams.delete("type")
  url.hash = ""
  window.history.replaceState(null, "", `${url.pathname}${url.search}`)
}

export function getDriverAccessMessage(
  user:
    | {
        app_metadata?: Record<string, unknown>
      }
    | undefined,
) {
  if (user?.app_metadata?.driver_status === "pending") {
    return "Sua conta está sob análise da equipe"
  }
  if (user?.app_metadata?.driver_status === "rejected") {
    return "Sua solicitação de cadastro não foi aprovada. Entre em contato com a equipe U-Go."
  }
  return ""
}

export function getFriendlySignUpError(error: unknown) {
  const authError = error as {
    code?: string
    message?: string
    status?: number
  }
  const message = authError?.message ?? ""
  const normalized = `${authError?.code ?? ""} ${message}`.toLowerCase()

  console.error("Supabase sign-up error", {
    code: authError?.code,
    status: authError?.status,
    message,
  })

  if (
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("email rate limit") ||
    normalized.includes("rate limit")
  ) {
    return "O limite de envio de e-mails foi atingido. Aguarde alguns minutos e tente novamente."
  }
  if (
    normalized.includes("email_send_failed") ||
    normalized.includes("error sending confirmation email") ||
    normalized.includes("smtp")
  ) {
    return "A conta não pôde ser criada porque o Supabase falhou ao enviar o e-mail de confirmação. Revise host, porta, usuário, senha de aplicativo e remetente do SMTP."
  }
  if (
    normalized.includes("already registered") ||
    normalized.includes("email_already_exists") ||
    normalized.includes("user_already_exists") ||
    normalized.includes("email_exists")
  ) {
    return "Este e-mail já está cadastrado. Faça login ou use outro endereço."
  }
  if (normalized.includes("cpf_already_exists")) {
    return "Este CPF já está cadastrado. Faça login ou use outro CPF."
  }
  if (
    normalized.includes("invalid email") ||
    normalized.includes("email_address_invalid")
  ) {
    return "O endereço de e-mail informado é inválido."
  }
  if (
    normalized.includes("weak_password") ||
    normalized.includes("password should be at least")
  ) {
    return "A senha não atende aos requisitos de segurança do Supabase."
  }
  if (
    normalized.includes("signup_disabled") ||
    normalized.includes("email_provider_disabled")
  ) {
    return "O cadastro por e-mail está desabilitado no Supabase."
  }
  if (normalized.includes("redirect")) {
    return "A URL de retorno não está autorizada no Supabase. Revise Authentication → URL Configuration."
  }
  if (normalized.includes("database error saving new user")) {
    return "O Supabase não conseguiu salvar o usuário. Verifique os logs de autenticação e os triggers da tabela auth.users."
  }

  return message
    ? `Não foi possível criar a conta. Supabase: ${message}`
    : "Não foi possível criar a conta. Consulte Authentication → Logs no Supabase."
}

export function getFriendlyPasswordResetError(error: unknown) {
  const authError = error as {
    code?: string
    message?: string
    status?: number
  }
  const message = authError?.message ?? ""
  const normalized = `${authError?.code ?? ""} ${message}`.toLowerCase()

  console.error("Supabase password recovery error", {
    code: authError?.code,
    status: authError?.status,
    message,
  })

  if (
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("email rate limit") ||
    normalized.includes("rate limit")
  ) {
    return "O limite de envio de e-mails foi atingido. Aguarde alguns minutos antes de tentar novamente."
  }
  if (
    normalized.includes("email_send_failed") ||
    normalized.includes("error sending recovery email") ||
    normalized.includes("smtp")
  ) {
    return "O Supabase não conseguiu enviar o e-mail de recuperação. Revise as credenciais SMTP, use uma senha de aplicativo e consulte Authentication → Logs."
  }
  if (normalized.includes("redirect")) {
    return "A URL de recuperação não está autorizada. Adicione a URL atual em Authentication → URL Configuration → Redirect URLs."
  }
  if (
    normalized.includes("invalid email") ||
    normalized.includes("email_address_invalid")
  ) {
    return "Informe um endereço de e-mail válido."
  }

  return message
    ? `Não foi possível enviar o e-mail. Supabase: ${message}`
    : "Não foi possível enviar o e-mail de recuperação. Consulte Authentication → Logs no Supabase."
}
