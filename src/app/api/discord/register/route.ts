import { NextRequest } from 'next/server'

const COMMANDS = [
  {
    name: 'hos',
    description: 'Consulta o Orquestrador HOS em linguagem natural',
    options: [
      {
        name: 'pergunta',
        description: 'O que você quer saber? Ex: status dos runs, pendentes, jobs ativos...',
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: 'aprovar',
    description: 'Aprovar uma execução no Orquestrador HOS',
    options: [
      {
        type: 3, // STRING
        name: 'run_id',
        description: 'ID da execução (UUID)',
        required: true,
      },
    ],
  },
  {
    name: 'rejeitar',
    description: 'Rejeitar uma execução no Orquestrador HOS',
    options: [
      {
        type: 3,
        name: 'run_id',
        description: 'ID da execução (UUID)',
        required: true,
      },
    ],
  },
]

// GET /api/discord/register?secret=CRON_SECRET
// Registers slash commands with Discord. Call once after deploy.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appId = process.env.DISCORD_APP_ID
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (!appId || !botToken) {
    return Response.json({ error: 'DISCORD_APP_ID ou DISCORD_BOT_TOKEN não configurados' }, { status: 500 })
  }

  const results = await Promise.all(
    COMMANDS.map((cmd) =>
      fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify(cmd),
      }).then((r) => r.json())
    )
  )

  return Response.json({ registered: results })
}
