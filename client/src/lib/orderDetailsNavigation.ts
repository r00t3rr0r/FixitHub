export type OrderDetailsBackTarget = {
  pathname: string
  search?: string
  hash?: string
  label?: string
  state?: Record<string, unknown>
}

export type OrderDetailsNavigationState = {
  backTarget?: OrderDetailsBackTarget
  openWorkflowId?: string
  workflowMode?: 'start' | 'resume' | 'execute' | 'view'
  source?: string
  [key: string]: unknown
}

type LocationSnapshot = {
  pathname: string
  search?: string
  hash?: string
}

type BuildOrderDetailsStateOptions = {
  label?: string
  restoreState?: Record<string, unknown>
  state?: Record<string, unknown>
}

export function buildOrderDetailsState(
  location: LocationSnapshot,
  options: BuildOrderDetailsStateOptions = {}
): OrderDetailsNavigationState {
  return {
    ...(options.state || {}),
    backTarget: {
      pathname: location.pathname,
      search: location.search || '',
      hash: location.hash || '',
      label: options.label,
      state: options.restoreState,
    },
  }
}

export function getOrderDetailsPath(orderId: string) {
  return `/orders/${orderId}`
}