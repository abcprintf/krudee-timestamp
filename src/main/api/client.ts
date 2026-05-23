import { ofetch } from 'ofetch'
import { getConfig } from '../config'

export async function apiFetch<T>(path: string, options: Parameters<typeof ofetch>[1] = {}): Promise<T> {
  const config = getConfig()
  const headers = new Headers(options.headers as HeadersInit | undefined)
  if (config.device_token) headers.set('X-Device-Token', config.device_token)
  return ofetch<T>(path, { baseURL: config.base_url || 'http://localhost:3000', retry: 0, timeout: 15000, ...options, headers })
}

export interface RegisterDeviceBody { school_code: string; setup_token: string; device_name?: string; app_version?: string }
export interface RegisterDeviceResponse { device_id: string; device_token: string; school: unknown }

export function registerDevice(body: RegisterDeviceBody): Promise<RegisterDeviceResponse> {
  return apiFetch<RegisterDeviceResponse>('/api/device/register', { method: 'POST', body })
}
