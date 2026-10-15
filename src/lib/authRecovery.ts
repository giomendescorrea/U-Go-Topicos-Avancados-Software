export const PASSWORD_RECOVERY_PARAM = "password-recovery"
export const PASSWORD_RECOVERY_STORAGE_KEY = "__ugo_password_recovery__"

function recoveryInCurrentUrl() {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))

  return (
    search.get(PASSWORD_RECOVERY_PARAM) === "1" ||
    search.get("type") === "recovery" ||
    hash.get("type") === "recovery"
  )
}

export function capturePasswordRecoveryIntent() {
  if (typeof window === "undefined") return false

  if (recoveryInCurrentUrl()) {
    window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "1")
    return true
  }

  return (
    window.sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === "1"
  )
}

export function clearPasswordRecoveryIntent() {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY)
}
