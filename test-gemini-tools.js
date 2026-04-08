import { GoogleGenerativeAI } from '@google/generative-ai'
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }, { baseUrl: process.env.GOOGLE_GEMINI_BASE_URL })
async function run() {
  try {
    const res = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      tools: [
        {
          functionDeclarations: [
            {
              name: 'my_tool',
              description: 'A tool',
              parameters: {
                type: 'OBJECT',
                properties: {
                  param1: { type: 'STRING', description: 'A string' },
                },
              },
            },
          ],
        },
      ],
    })
    console.log(res.response.text())
  } catch (e) {
    console.error(e)
  }
}
run()
