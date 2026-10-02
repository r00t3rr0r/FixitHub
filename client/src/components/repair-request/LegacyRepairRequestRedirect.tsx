import { Navigate, useParams } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

/**
 * Kompatibilität für bereits versendete E-Mails/Benachrichtigungen mit dem alten Link
 * /repair-requests/:id. Leitet je nach Rolle auf die heutige Detailansicht weiter
 * (gleiche Ziele wie RepairRequestService.buildRepairRequestPath auf dem Server).
 * Der Zugriff selbst prüft weiterhin der Server (fremde Anfragen => 403).
 */
export function LegacyRepairRequestRedirect() {
  const { id = "" } = useParams()
  const { user } = useAuth()
  const query = id ? `?requestId=${encodeURIComponent(id)}` : ""
  const role = user?.role
  const base = role === "admin"
    ? "/admin/repair-requests"
    : role === "staff"
      ? "/staff/repair-requests"
      : "/my-repair-requests"
  return <Navigate to={`${base}${query}`} replace />
}
