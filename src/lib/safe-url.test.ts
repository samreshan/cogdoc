import { describe, expect, it } from 'vitest'
import { isPrivateAddress } from '@/lib/safe-url'

describe('source URL network isolation', () => {
  it.each(['127.0.0.1', '10.0.0.4', '172.16.2.3', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', 'fe80::1'])(
    'blocks private address %s', (address) => expect(isPrivateAddress(address)).toBe(true),
  )
  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])(
    'allows public address %s', (address) => expect(isPrivateAddress(address)).toBe(false),
  )
})
