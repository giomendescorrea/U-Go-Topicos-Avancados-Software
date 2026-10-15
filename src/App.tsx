import { useEffect, useRef, useState } from "react"
import { supabase, EDGE_FUNCTION_URL } from "./lib/supabase"
import LandingPage from "./pages/LandingPage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import EmailSentPage from "./pages/EmailSentPage"
import StudentDashboard from "./pages/student/StudentDashboard"
import DriverDashboard from "./pages/driver/DriverDashboard"
import CompanyDashboard from "./pages/company/CompanyDashboard"
import CollaboratorDashboard from "./pages/collaborator/CollaboratorDashboard"
import SetPasswordPage from "./pages/SetPasswordPage"
import AdminDashboard from "./pages/admin/AdminDashboard"
import type { AppPage, UserRole } from "./types"
import {
  clearPasswordRecoveryUrl,
  getDriverAccessMessage,
  isPasswordRecoveryUrl,
} from "./lib/auth"

export default function App() {
  const [page, setPage] = useState<AppPage>("landing")
  const [selectedRole, setSelectedRole] = useState<UserRole>("student")
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [pendingEmail, setPendingEmail] = useState("")
  const [loginMessage, setLoginMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const recoveryFlow = useRef(isPasswordRecoveryUrl())

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user)
        if (isPasswordRecoveryUrl()) recoveryFlow.current = true
        if (recoveryFlow.current) {
          setProfile(null)
          setPage("password-reset")
          setLoading(false)
          return
        }
        const accessMessage = getDriverAccessMessage(data.session.user)
        if (accessMessage) {
          setUser(null)
          setLoginMessage(accessMessage)
          setPage("login")
          void supabase.auth.signOut()
          setLoading(false)
          return
        }
        loadProfile(data.session.user.id, data.session.user.user_metadata)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user)
          if (event === "PASSWORD_RECOVERY" || isPasswordRecoveryUrl()) {
            recoveryFlow.current = true
            setProfile(null)
            setLoginMessage("")
            setPage("password-reset")
            return
          }
          if (recoveryFlow.current) return
          const accessMessage = getDriverAccessMessage(session.user)
          if (accessMessage) {
            setUser(null)
            setProfile(null)
            setLoginMessage(accessMessage)
            setPage("login")
            window.setTimeout(() => void supabase.auth.signOut(), 0)
            return
          }
          setLoginMessage("")
          loadProfile(session.user.id, session.user.user_metadata)
        } else {
          setUser(null)
          setProfile(null)
          setPage((current) =>
            current === "login" || current === "email-sent"
              ? current
              : "landing",
          )
        }
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  const loadProfile = async (_userId: string, metadata: any) => {
    // metadata from Supabase Auth always carries role — use it as the source of truth
    setProfile(metadata)
    setPage("dashboard")
  }

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role)
    setPage("register")
  }

  const handleLoginSuccess = (userId: string) => {
    // Profile loading handled by onAuthStateChange
  }

  const handleLogout = () => {
    setUser(null)
    setProfile(null)
    setPage("landing")
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0d0520" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse"
            style={{ background: "linear-gradient(135deg, #9333ea, #7e22ce)" }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <span className="text-purple-300/50 text-sm">Carregando U-Go...</span>
        </div>
      </div>
    )
  }

  if (page === "dashboard" && user && profile) {
    if (profile.role === "admin") {
      return <AdminDashboard onLogout={handleLogout} />
    }
    const role: UserRole = profile.role || "student"
    if (role === "collaborator" && profile.needs_password) {
      return (
        <SetPasswordPage
          userEmail={user.email ?? ""}
          onDone={() => {
            setProfile((p: any) => ({ ...p, needs_password: false }))
          }}
        />
      )
    }
    if (role === "driver")
      return <DriverDashboard profile={profile} onLogout={handleLogout} />
    if (role === "company")
      return <CompanyDashboard profile={profile} onLogout={handleLogout} />
    if (role === "collaborator")
      return <CollaboratorDashboard profile={profile} onLogout={handleLogout} />
    return <StudentDashboard profile={profile} onLogout={handleLogout} />
  }

  if (page === "password-reset" && user) {
    return (
      <SetPasswordPage
        recovery
        userEmail={user.email ?? ""}
        onDone={() => {
          recoveryFlow.current = false
          clearPasswordRecoveryUrl()
          supabase.auth.signOut().finally(() => setPage("login"))
        }}
      />
    )
  }

  if (page === "login") {
    return (
      <LoginPage
        onBack={() => setPage("landing")}
        onLoginSuccess={handleLoginSuccess}
        message={loginMessage}
      />
    )
  }

  if (page === "register") {
    return (
      <RegisterPage
        role={selectedRole}
        onBack={() => setPage("landing")}
        onSuccess={(email) => {
          setPendingEmail(email)
          setPage("email-sent")
        }}
      />
    )
  }

  if (page === "email-sent") {
    return (
      <EmailSentPage
        email={pendingEmail}
        role={selectedRole}
        onLogin={() => setPage("login")}
      />
    )
  }

  return (
    <LandingPage
      onSelectRole={handleRoleSelect}
      onLogin={() => setPage("login")}
    />
  )
}
