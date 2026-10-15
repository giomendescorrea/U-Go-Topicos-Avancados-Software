import type {
  GenerateContractInput,
  IContratos,
  OperationResult,
} from "../types"
import type { Contract, ContractStatus } from "../../../types"
import { supabase } from "../../../lib/supabase"
import { userService } from "../../users"

const formatDate = (date: Date) => date.toISOString().slice(0, 10)

interface PersistedContractRow {
  id: string
  start_date: string
  end_date: string
  status: ContractStatus
  created_at: string
}

interface MembershipRow extends PersistedContractRow {
  student_id: string
  student_name: string
  route_id: string
  route_name: string
  driver_id: string
  driver_name: string
  monthly_price: number | string
}

interface CompanyContractRow extends PersistedContractRow {
  company_id: string
  route_id: string
  party: string
  provider: string
  value: number | string
  vehicles?: Contract["vehicles"]
  company_routes?: { name?: string } | null
}

const membershipToContract = (row: MembershipRow): Contract => ({
  id: row.id,
  party: row.student_name,
  type: "student",
  userId: row.student_id,
  userRole: "student",
  routeId: row.route_id,
  route: row.route_name,
  provider: row.driver_name,
  providerId: row.driver_id,
  createdAt: row.created_at,
  startDate: row.start_date,
  endDate: row.end_date,
  value: Number(row.monthly_price),
  status: row.status,
})

const companyContractToContract = (row: CompanyContractRow): Contract => ({
  id: row.id,
  party: row.party,
  type: "company",
  userId: row.company_id,
  userRole: "company",
  routeId: row.route_id,
  route: row.company_routes?.name ?? "Rota",
  provider: row.provider,
  createdAt: row.created_at,
  startDate: row.start_date,
  endDate: row.end_date,
  value: Number(row.value),
  status: row.status,
  vehicles: row.vehicles ?? [],
})

export const isContractCurrentlyValid = (contract: Contract) => {
  const today = formatDate(new Date())
  return (
    contract.status === "active" &&
    contract.startDate <= today &&
    contract.endDate >= today
  )
}

async function joinDriverRoute(
  input: GenerateContractInput,
): Promise<OperationResult<Contract>> {
  if (!input.route.driverId) {
    return {
      success: false,
      error: "A rota não está vinculada a um motorista no Supabase.",
    }
  }
  const { data, error } = await supabase.rpc("join_driver_route", {
    p_route_id: input.route.id,
    p_start_date: input.startDate ?? formatDate(new Date()),
    p_duration_months: input.durationMonths ?? 12,
  })
  if (error) return { success: false, error: error.message }
  const row = (Array.isArray(data) ? data[0] : data) as MembershipRow
  return { success: true, data: membershipToContract(row) }
}

export const contractService: IContratos = {
  associarUsuarioRota: joinDriverRoute,
  gerarContratoAdesao: joinDriverRoute,
  async listarContratos(userId?: string) {
    const currentUser = await userService.obterUsuarioAtual()
    const studentId = userId ?? currentUser.data?.id
    if (studentId) {
      const { data, error } = await supabase
        .from("route_memberships")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
      if (error) return { success: false, error: error.message }
      return {
        success: true,
        data: (data as MembershipRow[]).map(membershipToContract),
      }
    }
    return { success: false, error: "Usuário não autenticado." }
  },
  async listarContratosDoPrestador() {
    const user = await userService.obterUsuarioAtual()
    if (!user.success || !user.data)
      return { success: false, error: "Usuário não autenticado." }

    const { data, error } = await supabase
      .from("route_memberships")
      .select("*")
      .eq("driver_id", user.data.id)
      .order("created_at", { ascending: false })
    if (error) return { success: false, error: error.message }
    return {
      success: true,
      data: (data as MembershipRow[]).map(membershipToContract),
    }
  },
  async atualizarStatusContrato(id: string, status: ContractStatus) {
    const { data: companyContract, error: companyError } = await supabase
      .from("company_contracts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, company_routes(name)")
      .maybeSingle()
    if (companyError) {
      return { success: false, error: companyError.message }
    }
    if (companyContract) {
      return {
        success: true,
        data: companyContractToContract(
          companyContract as unknown as CompanyContractRow,
        ),
      }
    }
    if (status === "cancelled") {
      const { data, error } = await supabase.rpc(
        "leave_driver_route_membership",
        { p_membership_id: id },
      )
      if (!error && data) {
        const row = (Array.isArray(data) ? data[0] : data) as MembershipRow
        return { success: true, data: membershipToContract(row) }
      }
      if (error) return { success: false, error: error.message }
    }
    return { success: false, error: "Contrato não encontrado." }
  },
  async atualizarVeiculosContrato(contract: Contract) {
    const { data, error } = await supabase
      .from("company_contracts")
      .update({
        vehicles: contract.vehicles ?? [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", contract.id)
      .select("*, company_routes(name)")
      .single()
    return error
      ? { success: false, error: error.message }
      : {
          success: true,
          data: companyContractToContract(
            data as unknown as CompanyContractRow,
          ),
        }
  },
  async verificarValidadeContrato(id: string) {
    const { data: membership, error: membershipError } = await supabase
      .from("route_memberships")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (membershipError)
      return { success: false, error: membershipError.message }
    if (membership) {
      return {
        success: true,
        data: isContractCurrentlyValid(
          membershipToContract(membership as MembershipRow),
        ),
      }
    }
    const { data: companyContract, error: companyError } = await supabase
      .from("company_contracts")
      .select("*, company_routes(name)")
      .eq("id", id)
      .maybeSingle()
    if (companyError) return { success: false, error: companyError.message }
    return companyContract
      ? {
          success: true,
          data: isContractCurrentlyValid(
            companyContractToContract(
              companyContract as unknown as CompanyContractRow,
            ),
          ),
        }
      : { success: false, error: "Contrato não encontrado." }
  },
  async gerarPdfContrato(contract: Contract) {
    try {
      const { jsPDF } = await import("jspdf")
      const pdf = new jsPDF()
      pdf.setFontSize(18)
      pdf.text("U-Go | Contrato de adesao", 20, 24)
      pdf.setFontSize(11)
      const vehicleLines =
        contract.vehicles?.flatMap((vehicle) => [
          "",
          `${vehicle.name} | Placa ${vehicle.plate} | ${vehicle.passengers.length}/${vehicle.capacity} passageiros`,
          ...vehicle.passengers.map(
            (passenger) => `  - ${passenger.name} (${passenger.email})`,
          ),
        ]) ?? []
      pdf.text(
        [
          `Contrato: ${contract.id}`,
          `${
            contract.userRole === "company" || contract.type === "company"
              ? "Empresa de fretamento"
              : "Contratante"
          }: ${contract.party}`,
          `Rota: ${contract.route}`,
          `Prestador: ${contract.provider ?? "U-Go"}`,
          `Vigencia: ${contract.startDate} a ${contract.endDate}`,
          `Valor mensal: R$ ${contract.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          `Status: ${contract.status}`,
          "",
          "O contratante adere ao servico de transporte descrito acima.",
          ...vehicleLines,
        ],
        20,
        42,
      )
      pdf.save(`contrato-ugo-${contract.id.slice(0, 8)}.pdf`)
      return { success: true }
    } catch {
      return { success: false, error: "Não foi possível gerar o PDF." }
    }
  },
}
