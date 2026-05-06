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
    const pubKeyDer = Buffer.concat([ED25519_SPKI_HEADER, Buffer.from(publicKey, 'hex')])
    const key = createPublicKey({ key: pubKeyDer, format: 'der', type: 'spki' })
    const message = Buffer.from(timestamp + rawBody)
    const sig = Buffer.from(signature, 'hex')
    return cryptoVerify(null, message, key, sig)
  } catch (e) {
    console.error('[verifyDiscordSignature]', e)
    return false
  }
}
