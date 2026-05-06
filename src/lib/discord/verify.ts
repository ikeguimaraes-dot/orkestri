import { verify as cryptoVerify, createPublicKey } from 'node:crypto'

// DER prefix para SubjectPublicKeyInfo de Ed25519 (OID 1.3.101.112)
const ED25519_SPKI_HEADER = Buffer.from('302a300506032b6570032100', 'hex')

export function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  rawBody: string
): boolean {
  try {
    if (!signature || !timestamp || !publicKey) {
      console.error('[verifyDiscordSignature] parâmetro ausente — signature:', !!signature, 'timestamp:', !!timestamp, 'publicKey:', !!publicKey)
      return false
    }
    console.log('[verifyDiscordSignature] publicKey hex:', publicKey)
    console.log('[verifyDiscordSignature] signature hex:', signature)

    const pubKeyDer = Buffer.concat([ED25519_SPKI_HEADER, Buffer.from(publicKey, 'hex')])
    const key = createPublicKey({ key: pubKeyDer, format: 'der', type: 'spki' })
    const message = Buffer.from(timestamp + rawBody)
    const sig = Buffer.from(signature, 'hex')

    console.log('[verifyDiscordSignature] message hex:', message.toString('hex'))
    console.log('[verifyDiscordSignature] message byte length:', message.length, '| sig byte length:', sig.length)

    const result = cryptoVerify(null, message, key, sig)
    console.log('[verifyDiscordSignature] cryptoVerify result:', result)
    return result
  } catch (e) {
    console.error('[verifyDiscordSignature] erro ao verificar:', (e as Error)?.message ?? e)
    console.error('[verifyDiscordSignature] stack:', (e as Error)?.stack)
    return false
  }
}
