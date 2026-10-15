import { Hono } from "npm:hono"
import { cors } from "npm:hono/cors"
import { logger } from "npm:hono/logger"
import { createClient } from "jsr:@supabase/supabase-js@2.49.8"
const app = new Hono()

const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

const normalizeCpf = (value: unknown) => String(value ?? "").replace(/\D/g, "")

async function listAllUsers(admin: ReturnType<typeof adminClient>) {
  const users = []
  const perPage = 1000
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < perPage) return users
  }
}

function findRegistrationConflicts(
  users: Awaited<ReturnType<typeof listAllUsers>>,
  email: string,
  cpf: string,
) {
  return {
    emailExists: users.some(
      (user) => user.email?.trim().toLowerCase() === email,
    ),
    cpfExists:
      cpf.length === 11 &&
      users.some((user) => normalizeCpf(user.user_metadata?.cpf) === cpf),
  }
}

async function authenticatedCompany(c: any) {
  const authorization = c.req.header("Authorization") ?? ""
  const token = authorization.replace(/^Bearer\s+/i, "")
  if (!token) return null

  const admin = adminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user || data.user.user_metadata?.role !== "company") {
    return null
  }
  return { admin, company: data.user }
}

async function authenticatedAdmin(c: any) {
  const authorization = c.req.header("Authorization") ?? ""
  const token = authorization.replace(/^Bearer\s+/i, "")
  if (!token) return null

  const admin = adminClient()
  const { data, error } = await admin.auth.getUser(token)
  const email = data.user?.email?.trim().toLowerCase()
  if (
    error ||
    !data.user ||
    email !== "administracao.ugo@gmail.com" ||
    data.user.app_metadata?.role !== "admin"
  ) {
    return null
  }
  return { admin, user: data.user }
}

// Enable logger
app.use("*", logger(console.log))

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
)

// Health check endpoint
app.get("/make-server-0563e832/health", (c) => {
  return c.json({ status: "ok" })
})

app.post("/make-server-0563e832/registration/check", async (c) => {
  const body = await c.req.json()
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase()
  const cpf = normalizeCpf(body.cpf)
  if (!email) return c.json({ error: "Informe o e-mail." }, 400)

  try {
    const conflicts = findRegistrationConflicts(
      await listAllUsers(adminClient()),
      email,
      cpf,
    )
    return c.json(conflicts)
  } catch (error) {
    console.error("Registration availability check failed", error)
    return c.json({ error: "Não foi possível validar o cadastro." }, 500)
  }
})

app.post("/make-server-0563e832/collaborators", async (c) => {
  const context = await authenticatedCompany(c)
  if (!context) return c.json({ error: "Não autorizado." }, 401)

  const body = await c.req.json()
  const collaborators = Array.isArray(body.collaborators)
    ? body.collaborators
    : []
  if (collaborators.length === 0 || collaborators.length > 100) {
    return c.json({ error: "Informe entre 1 e 100 colaboradores." }, 400)
  }

  const companyName =
    context.company.user_metadata?.nome_fantasia ??
    context.company.user_metadata?.razao_social ??
    "Empresa"
  const created = []
  const failures = []
  let existingUsers
  try {
    existingUsers = await listAllUsers(context.admin)
  } catch (error) {
    console.error("Collaborator availability check failed", error)
    return c.json({ error: "Não foi possível validar os colaboradores." }, 500)
  }

  for (const item of collaborators) {
    const email = String(item.email ?? "")
      .trim()
      .toLowerCase()
    const name = String(item.name ?? "").trim()
    if (!email || !name) {
      failures.push({ email, error: "Nome e e-mail são obrigatórios." })
      continue
    }
    const cpf = normalizeCpf(item.cpf)
    const conflicts = findRegistrationConflicts(existingUsers, email, cpf)
    if (conflicts.emailExists) {
      failures.push({ email, error: "Este e-mail já está cadastrado." })
      continue
    }
    if (conflicts.cpfExists) {
      failures.push({ email, error: "Este CPF já está cadastrado." })
      continue
    }

    const { data: invited, error: inviteError } =
      await context.admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: body.redirectTo,
        data: {
          role: "collaborator",
          full_name: name,
          phone: String(item.phone ?? "").trim(),
          cpf: String(item.cpf ?? "").trim(),
          address: String(item.address ?? "").trim(),
          department: String(item.department ?? "").trim(),
          company: companyName,
          company_id: context.company.id,
          needs_password: true,
        },
      })

    if (inviteError || !invited.user) {
      failures.push({
        email,
        error: inviteError?.message ?? "Não foi possível criar o usuário.",
      })
      continue
    }

    const { data: record, error: insertError } = await context.admin
      .from("company_collaborators")
      .insert({
        company_id: context.company.id,
        auth_user_id: invited.user.id,
        name,
        email,
        cpf: String(item.cpf ?? "").trim(),
        phone: String(item.phone ?? "").trim(),
        address: String(item.address ?? "").trim(),
        department: String(item.department ?? "").trim(),
        needs_password: true,
      })
      .select("*")
      .single()

    if (insertError) {
      await context.admin.auth.admin.deleteUser(invited.user.id)
      failures.push({ email, error: insertError.message })
      continue
    }
    created.push(record)
    existingUsers.push(invited.user)
  }

  return c.json({ created, failures }, failures.length > 0 ? 207 : 201)
})

app.delete("/make-server-0563e832/collaborators/:id", async (c) => {
  const context = await authenticatedCompany(c)
  if (!context) return c.json({ error: "Não autorizado." }, 401)

  const { data: collaborator, error } = await context.admin
    .from("company_collaborators")
    .select("id, auth_user_id")
    .eq("id", c.req.param("id"))
    .eq("company_id", context.company.id)
    .single()

  if (error || !collaborator) {
    return c.json({ error: "Colaborador não encontrado." }, 404)
  }

  if (collaborator.auth_user_id) {
    const { error: deleteUserError } =
      await context.admin.auth.admin.deleteUser(collaborator.auth_user_id)
    if (deleteUserError) return c.json({ error: deleteUserError.message }, 400)
  } else {
    const { error: deleteError } = await context.admin
      .from("company_collaborators")
      .delete()
      .eq("id", collaborator.id)
    if (deleteError) return c.json({ error: deleteError.message }, 400)
  }

  return c.json({ success: true })
})

app.get("/make-server-0563e832/admin/driver-applications", async (c) => {
  const context = await authenticatedAdmin(c)
  if (!context) return c.json({ error: "Não autorizado." }, 401)

  const { data, error } = await context.admin
    .from("driver_applications")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return c.json({ error: error.message }, 400)
  return c.json({ applications: data ?? [] })
})

app.patch(
  "/make-server-0563e832/admin/driver-applications/:userId",
  async (c) => {
    const context = await authenticatedAdmin(c)
    if (!context) return c.json({ error: "Não autorizado." }, 401)

    const body = await c.req.json()
    const status = String(body.status ?? "")
    const rejectionReason = String(body.rejectionReason ?? "").trim()
    if (!["approved", "rejected"].includes(status)) {
      return c.json({ error: "Status de análise inválido." }, 400)
    }
    if (status === "rejected" && !rejectionReason) {
      return c.json({ error: "Informe o motivo da reprovação." }, 400)
    }

    const { data, error } = await context.admin
      .from("driver_applications")
      .update({
        status,
        rejection_reason: status === "rejected" ? rejectionReason : null,
      })
      .eq("user_id", c.req.param("userId"))
      .eq("status", "pending")
      .select("*")
      .single()

    if (error || !data) {
      return c.json(
        {
          error:
            error?.message ?? "Solicitação não encontrada ou já analisada.",
        },
        400,
      )
    }
    return c.json({ application: data })
  },
)

Deno.serve(app.fetch)
