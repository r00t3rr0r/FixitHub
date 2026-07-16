import { useEffect, useState } from 'react'
import { getPublicAdcellConfig, type AdcellConfig } from '@/api/marketingPromo'

const DEFAULT_CONFIG: AdcellConfig = {
  enabled: true,
  pid: '10419',
  eventId: '13229',
  conversionEnabled: true,
  firstPartyEnabled: true,
  containerTagsEnabled: true,
}

// Module-level cache so the API is only called once per page load
let cached: AdcellConfig | null = null
let fetchPromise: Promise<AdcellConfig> | null = null

function fetchConfig(): Promise<AdcellConfig> {
  if (cached) return Promise.resolve(cached)
  if (fetchPromise) return fetchPromise
  fetchPromise = getPublicAdcellConfig().then((cfg) => {
    cached = cfg
    fetchPromise = null
    return cfg
  }).catch(() => {
    fetchPromise = null
    cached = DEFAULT_CONFIG
    return DEFAULT_CONFIG
  })
  return fetchPromise
}

/** Invalidate the module cache (called after admin saves new config) */
export function invalidateAdcellConfigCache() {
  cached = null
  fetchPromise = null
}

/**
 * Returns the current ADCELL tracking config.
 * Falls back to DEFAULT_CONFIG (all enabled) while loading,
 * so that in the rare case of a slow server the scripts still fire.
 */
export function useAdcellConfig(): AdcellConfig {
  const [config, setConfig] = useState<AdcellConfig>(cached ?? DEFAULT_CONFIG)

  useEffect(() => {
    fetchConfig().then(setConfig)
  }, [])

  return config
}
