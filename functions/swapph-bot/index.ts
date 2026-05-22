import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BOT_TOKEN = Deno.env.get('SWAPPH_BOT_TOKEN')!

async function sendMessage(chatId: number, text: string, buttonText: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: buttonText, web_app: { url: 'https://starseedsoultype.github.io/swapph' } }
        ]]
      }
    }),
  })
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('ok', { status: 200 })
  }

  try {
    const update = await req.json()
    const message = update.message

    if (!message) {
      return new Response('ok', { status: 200 })
    }

    const chatId = message.chat.id
    const langCode = message.from?.language_code || 'ru'
    const isRu = langCode === 'ru'

    if (isRu) {
      await sendMessage(
        chatId,
        'Открой SwapPH, чтобы обменять, продать или отдать вещи на Пангане.',
        '👗 Открыть SwapPH'
      )
    } else {
      await sendMessage(
        chatId,
        'Open SwapPH to swap, sell, or give away pre-loved items on Koh Phangan.',
        '👗 Open SwapPH'
      )
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response('ok', { status: 200 })
  }
})
