// StudyHub AI Proxy — Vercel Serverless Function
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const MAX_CHARS = 80000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en Vercel. Ve a Settings → Environment Variables.' });

  try {
    const { text, mode, term, multiFile, fileCount } = req.body;
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Falta el texto' });

    const truncated = text.slice(0, MAX_CHARS);
    const prompt = buildPrompt(mode, truncated, term, multiFile, fileCount);

    const geminiRes = await fetch(GEMINI_URL + '?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      })
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      return res.status(geminiRes.status).json({ error: err.error?.message || 'Error Gemini: ' + geminiRes.status });
    }

    const data = await geminiRes.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ result, mode });

  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error interno' });
  }
};

function buildPrompt(mode, text, term, multiFile, fileCount) {
  const count = fileCount || 1;
  const base = multiFile
    ? 'Sos un asistente educativo universitario. El estudiante subio ' + count + ' archivos para estudiar para un parcial. Cada archivo esta separado por "===". Analiza TODO el contenido y responde en espanol.

CONTENIDO:
"""
' + text + '
"""

'
    : 'Sos un asistente educativo universitario. Analiza el siguiente texto academico y responde en espanol.

TEXTO:
"""
' + text + '
"""

';

  const n = multiFile ? Math.min(count * 6, 20) : 12;
  const qn = multiFile ? Math.min(count * 4, 12) : 8;

  const prompts = {
    resumen: base + 'Genera un RESUMEN COMPLETO Y ESTRUCTURADO.

## Idea Principal
[1-2 oraciones]

## Temas Principales
[3-6 temas con descripcion]

## Puntos Clave
[lista de conceptos importantes]

## Conclusion
[sintesis final]',

    flashcards: base + 'Genera exactamente ' + n + ' flashcards de estudio de alta calidad.

REGLAS:
- Pregunta especifica y clara
- Respuesta completa (2-4 oraciones)
- Cubre los conceptos mas importantes
- Prioriza definiciones, procesos, diferencias, causas/efectos
' + (multiFile ? '- Cubre contenido de TODOS los archivos, no solo uno
' : '') + '
Responde UNICAMENTE con JSON valido, sin texto ni backticks:
[{"front": "pregunta", "back": "respuesta completa"}, ...]',

    quiz: base + 'Genera ' + qn + ' preguntas de opcion multiple de nivel universitario.

REGLAS:
- Basate en el contenido del texto
- 4 opciones plausibles, solo una correcta
- Incluye explicacion breve de por que es correcta
' + (multiFile ? '- Cubre contenido de TODOS los archivos
' : '') + '
Responde UNICAMENTE con JSON valido:
[{"q": "pregunta", "opts": ["A","B","C","D"], "ans": 0, "explanation": "Porque..."}, ...]',

    conceptos: base + 'Extrae los 15 conceptos mas importantes.

REGLAS:
- Prioriza terminos tecnicos y definiciones propias de la materia
- Contexto claro en 2-3 oraciones
- Ordenados de mayor a menor importancia

Responde UNICAMENTE con JSON valido:
[{"term": "Concepto", "context": "Explicacion clara"}, ...]',

    plan: base + 'Crea un PLAN DE ESTUDIO detallado para preparar el parcial con estos ' + count + ' tema' + (count>1?'s':'') + '.

Formato de respuesta:
## Dia 1
**Tema:** [nombre]
**Duracion:** [tiempo estimado]
**Actividades:**
- Leer y subrayar [seccion]
- Hacer resumen de [concepto]
- Practicar [ejercicio]

## Dia 2
[continuar para cada dia necesario]

## Repaso Final
[estrategia de repaso]

Se practico, especifico y basado en el contenido real del texto.',

    chat: base + 'Pregunta del estudiante: "' + (term || 'resume el texto') + '"

Responde de forma clara y educativa, citando partes especificas del texto cuando sea relevante.',

    drill: base + 'El estudiante selecciono el concepto: "' + (term || '') + '"

Genera una explicacion PROFUNDA y DIDACTICA sobre este concepto basada en el texto.

Incluye:
1. Definicion clara
2. Contexto dentro del tema
3. Ejemplos o aplicaciones del texto
4. Relacion con otros conceptos
5. Por que es importante'
  };

  return prompts[mode] || prompts.resumen;
}
