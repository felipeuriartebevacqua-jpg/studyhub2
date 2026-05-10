// StudyHub AI Proxy — Groq (Llama 3.3 70B)
// Gratis en console.groq.com → API Keys
// En Vercel: Settings → Environment Variables → GROQ_API_KEY

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const MAX_CHARS = 80000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({
    error: 'GROQ_API_KEY no configurada. Ve a Vercel → tu proyecto → Settings → Environment Variables y agregala para Production.'
  });

  try {
    const { text, mode, term, multiFile, fileCount } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Falta el texto del documento' });

    const prompt = buildPrompt(mode, text.slice(0, MAX_CHARS), term, multiFile, fileCount || 1);

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'Sos un asistente educativo universitario argentino. Responde siempre en español rioplatense (usas "vos"). Sos claro, preciso y didáctico.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 8000,
        top_p: 0.9
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      const msg = err.error?.message || '';
      if (groqRes.status === 401) return res.status(401).json({ error: 'GROQ_API_KEY invalida. Verificá que sea correcta en Vercel.' });
      if (groqRes.status === 429) return res.status(429).json({ error: 'Limite de Groq alcanzado. Esperá unos segundos y volvé a intentar.' });
      return res.status(groqRes.status).json({ error: 'Error Groq ' + groqRes.status + ': ' + msg });
    }

    const data = await groqRes.json();
    const result = data.choices?.[0]?.message?.content || '';
    if (!result) return res.status(500).json({ error: 'Groq no devolvio respuesta. Intentá de nuevo.' });

    return res.status(200).json({ result, mode, model: MODEL });

  } catch (e) {
    return res.status(500).json({ error: 'Error interno: ' + (e.message || 'desconocido') });
  }
};

function buildPrompt(mode, text, term, multiFile, fileCount) {
  const count = fileCount || 1;
  const docHeader = multiFile
    ? `El estudiante tiene ${count} archivo(s) para preparar su parcial. Cada archivo está separado por "===". Analizá TODO el contenido.\n\nCONTENIDO:\n"""\n${text}\n"""\n\n`
    : `Analizá el siguiente texto académico.\n\nTEXTO:\n"""\n${text}\n"""\n\n`;

  const nCards = Math.min(count * 8, 20);
  const nQuiz  = Math.min(count * 5, 14);

  const prompts = {

    resumen: docHeader +
`Generá un RESUMEN ACADÉMICO COMPLETO Y DETALLADO (mínimo 600 palabras).

Usá este formato exacto:

# [Título del tema]

## Introducción y Contexto
[3-4 oraciones sobre el contexto general]

## Temas Principales

### [Tema 1]
[Explicación de 4-5 oraciones con **conceptos clave en negrita**]

### [Tema 2]
[Ídem...]

[Seguí con TODOS los temas importantes del texto]

## Conceptos Clave
- **[Concepto]:** definición clara y completa
[Mínimo 8 conceptos]

## Conclusión
[3-4 oraciones de síntesis sobre la importancia del tema]`,

    flashcards: docHeader +
`Generá exactamente ${nCards} flashcards de alta calidad para preparar un parcial.

REGLAS:
- Pregunta clara y específica de nivel universitario
- Respuesta completa de 2-4 oraciones (NO una sola palabra)
- Cubrí los conceptos MÁS importantes
- Variá los tipos: definiciones, procesos, comparaciones, causas/efectos
${multiFile ? '- Distribuí las cards entre TODOS los archivos\n' : ''}
Respondé ÚNICAMENTE con JSON válido, sin texto ni backticks:
[{"front": "pregunta específica", "back": "respuesta completa de 2-4 oraciones"}, ...]`,

    quiz: docHeader +
`Generá ${nQuiz} preguntas de opción múltiple de nivel universitario.

REGLAS:
- Basate ESTRICTAMENTE en el contenido del texto
- Las 4 opciones deben ser plausibles
- Una sola correcta
- Explicación de 2-3 oraciones de por qué es correcta
${multiFile ? '- Cubrí contenido de TODOS los archivos\n' : ''}
Respondé ÚNICAMENTE con JSON válido:
[{"q": "pregunta", "opts": ["A","B","C","D"], "ans": 0, "explanation": "Porque..."}]`,

    conceptos: docHeader +
`Extraé los 15 conceptos más importantes para estudiar el parcial.

REGLAS:
- Priorizá términos técnicos, teorías y definiciones propias de la materia
- El contexto debe EXPLICAR el concepto claramente (no copiar el texto)
- Ordenados de mayor a menor importancia

Respondé ÚNICAMENTE con JSON válido:
[{"term": "Nombre del Concepto", "context": "Explicación de 2-3 oraciones"}, ...]`,

    plan: docHeader +
`Creá un PLAN DE ESTUDIO DETALLADO Y PRÁCTICO para preparar el parcial.

Requisitos:
- Específico para el contenido real del texto (mencioná temas concretos)
- Sesiones de 1-2 horas por día
- Actividades concretas, no genéricas
- Progresivo (de menor a mayor dificultad)

Formato:
## Día 1 — [Tema específico a cubrir]
**Duración:** X horas
**Objetivo:** [qué vas a lograr]
**Actividades:**
- [ ] [actividad específica basada en el contenido real]
- [ ] [actividad]
- [ ] [actividad]

[Continuá para 3-5 días según la cantidad de material]

## Repaso Final (día previo al parcial)
- [ ] Repasar flashcards de conceptos clave
- [ ] [actividad específica]
- [ ] Hacer el quiz de práctica

## Tips para este tema
[2-3 tips concretos basados en el contenido]`,

    chat: docHeader +
`El estudiante pregunta: "${term || '¿De qué trata el texto?'}"

Respondé de forma clara y educativa. Si la respuesta está en el texto, basate en él. Si no, respondé con tu conocimiento general. Sé directo y útil.`,

    drill: docHeader +
`El estudiante quiere profundizar en: "${term}"

Generá una explicación PROFUNDA Y DIDÁCTICA sobre este concepto.

## ¿Qué es ${term}?
[Definición completa - 3-4 oraciones]

## Contexto y Relevancia
[Por qué es importante en este tema]

## Explicación Detallada
[Desarrollo completo con todos los aspectos del texto]

## Ejemplos
[Ejemplos concretos del texto o que ilustren el concepto]

## Relación con otros conceptos del texto
[Cómo se conecta con otros temas]

## Para recordar en el parcial
[3 puntos clave]`
  };

  return prompts[mode] || prompts.chat;
}
