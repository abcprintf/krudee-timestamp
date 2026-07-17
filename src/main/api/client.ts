import { ofetch } from 'ofetch'
import { getConfig } from '../config'

function buildOptions(options: Parameters<typeof ofetch>[1] = {}): Parameters<typeof ofetch>[1] & { headers: Headers } {
  const config = getConfig()
  const headers = new Headers(options.headers as HeadersInit | undefined)
  if (config.device_token) headers.set('X-Device-Token', config.device_token)
  // retry 2 ครั้งพร้อม backoff — endpoint ฝั่ง device idempotent (attendance dedup ด้วย client_event_id)
  return { baseURL: config.base_url || 'http://localhost:3000', retry: 2, retryDelay: 1000, timeout: 15000, ...options, headers }
}

export async function apiFetch<T>(path: string, options: Parameters<typeof ofetch>[1] = {}): Promise<T> {
  return ofetch<T>(path, buildOptions(options))
}

// เหมือน apiFetch แต่คืน raw response เพื่ออ่าน headers (เช่น Date สำหรับเช็คนาฬิกาเครื่องเพี้ยน)
export async function apiFetchRaw(path: string, options: Parameters<typeof ofetch>[1] = {}) {
  return ofetch.raw(path, buildOptions(options))
}

export interface RegisterDeviceBody { school_code: string; setup_token: string; device_name?: string; app_version?: string }
export interface RegisterDeviceResponse { device_id: string; device_token: string; school: unknown }

export function registerDevice(body: RegisterDeviceBody): Promise<RegisterDeviceResponse> {
  return apiFetch<RegisterDeviceResponse>('/api/device/register', { method: 'POST', body })
}
