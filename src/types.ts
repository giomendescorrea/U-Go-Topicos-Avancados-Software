export type UserRole = "student" | "driver" | "company" | "collaborator"
export type AppPage = "landing" | "login" | "register" | "email-sent" | "dashboard" | "email-confirm" | "password-reset"

export interface StudentForm {
  fullName: string
  phone: string
  cpf: string
  email: string
  password: string
  university: string
}

export interface DriverForm {
  fullName: string
  phone: string
  cpf: string
  email: string
  password: string
  vehicle: string
  plate: string
  cnh: string
  seats: string
}

export interface CompanyForm {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  email: string
  password: string
}

export interface CollaboratorForm {
  fullName: string
  phone: string
  cpf: string
  email: string
  password: string
  company: string
}

export interface Route {
  id: string
  driverId?: string
  name: string
  origin: string
  destination: string
  departureTime: string
  returnTime: string
  seats: number
  occupiedSeats: number
  price: number
  days: string[]
  driverName?: string
  vehicle?: string
  pickupPoints?: PickupPoint[]
  freightCompany?: string
  contractId?: string
}

export interface PickupPoint {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

export interface Collaborator {
  id: string
  name: string
  email: string
  cpf: string
  phone: string
  address?: string
  department?: string
  route?: string
  status: "active" | "inactive"
  needsPassword?: boolean
}

export interface Contract {
  id: string
  party: string
  type: "student" | "company"
  route: string
  routeId?: string
  userId?: string
  userRole?: UserRole
  provider?: string
  providerId?: string
  createdAt?: string
  vehicles?: ContractVehicle[]
  startDate: string
  endDate: string
  value: number
  status: ContractStatus
}

export type ContractStatus = "active" | "pending" | "expired" | "cancelled"

export interface ContractVehicle {
  id: string
  name: string
  plate: string
  capacity: number
  route?: string
  passengers: ContractPassenger[]
}

export interface ContractPassenger {
  id: string
  name: string
  email: string
}

export interface UserProfile {
  id: string
  role: UserRole
  email: string
  full_name?: string
  phone?: string
  cpf?: string
  university?: string
  vehicle?: string
  plate?: string
  cnh?: string
  seats?: number
  razao_social?: string
  nome_fantasia?: string
  cnpj?: string
  company?: string
  createdAt: string
}
