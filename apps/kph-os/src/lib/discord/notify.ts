export async function sendDiscordMessage(content: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}
