import type { PrivateKey } from '@libp2p/interface'

import { privateKeyFromProtobuf, privateKeyToProtobuf, generateKeyPair } from '@libp2p/crypto/keys'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

import { forComponent } from '@/lib/logger'

const STORAGE_KEY = 'uniconnect.peer.identity'
const STORAGE_CHECKSUM_KEY = `${STORAGE_KEY}.sha256`
const log = forComponent('identity')
const isBrowser = typeof window !== 'undefined'

interface PersistOptions {
  forceNew?: boolean
}

/**
 * Loads the persisted Ed25519 private key from localStorage and verifies its checksum.
 * Falls back to generating a fresh key pair when one does not exist or the checksum is invalid.
 * This mirrors the behavior of Tor/Onion Browser where identities are sticky until rotated.
 */
export async function loadOrCreatePrivateKey(opts: PersistOptions = {}): Promise<PrivateKey> {
  if (!isBrowser) {
    log('identity storage is unavailable outside the browser; falling back to ephemeral key')

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
    log.error('failed to clear stored identity %o', error)
  }
}

/**
 * Reads the base64-encoded protobuf key bytes, validates the optional SHA-256 checksum,
 * and reconstructs the libp2p PrivateKey instance. Any corruption automatically clears storage.
 */
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
        throw new Error('identity checksum mismatch')
      }
    }

    return await privateKeyFromProtobuf(bytes)
  } catch (error) {
    log.error('failed to load stored identity %o', error)
    clearStoredIdentity()
  }

  return undefined
}

/**
 * Serializes the private key to protobuf, encodes it as base64, and stores it alongside a SHA-256
 * checksum so tampering can be detected on the next load.
 */
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
    log.error('failed to persist identity %o', error)
    throw error
  }
}

/**
 * Browser-friendly SHA-256 helper. We prefer crypto.subtle when available and fall back to a deterministic
 * base64 encoding so the checksum comparison still fails closed if the environment lacks WebCrypto.
 */
async function sha256(data: Uint8Array): Promise<string> {
  if (!isBrowser || !window.crypto?.subtle) {
    // Fallback to a deterministic encoding if crypto.subtle is unavailable
    return uint8ArrayToString(data, 'base64pad')
  }

  const digestSource =
    data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
      ? (data.buffer as ArrayBuffer)
      : (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)

  const digest = await window.crypto.subtle.digest('SHA-256', digestSource)

  return uint8ArrayToString(new Uint8Array(digest), 'base64pad')
}
