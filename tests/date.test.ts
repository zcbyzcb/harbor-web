import { expect, it } from 'vitest'
import { nextDate, dateTime } from '../src/api/hotel-api'

it('calculates hotel calendar dates without depending on browser timezone', () => {
  expect(nextDate('2026-08-31')).toBe('2026-09-01')
  expect(nextDate('2028-02-28', 2)).toBe('2028-03-01')
  expect(nextDate('2026-09-01', -1)).toBe('2026-08-31')
})

it('displays the explicit hotel time, preserving noon', () => {
  expect(dateTime('2026-08-28T12:00:00+08:00')).toBe('2026-08-28 12:00')
  expect(dateTime()).toBe('—')
})
