# StudyHub — Deploy en Vercel (10 minutos, gratis)

## Qué hace esto
Tu API Key de Gemini vive **solo en el servidor de Vercel**.
El frontend llama a `/api/ai` — nunca ve la clave.

---

## Paso 1 — Conseguí la API Key de Gemini (gratis)

1. Abrí: https://aistudio.google.com/app/apikey
2. Iniciá sesión con tu cuenta Google
3. Clic en **"Create API key"**
4. Copiá la clave (empieza con `AIza...`)

**Límite gratuito:** 1.500 requests/día, 1 millón de tokens/día — más que suficiente para estudiar.

---

## Paso 2 — Subí el proyecto a GitHub

1. Creá una cuenta en https://github.com (si no tenés)
2. Clic en **"New repository"** → llamalo `studyhub` → público → Create
3. En tu PC, abrí una terminal en la carpeta `studyhub-vercel/`:

```bash
git init
git add .
git commit -m "StudyHub inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/studyhub.git
git push -u origin main
```

> Si no tenés Git instalado: descargalo de https://git-scm.com

---

## Paso 3 — Deploy en Vercel

1. Abrí: https://vercel.com → **"Sign up with GitHub"**
2. Clic en **"Add New Project"**
3. Importá el repo `studyhub`
4. En la pantalla de configuración:
   - Framework Preset: **Other**
   - Root Directory: **./** (dejalo como está)
5. Abrí **"Environment Variables"** y agregá:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** tu clave que copiaste en el Paso 1
6. Clic en **"Deploy"** → esperar ~1 minuto

---

## Paso 4 — Usarlo

Vercel te da una URL tipo: `https://studyhub-xxx.vercel.app`

- Abrí esa URL desde cualquier dispositivo
- Ingresá tu URL de Moodle y token
- El botón ✨ IA ahora usa Gemini sin pedir ninguna clave

### Opción: dominio personalizado
En Vercel → Settings → Domains → podés agregar un dominio propio gratis.

---

## Actualizar la app

Si modificás algo y querés actualizar:

```bash
git add .
git commit -m "actualización"
git push
```

Vercel redeploya automáticamente en ~30 segundos.

---

## Estructura del proyecto

```
studyhub-vercel/
├── index.html        ← Frontend completo
├── api/
│   └── ai.js         ← Serverless function (proxy con API Key)
├── vercel.json       ← Configuración de rutas
├── package.json      ← Metadata del proyecto
└── README.md         ← Este archivo
```

---

## Preguntas frecuentes

**¿Puedo seguir usando el archivo HTML directamente?**
Sí, pero sin la IA de Gemini (el botón ✨ dará error porque no hay servidor). Para uso local la IA local (extractiva) sigue funcionando en la versión `StudyHub.html`.

**¿Me cobran algo?**
No. Vercel tiene un plan gratuito generoso (100GB bandwidth/mes, funciones serverless ilimitadas para proyectos personales). Gemini también tiene free tier.

**¿Es segura mi API Key?**
Sí. Está en las variables de entorno de Vercel, nunca aparece en el código ni en el navegador. Solo el servidor la usa para llamar a Gemini.
