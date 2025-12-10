import type { PrivateKey } from '@libp2p/interface'

import { generateKeyPair, privateKeyFromProtobuf, privateKeyToProtobuf } from '@libp2p/crypto/keys'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

import { forComponent } from '@/lib/logger'

const STORAGE_KEY = 'uniconnect.extension.peer.identity'
const STORAGE_CHECKSUM_KEY = `${STORAGE_KEY}.sha256`
const log = forComponent('extension-identity')
const isBrowser = typeof window !== 'undefined'

interface PersistOptions {
  forceNew?: boolean
}

export async function loadOrCreateExtensionPrivateKey(opts: PersistOptions = {}): Promise<PrivateKey> {
  if (!isBrowser) {
    log('extension identity storage unavailable outside browser; using ephemeral key')

    return generateKeyPair('Ed25519')
  }

  if (!opts.forceNew) {
    const restored = await loadStoredPrivateKey()

    if (restored) {
      return restored
    }
  }

  const freshKey = await generateKeyPair('Ed25519')

  await persistPrivateKey(freshKey)

  return freshKey
}

function clearStoredIdentity(): void {
  if (!isBrowser) {
    return
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(STORAGE_CHECKSUM_KEY)
  } catch (error) {
    log.error('failed to clear extension identity %o', error)
  }
}

async function loadStoredPrivateKey(): Promise<PrivateKey | undefined> {
  if (!isBrowser) {
    return undefined
  }

  try {
    const encoded = window.localStorage.getItem(STORAGE_KEY)

    if (!encoded) {
      return undefined
    }

    const checksum = window.localStorage.getItem(STORAGE_CHECKSUM_KEY)
    const bytes = uint8ArrayFromString(encoded, 'base64pad')

    if (checksum) {
      const calculatedChecksum = await sha256(bytes)

      if (checksum !== calculatedChecksum) {
        throw new Error('extension identity checksum mismatch')
      }
    }

    return await privateKeyFromProtobuf(bytes)
  } catch (error) {
    log.error('failed to load extension identity %o', error)
    clearStoredIdentity()
  }

  return undefined
}

async function persistPrivateKey(privateKey: PrivateKey): Promise<void> {
  if (!isBrowser) {
    return
  }

  try {
    const bytes = privateKeyToProtobuf(privateKey)
    const encoded = uint8ArrayToString(bytes, 'base64pad')
    const checksum = await sha256(bytes)

    window.localStorage.setItem(STORAGE_KEY, encoded)
    window.localStorage.setItem(STORAGE_CHECKSUM_KEY, checksum)
  } catch (error) {
    log.error('failed to persist extension identity %o', error)
    throw error
  }
}

export function exportExtensionPrivateKey(): string | undefined {
  if (!isBrowser) {
    return undefined
  }

  return window.localStorage.getItem(STORAGE_KEY) ?? undefined
}

export async function importExtensionPrivateKey(encodedKey: string): Promise<PrivateKey> {
  if (!isBrowser) {
    throw new Error('Identity import is only supported in the browser environment')
  }

  try {
    const cleaned = encodedKey.trim()

    if (!cleaned) {
      throw new Error('Private key value cannot be empty')
    }

    const bytes = parseEncodedKey(cleaned)
    const privateKey = await privateKeyFromProtobuf(bytes)

    await persistPrivateKey(privateKey)

    return privateKey
  } catch (error: any) {
    log.error('failed to import extension identity %o', error)
    throw new Error(error?.message ?? 'Failed to import identity')
  }
}

function parseEncodedKey(value: string): Uint8Array {
  const hexPattern = /^(0x)?[0-9a-fA-F]+$/

  if (hexPattern.test(value)) {
    const normalized = value.startsWith('0x') ? value.slice(2) : value

    return uint8ArrayFromString(normalized, 'hex')
  }

  return uint8ArrayFromString(value, 'base64pad')
}

async function sha256(data: Uint8Array): Promise<string> {
  if (!isBrowser || !window.crypto?.subtle) {
    return uint8ArrayToString(data, 'base64pad')
  }

  const digestSource =
    data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
      ? (data.buffer as ArrayBuffer)
      : (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)

  const digest = await window.crypto.subtle.digest('SHA-256', digestSource)

  return uint8ArrayToString(new Uint8Array(digest), 'base64pad')
}
