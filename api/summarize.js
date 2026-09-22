const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const bulletCount = briefMode ? "exactly 3" : "4-5";

export default async function handler(req, res) {
  // Allow requests from Chrome extensions
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { content, title } = req.body;

  if (!content || content.trim().length < 50) {
    return res.status(400).json({ error: "Not enough content to summarize." });
  }

  // Try models in order, fall back if one fails
  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
  ];

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `
You are a helpful reading assistant. Analyze the following webpage content and return ONLY a JSON object with no markdown, no code fences, nothing else.

Page title: ${title}

Content:
${content.slice(0, 12000)}

Return exactly this JSON shape:
{
  "bullets": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"],
  "insights": ["insight 1", "insight 2", "insight 3"],
  "readingTime": "X min read"
}

Rules:
- bullets: ${bulletCount} concise key points from the content
- insights: 2-3 deeper takeaways or implications
- readingTime: estimate based on content length (average 200 words/min)
- Return raw JSON only, no explanation
      `.trim();

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Strip markdown fences if Gemini adds them anyway
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return res.status(200).json(parsed);
    } catch (err) {
      // If this model failed, try the next one
      console.error(`Model ${modelName} failed:`, err.message);
      continue;
    }
  }

  // All models failed
  return res
    .status(500)
    .json({ error: "AI summarization failed. Please try again." });
}
