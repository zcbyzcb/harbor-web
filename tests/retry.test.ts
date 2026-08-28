import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { http, discardSessionRequests, ApiError, resultUnknown } from '../src/api/http'
import { post, clearCsrfToken, login } from '../src/api/auth-api'

function ok(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, status: 200, statusText: 'OK', headers: {}, data: { code: 'SUCCESS', data } }
}
beforeEach(() => { clearCsrfToken(); discardSessionRequests() })

describe('safe write retries', () => {
  it('never automatically repeats a timed-out POST', async () => {
    const writes: string[] = []
    http.defaults.adapter = async config => {
      if (config.url === '/auth/csrf') return ok(config, { headerName: 'X-CSRF-TOKEN', token: 'token' })
      writes.push(String(config.headers['Idempotency-Key']))
      throw new AxiosError('timeout', 'ECONNABORTED', config)
    }
    const key = crypto.randomUUID()
    await expect(post('/booking_orders', { roomCount: 2 }, key)).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(writes).toEqual([key])
    await expect(post('/booking_orders', { roomCount: 2 }, key)).rejects.toBeInstanceOf(ApiError)
    expect(writes).toEqual([key, key])
  })

  it('refreshes identity and CSRF after 403 without replaying a business write', async () => {
    const calls: string[] = []
    http.defaults.adapter = async config => {
      calls.push(config.url!)
      if (config.url === '/auth/csrf') return ok(config, { headerName: 'X-CSRF-TOKEN', token: 'token' })
      if (config.url === '/auth/me') return ok(config, { employeeId: '1', username: 'frontdesk' })
      throw new AxiosError('csrf', undefined, config, undefined, { ...ok(config, null), status: 403, data: { code: 'CSRF_INVALID', message: 'expired' } })
    }
    await expect(post('/booking_orders', {}, crypto.randomUUID())).rejects.toMatchObject({ code: 'CSRF_INVALID' })
    expect(calls).toEqual(['/auth/csrf', '/booking_orders', '/auth/me', '/auth/csrf'])
  })

  it('recovers a lost login response through GET me, with no second login', async () => {
    const requests: string[] = []
    http.defaults.adapter = async config => {
      requests.push(config.url!)
      if (config.url === '/auth/csrf') return ok(config, { headerName: 'X-CSRF-TOKEN', token: 'token' })
      if (config.url === '/auth/login') throw new AxiosError('timeout', 'ECONNABORTED', config)
      return ok(config, { employeeId: '1', username: 'frontdesk', displayName: '测试前台' })
    }
    await expect(login('frontdesk', 'synthetic-password')).resolves.toMatchObject({ employeeId: '1' })
    expect(requests).toEqual(['/auth/csrf', '/auth/login', '/auth/me'])
  })

  it('discards responses from an earlier session', async () => {
    let release: (() => void) | undefined
    http.defaults.adapter = async config => { await new Promise<void>(resolve => { release = resolve }); return ok(config, { name: 'old guest' }) }
    const response = http.get('/orders').catch(error => error)
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    discardSessionRequests(); release!()
    await expect(response).resolves.toMatchObject({ code: 'STALE_RESPONSE' })
  })

  it('distinguishes unknown outcomes from rejected business commands', () => {
    expect(resultUnknown(new ApiError('RESULT_UNKNOWN', 'unknown', 503))).toBe(true)
    expect(resultUnknown(new ApiError('INVENTORY_NOT_AVAILABLE', 'sold out', 409))).toBe(false)
  })
})
