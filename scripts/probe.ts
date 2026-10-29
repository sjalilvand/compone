// probe سبک سرویس هوش مصنوعی — یک فراخوانی کوچک برای تست دسترسی
import ZAI from 'z-ai-web-dev-sdk'

async function main() {
  try {
    const zai = await ZAI.create()
    const r = await zai.chat.completions.create({
      messages: [{ role: 'user', content: 'ping' }],
      thinking: { type: 'disabled' },
      max_tokens: 4,
    })
    const c = r?.choices?.[0]?.message?.content
    console.log('PROBE OK:', String(c ?? '').slice(0, 40))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log('PROBE FAIL:', msg.slice(0, 160))
  }
}

main()
