import { useState } from "react"
import type {
  Collaborator,
  Contract,
  ContractStatus,
  UserRole,
} from "../../../types"
import {
  contractService,
  isContractCurrentlyValid,
} from "../services/contractService"

interface Props {
  contracts: Contract[]
  viewerRole: UserRole
  onContractChange: (contract: Contract) => void
  availableCollaborators?: Collaborator[]
}

const labels: Record<ContractStatus, string> = {
  active: "Ativo",
  pending: "Pendente",
  expired: "Expirado",
  cancelled: "Cancelado",
}

export default function ContractsPanel({
  contracts,
  viewerRole,
  onContractChange,
  availableCollaborators = [],
}: Props) {
  const [message, setMessage] = useState("")
  const [selectedCollaborators, setSelectedCollaborators] =
    useState<Record<string, string>>({})
  const canManage = viewerRole === "driver" || viewerRole === "company"

  const update = async (contract: Contract, status: ContractStatus) => {
    const result = await contractService.atualizarStatusContrato(
      contract.id,
      status,
    )
    if (result.success && result.data) {
      onContractChange(result.data)
      setMessage("Status atualizado.")
      return
    }
    setMessage(result.error ?? "Não foi possível atualizar.")
  }

  const pdf = async (contract: Contract) => {
    const result = await contractService.gerarPdfContrato(contract)
    setMessage(
      result.success
        ? "PDF gerado com sucesso."
        : (result.error ?? "Erro ao gerar PDF."),
    )
  }

  const assignCollaborator = async (contract: Contract, vehicleId: string) => {
    const key = `${contract.id}:${vehicleId}`
    const collaborator = availableCollaborators.find(
      (item) => item.id === selectedCollaborators[key],
    )
    if (!collaborator) return

    const updated = {
      ...contract,
      vehicles: contract.vehicles?.map((vehicle) =>
        vehicle.id === vehicleId
          ? {
              ...vehicle,
              passengers: [
                ...vehicle.passengers,
                {
                  id: collaborator.id,
                  name: collaborator.name,
                  email: collaborator.email,
                },
              ],
            }
          : vehicle,
      ),
    }
    const result = await contractService.atualizarVeiculosContrato(updated)
    if (!result.success || !result.data) {
      setMessage(result.error ?? "Não foi possível salvar a vinculação.")
      return
    }
    onContractChange(result.data)
    setSelectedCollaborators((current) => ({ ...current, [key]: "" }))
    setMessage(`${collaborator.name} foi vinculado ao ônibus.`)
  }

  const removeCollaborator = async (
    contract: Contract,
    vehicleId: string,
    collaboratorId: string,
  ) => {
    const updated = {
      ...contract,
      vehicles: contract.vehicles?.map((vehicle) =>
        vehicle.id === vehicleId
          ? {
              ...vehicle,
              passengers: vehicle.passengers.filter(
                (passenger) => passenger.id !== collaboratorId,
              ),
            }
          : vehicle,
      ),
    }
    const result = await contractService.atualizarVeiculosContrato(updated)
    if (!result.success || !result.data) {
      setMessage(result.error ?? "Não foi possível remover o colaborador.")
      return
    }
    onContractChange(result.data)
    setMessage("Colaborador removido do ônibus.")
  }

  return (
    <section>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-purple-300/50">
            Prestação de serviço e adesões
          </p>
          <h1
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Contratos
          </h1>
        </div>
        <span className="rounded-full bg-purple-500/15 px-3 py-1.5 text-xs font-medium text-purple-200">
          {contracts.length} {contracts.length === 1 ? "contrato" : "contratos"}
        </span>
      </div>
      {message && (
        <p
          className="mb-4 rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-100"
          aria-live="polite"
        >
          {message}
        </p>
      )}
      <div className="space-y-4">
        {contracts.map((contract) => {
          const valid = isContractCurrentlyValid(contract)
          return (
            <article
              key={contract.id}
              className="rounded-2xl border border-purple-500/15 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <h2 className="font-semibold text-white">
                      {contract.party}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        valid
                          ? "bg-green-500/10 text-green-300"
                          : "bg-white/5 text-purple-300/50"
                      }`}
                    >
                      {labels[contract.status]}
                    </span>
                  </div>
                  <p className="text-sm text-purple-200/70">{contract.route}</p>
                  {viewerRole === "company" && (
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-purple-400/60">
                      Empresa de fretamento
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-purple-300/50">
                    <span>
                      Vigência: {contract.startDate} a {contract.endDate}
                    </span>
                    <span>R$ {contract.value.toLocaleString("pt-BR")}/mês</span>
                    {contract.provider && (
                      <span>Prestador: {contract.provider}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => pdf(contract)}
                    className="rounded-xl border border-purple-500/30 px-3 py-2 text-xs font-medium text-purple-200 hover:bg-purple-500/10"
                  >
                    Gerar PDF
                  </button>
                  {canManage && contract.status === "pending" && (
                    <button
                      onClick={() => update(contract, "active")}
                      className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Ativar
                    </button>
                  )}
                  {contract.status === "active" && (
                    <button
                      onClick={() => update(contract, "cancelled")}
                      className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/10"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {viewerRole === "company" && (
                <div className="mt-5 border-t border-purple-500/10 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      Ônibus vinculados ao contrato
                    </h3>
                    <span className="text-xs text-purple-300/45">
                      {contract.vehicles?.length ?? 0} veículos
                    </span>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {contract.vehicles?.map((vehicle) => {
                      const assignedIds = new Set(
                        contract.vehicles?.flatMap((item) =>
                          item.passengers.map((passenger) => passenger.id),
                        ),
                      )
                      const available = availableCollaborators.filter(
                        (collaborator) =>
                          collaborator.status === "active" &&
                          !assignedIds.has(collaborator.id),
                      )
                      const key = `${contract.id}:${vehicle.id}`

                      return (
                        <div
                          key={vehicle.id}
                          className="rounded-xl border border-purple-500/15 bg-[#0d0520]/45 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-semibold text-white">
                                {vehicle.name}
                              </h4>
                              <p className="mt-1 text-xs text-purple-300/45">
                                Placa {vehicle.plate} · {vehicle.route}
                              </p>
                            </div>
                            <span className="rounded-full bg-purple-500/10 px-2 py-1 text-xs text-purple-200/70">
                              {vehicle.passengers.length}/{vehicle.capacity}
                            </span>
                          </div>

                          <div className="mt-4 space-y-2">
                            {vehicle.passengers.map((passenger) => (
                              <div
                                key={passenger.id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-purple-100">
                                    {passenger.name}
                                  </p>
                                  <p className="truncate text-[11px] text-purple-300/35">
                                    {passenger.email}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeCollaborator(
                                      contract,
                                      vehicle.id,
                                      passenger.id,
                                    )
                                  }
                                  className="shrink-0 text-xs text-red-300/60 hover:text-red-300"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                            {vehicle.passengers.length === 0 && (
                              <p className="py-2 text-center text-xs text-purple-300/35">
                                Nenhum colaborador neste ônibus.
                              </p>
                            )}
                          </div>

                          {vehicle.passengers.length < vehicle.capacity && (
                            <div className="mt-3 flex gap-2">
                              <select
                                value={selectedCollaborators[key] ?? ""}
                                onChange={(event) =>
                                  setSelectedCollaborators((current) => ({
                                    ...current,
                                    [key]: event.target.value,
                                  }))
                                }
                                className="min-w-0 flex-1 rounded-lg border border-purple-500/20 bg-[#170b2d] px-2.5 py-2 text-xs text-purple-100"
                              >
                                <option value="">Selecionar colaborador</option>
                                {available.map((collaborator) => (
                                  <option
                                    key={collaborator.id}
                                    value={collaborator.id}
                                  >
                                    {collaborator.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!selectedCollaborators[key]}
                                onClick={() =>
                                  assignCollaborator(contract, vehicle.id)
                                }
                                className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                              >
                                Vincular
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {!contract.vehicles?.length && (
                      <div className="rounded-xl border border-dashed border-purple-500/20 py-8 text-center text-xs text-purple-300/40 lg:col-span-2">
                        Nenhum ônibus informado pela empresa de fretamento.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </article>
          )
        })}
        {contracts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-purple-500/20 py-16 text-center text-sm text-purple-300/40">
            Nenhum contrato disponível.
          </div>
        )}
      </div>
    </section>
  )
}
