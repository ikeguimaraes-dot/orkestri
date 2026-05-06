import { NextRequest } from 'next/server'
import { verifyDiscordSignature } from '@/lib/discord/verify'
import { submitRunDecisionFromDiscord } from '@/lib/orquestrador/actions'

// Discord interaction types
const PING = 1
const APPLICATION_COMMAND = 2

// Discord response types
const PONG = 1
const CHANNEL_MESSAGE_WITH_SOURCE = 4

const EPHEMERAL = 64

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature-ed25519') ?? ''
  const timestamp = req.headers.get('x-signature-timestamp') ?? ''
  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? ''

  console.log('[discord/interactions] --- verificação de assinatura ---')
  console.log('[discord/interactions] x-signature-ed25519:', signature ? `${signature.slice(0, 16)}… (${signature.length} chars)` : '(ausente)')
  console.log('[discord/interactions] x-signature-timestamp:', timestamp || '(ausente)')
  console.log('[discord/interactions] DISCORD_PUBLIC_KEY configurada:', !!publicKey, publicKey ? `(${publicKey.length} chars)` : '')
  console.log('[discord/interactions] rawBody primeiros 100 chars:', rawBody.slice(0, 100))
  console.log('[discord/interactions] rawBody byte length:', Buffer.byteLength(rawBody, 'utf8'))

  if (!publicKey) {
    console.error('[discord/interactions] DISCORD_PUBLIC_KEY não configurada')
    return new Response('Server misconfigured', { status: 500 })
  }

  const valid = await verifyDiscordSignature(publicKey, signature, timestamp, rawBody)
  console.log('[discord/interactions] resultado da verificação:', valid)
  if (!valid) {
    return new Response('Invalid request signature', { status: 401 })
  }

  const body = JSON.parse(rawBody)

  // Discord PING handshake
  if (body.type === PING) {
    return json({ type: PONG })
  }

  // Slash commands
  if (body.type === APPLICATION_COMMAND) {
    const commandName: string = body.data?.name ?? ''
    const runId: string = body.data?.options?.find((o: any) => o.name === 'run_id')?.value ?? ''
    const discordUser: string =
      body.member?.user?.username ?? body.user?.username ?? 'unknown'

    if (!['aprovar', 'rejeitar'].includes(commandName)) {
      return json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: '❌ Comando desconhecido.', flags: EPHEMERAL } })
    }

    if (!runId) {
      return json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: '❌ Informe o `run_id`.', flags: EPHEMERAL } })
    }

    const decision = commandName === 'aprovar' ? 'approve' : ('reject' as const)
    const result = await submitRunDecisionFromDiscord(runId, decision, discordUser)

    if (!result.ok) {
      return json({
        type: CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `❌ **Erro:** ${result.error}`, flags: EPHEMERAL },
      })
    }

    const emoji = decision === 'approve' ? '✅' : '❌'
    const label = decision === 'approve' ? 'Aprovado' : 'Rejeitado'
    return json({
      type: CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `${emoji} **${label}** por @${discordUser}\n> Run: \`${runId}\``,
      },
    })
  }

  // Unknown type — acknowledge silently
  return json({ type: PONG })
}
