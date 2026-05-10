// StudyHub AI Proxy — Vercel Serverless Function
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const MAX_CHARS = 90000;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({
    error: 'GEMINI_API_KEY no configurada. Ve a Vercel → tu proyecto → Settings → Environment Variables y agregala para Production.'
  });

  try {
    const { text, mode, term, multiFile, fileCount } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Falta el texto del documento' });

    const prompt = buildPrompt(mode, text.slice(0, MAX_CHARS), term, multiFile, fileCount || 1);

    const geminiRes = await fetch(GEMINI_URL + '?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192, topP: 0.9 },
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
      const msg = err.error?.message || '';
      if (msg.includes('API_KEY') || geminiRes.status === 400) {
        return res.status(400).json({ error: 'API Key de Gemini invalida o expirada. Genera una nueva en aistudio.google.com' });
      }
      return res.status(geminiRes.status).json({ error: 'Error Gemini ' + geminiRes.status + ': ' + msg });
    }

    const data = await geminiRes.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!result) return res.status(500).json({ error: 'Gemini no devolvio respuesta. Intenta de nuevo.' });

    return res.status(200).json({ result, mode });

  } catch (e) {
    return res.status(500).json({ error: 'Error interno: ' + (e.message || 'desconocido') });
  }
};

function buildPrompt(mode, text, term, multiFile, fileCount) {
  const base = multiFile
    ? `Sos un asistente educativo universitario argentino. El estudiante tiene ${fileCount} archivo(s) para estudiar para un parcial. Analiza TODO el contenido y responde en espanol rioplatense (vos/tu).

CONTENIDO DE LOS ARCHIVOS:
"""
${text}
"""

`
    : `Sos un asistente educativo universitario argentino. Analiza el siguiente texto academico y responde en espanol rioplatense (vos/tu).

TEXTO:
"""
${text}
"""

`;

  const nCards = Math.min((fileCount || 1) * 8, 20);
  const nQuiz = Math.min((fileCount || 1) * 5, 14);

  const prompts = {
    resumen: base + `Tarea: Genera un RESUMEN ACADEMICO COMPLETO Y DETALLADO.

REQUISITOS OBLIGATORIOS:
- El resumen debe ser EXTENSO (minimo 600 palabras)
- Cubre TODOS los temas importantes del texto
- Usa lenguaje academico claro
- Incluye ejemplos y explicaciones cuando el texto los mencione

Formato EXACTO a usar:

# [Titulo del tema principal]

## Introduccion y Contexto
[Parrafo explicando el contexto general del tema - 3-4 oraciones]

## Temas Principales

### [Tema 1]
[Explicacion detallada de 3-5 oraciones con conceptos clave en **negrita**]

### [Tema 2]
[Explicacion detallada de 3-5 oraciones]

[Continua con todos los temas importantes...]

## Conceptos Clave
- **[Concepto 1]:** definicion clara
- **[Concepto 2]:** definicion clara
[Minimo 8 conceptos]

## Conclusion
[Sintesis final de 3-4 oraciones explicando la importancia del tema]`,

    flashcards: base + `Tarea: Genera exactamente ${nCards} flashcards de estudio de alta calidad para preparar un parcial.

REGLAS ESTRICTAS:
- La PREGUNTA debe ser especifica, clara y de nivel universitario
- La RESPUESTA debe ser COMPLETA y EDUCATIVA (minimo 2-3 oraciones, no solo una palabra)
- Cubre los conceptos MAS IMPORTANTES del texto
- Varia los tipos: definiciones, procesos, comparaciones, causas/efectos, ejemplos
- NO repitas conceptos similares
${multiFile ? '- Distribuye las cards entre TODOS los archivos proporcionalmente
' : ''}
Responde UNICAMENTE con JSON valido, sin texto adicional ni backticks:
[
  {"front": "pregunta clara especifica", "back": "respuesta completa y educativa de 2-3 oraciones"},
  ...
]`,

    quiz: base + `Tarea: Genera ${nQuiz} preguntas de opcion multiple de nivel universitario para un parcial.

REGLAS:
- Basate ESTRICTAMENTE en el contenido del texto
- Las 4 opciones deben ser plausibles y relevantes (no poner respuestas obviamente incorrectas)
- Una sola respuesta correcta
- Incluye explicacion de por que es correcta (2-3 oraciones)
- Varia la dificultad: algunas directas, algunas que requieren razonamiento
${multiFile ? '- Cubre contenido de TODOS los archivos
' : ''}
Responde UNICAMENTE con JSON valido:
[
  {
    "q": "pregunta completa",
    "opts": ["opcion A", "opcion B", "opcion C", "opcion D"],
    "ans": 0,
    "explanation": "La respuesta correcta es A porque... [explicacion de 2-3 oraciones]"
  }
]`,

    conceptos: base + `Tarea: Extrae los 15 conceptos mas importantes del texto para estudiar.

REGLAS:
- Prioriza terminos tecnicos, teorias, autores, y definiciones propias de la materia
- El contexto debe EXPLICAR el concepto en lenguaje claro (no copiar el texto)
- Ordenados de mayor a menor importancia para el parcial

Responde UNICAMENTE con JSON valido:
[{"term": "Nombre del Concepto", "context": "Explicacion clara de 2-3 oraciones sobre que es y por que importa para la materia"}, ...]`,

    plan: base + `Tarea: Crea un PLAN DE ESTUDIO DETALLADO Y PRACTICO para preparar el parcial con este material.

El plan debe ser:
- Especifico para el contenido real del texto (menciona temas concretos)
- Realista en tiempos (sesiones de 1-2 horas)
- Progresivo (de menor a mayor dificultad)
- Con actividades concretas (no genericas)

Formato:
## Dia 1 — [Tema principal a cubrir]
**Duracion:** X horas
**Objetivo:** [que vas a lograr]
**Actividades:**
- [ ] [actividad especifica basada en el contenido]
- [ ] [actividad]
- [ ] [actividad]

[Continua para cada dia necesario, tipicamente 3-5 dias]

## Repaso Final (dia previo al parcial)
**Duracion:** 1-2 horas
- [ ] [actividad de repaso especifica]
- [ ] Repasar flashcards de conceptos clave
- [ ] Hacer el quiz de practica

## Tips especificos para este tema
[2-3 tips concretos basados en el contenido]`,

    chat: base + `El estudiante te hace la siguiente pregunta:
"${term || 'Contame sobre el tema principal'}"

INSTRUCCIONES:
- Responde basandote en el contenido del texto
- Si la pregunta no esta directamente en el texto, usa el contexto del texto para responder lo mejor posible
- Si la pregunta es completamente ajena al texto, respondela igualmente con tu conocimiento general
- Se claro, directo y educativo
- Usa ejemplos del texto cuando sea relevante
- Longitud apropiada a la complejidad de la pregunta (puede ser corta o larga)`,

    drill: base + `El estudiante quiere profundizar en el concepto: "${term}"

Genera una explicacion PROFUNDA, DIDACTICA y COMPLETA sobre "${term}" basada en el texto.

Estructura tu respuesta asi:

## ¿Que es ${term}?
[Definicion clara y completa - 3-4 oraciones]

## Contexto y Relevancia
[Por que es importante en este tema - 2-3 oraciones]

## Explicacion Detallada
[Desarrollo completo del concepto con todos los aspectos que menciona el texto]

## Ejemplos
[Ejemplos concretos del texto o que ilustren el concepto]

## Relacion con otros conceptos
[Como se relaciona con otros temas del texto]

## Para recordar
[2-3 puntos clave para el parcial]`
  };

  return prompts[mode] || prompts.chat;
}
