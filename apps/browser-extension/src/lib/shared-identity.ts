import type { PrivateKey } from '@libp2p/interface'

import { generateKeyPair, privateKeyFromProtobuf, privateKeyToProtobuf } from '@libp2p/crypto/keys'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

import { forComponent } from '@/lib/logger'

const STORAGE_KEY = 'uniconnect.extension.identity'
const CHECKSUM_KEY = `${STORAGE_KEY}.sha256`
const log = forComponent('shared-identity')

const hasChromeStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local

const readRecord = async () => {
  if (!hasChromeStorage()) {
    return {
      value: typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null,
      checksum: typeof window !== 'undefined' ? window.localStorage.getItem(CHECKSUM_KEY) : null,
    }
  }

  return await new Promise<{ value?: string | null; checksum?: string | null }>((resolve) => {
    chrome.storage.local.get([STORAGE_KEY, CHECKSUM_KEY], (items) => {
      if (chrome.runtime?.lastError) {
        log.error('failed to read chrome storage identity %o', chrome.runtime.lastError)
        resolve({})

        return
      }

      resolve({
        value: items[STORAGE_KEY] ?? null,
        checksum: items[CHECKSUM_KEY] ?? null,
      })
    })
  })
}

const writeRecord = async (value: string | null, checksum: string | null) => {
  if (!hasChromeStorage()) {
    if (typeof window !== 'undefined') {
      if (value) {
        window.localStorage.setItem(STORAGE_KEY, value)
      } else {
        window.localStorage.removeItem(STORAGE_KEY)
      }

      if (checksum) {
        window.localStorage.setItem(CHECKSUM_KEY, checksum)
      } else {
        window.localStorage.removeItem(CHECKSUM_KEY)
      }
    }

    return
  }

  await new Promise<void>((resolve) => {
    chrome.storage.local.set(
      {
        [STORAGE_KEY]: value ?? null,
        [CHECKSUM_KEY]: checksum ?? null,
      },
      () => resolve(),
    )
  })
}

const sha256 = async (data: Uint8Array): Promise<string> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return uint8ArrayToString(data, 'base64pad')
  }

  const digestSource =
    data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
      ? (data.buffer as ArrayBuffer)
      : (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)

  const digest = await crypto.subtle.digest('SHA-256', digestSource)

  return uint8ArrayToString(new Uint8Array(digest), 'base64pad')
}

const persistPrivateKey = async (privateKey: PrivateKey) => {
  const bytes = privateKeyToProtobuf(privateKey)
  const encoded = uint8ArrayToString(bytes, 'base64pad')
  const checksum = await sha256(bytes)

  await writeRecord(encoded, checksum)
}

export async function loadSharedPrivateKey(opts: { forceNew?: boolean } = {}): Promise<PrivateKey> {
  if (!opts.forceNew) {
    try {
      const record = await readRecord()

      if (record.value) {
        return await privateKeyFromProtobuf(uint8ArrayFromString(record.value, 'base64pad'))
      }
    } catch (error) {
      log.error('failed to load shared identity %o', error)
    }
  }

  const freshKey = await generateKeyPair('Ed25519')
  await persistPrivateKey(freshKey)

  return freshKey
}

export async function importSharedPrivateKey(encodedKey: string): Promise<PrivateKey> {
  const cleaned = encodedKey.trim()

  if (!cleaned) {
    throw new Error('Private key value cannot be empty')
  }

  try {
    const bytes = uint8ArrayFromString(cleaned, 'base64pad')
    const privateKey = await privateKeyFromProtobuf(bytes)
    await persistPrivateKey(privateKey)

    return privateKey
  } catch (error: any) {
    log.error('failed to import shared identity %o', error)
    throw new Error(error?.message ?? 'Failed to import identity')
  }
}
