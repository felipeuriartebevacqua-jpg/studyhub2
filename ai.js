// StudyHub AI Proxy — Vercel Serverless Function
// La API Key de Gemini vive SOLO acá, nunca en el frontend.
// Deploy en Vercel → Settings → Environment Variables → GEMINI_API_KEY

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const MAX_TEXT_CHARS = 80000; // ~20k tokens, bien dentro del free tier

export default async function handler(req, res) {
  // CORS — solo permite requests desde tu propio dominio de Vercel
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada en el servidor' });

  try {
    const { text, mode, term } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Falta el texto del documento' });
    }

    const truncated = text.slice(0, MAX_TEXT_CHARS);
    const prompt = buildPrompt(mode, truncated, term);

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          topP: 0.8,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ]
      })
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      return res.status(geminiRes.status).json({
        error: err.error?.message || `Error de Gemini: ${geminiRes.status}`
      });
    }

    const data = await geminiRes.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ result, mode });

  } catch (e) {
    console.error('AI proxy error:', e);
    return res.status(500).json({ error: e.message || 'Error interno del servidor' });
  }
}

function buildPrompt(mode, text, term) {
  const base = `Sos un asistente educativo universitario. Analizá el siguiente texto académico y respondé en español.\n\nTEXTO:\n"""\n${text}\n"""\n\n`;

  const prompts = {
    resumen: base + `Tarea: Generá un RESUMEN COMPLETO Y ESTRUCTURADO del texto.

Formato de respuesta (usá exactamente estas secciones):
## Idea Principal
[1-2 oraciones que capturen la esencia del documento]

## Temas Principales
[Lista de 3-6 temas con una descripción de 2-3 oraciones cada uno]

## Puntos Clave
[Lista con viñetas de los conceptos más importantes]

## Conclusión
[Síntesis final de 2-3 oraciones]

Sé específico con el contenido del texto. No uses frases genéricas.`,

    flashcards: base + `Tarea: Generá exactamente 12 flashcards de estudio de alta calidad.

REGLAS:
- La pregunta debe ser específica y clara
- La respuesta debe ser completa (2-4 oraciones)
- Cubrí los conceptos más importantes del texto
- Priorizá definiciones, procesos, diferencias, causas/efectos

Respondé ÚNICAMENTE con JSON válido, sin texto adicional ni backticks:
[
  {"front": "pregunta clara y específica", "back": "respuesta completa y educativa"},
  ...
]`,

    quiz: base + `Tarea: Generá 8 preguntas de opción múltiple de nivel universitario.

REGLAS:
- Basate estrictamente en el contenido del texto
- Las 4 opciones deben ser plausibles pero solo una correcta
- Incluí una explicación breve de por qué es correcta
- Variá el tipo: definiciones, aplicaciones, comparaciones

Respondé ÚNICAMENTE con JSON válido, sin texto adicional ni backticks:
[
  {
    "q": "pregunta",
    "opts": ["opción A", "opción B", "opción C", "opción D"],
    "ans": 0,
    "explanation": "Porque... [explicación de 1-2 oraciones]"
  },
  ...
]`,

    conceptos: base + `Tarea: Extraé los 15 conceptos más importantes del texto.

REGLAS:
- Priorizá términos técnicos, definiciones y conceptos propios de la materia
- El contexto debe explicar el concepto en lenguaje claro
- Ordenalos de mayor a menor importancia

Respondé ÚNICAMENTE con JSON válido, sin texto adicional ni backticks:
[
  {"term": "Nombre del Concepto", "context": "Explicación clara de 2-3 oraciones sobre qué es y por qué importa"},
  ...
]`,

    chat: base + `Pregunta del estudiante: "${term || 'resumí el texto'}"

Respondé de forma clara y educativa, citando partes específicas del texto cuando sea relevante. Si la pregunta no está relacionada con el texto, indicalo amablemente.`,

    drill: base + `El estudiante seleccionó el concepto: "${term}"

Tarea: Generá una explicación PROFUNDA y DIDÁCTICA sobre "${term}" basada en el texto.

Incluí:
1. Definición clara del concepto
2. Contexto dentro del tema principal
3. Ejemplos o aplicaciones mencionados en el texto
4. Relación con otros conceptos del documento
5. Por qué es importante entender este concepto

Explicá como si fueras un profesor universitario explicando a un alumno.`
  };

  return prompts[mode] || prompts.resumen;
}
