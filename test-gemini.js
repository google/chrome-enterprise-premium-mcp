import { GoogleGenerativeAI } from '@google/generative-ai'
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }, { baseUrl: process.env.GOOGLE_GEMINI_BASE_URL })
async function run() {
  try {
    const res = await model.generateContent('hello')
    console.log(res.response.text())
  } catch (e) {
    console.error(e)
  }
}
run()
