import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { projectId, publicAnonKey } from "../../utils/supabase/info.tsx"
import { capturePasswordRecoveryIntent } from "./authRecovery"

const supabaseUrl = `https://${projectId}.supabase.co`
const key = `__ugo_supabase_client__`

// Supabase removes auth callback parameters while initializing. Persist the
// recovery intent first so App can still select the password reset screen.
capturePasswordRecoveryIntent()

declare global {
  interface Window {
    [key: string]: SupabaseClient | undefined
  }
}

function getClient(): SupabaseClient {
  if (typeof window !== "undefined" && window[key]) {
    return window[key]!
  }
  const client = createClient(supabaseUrl, publicAnonKey, {
    auth: {
      storageKey: "ugo-auth",
      autoRefreshToken: true,
      persistSession: true,
    },
  })
  if (typeof window !== "undefined") {
    window[key] = client
  }
  return client
}

export const supabase = getClient()
export const EDGE_FUNCTION_URL = `https://${projectId}.supabase.co/functions/v1/make-server-0563e832`
