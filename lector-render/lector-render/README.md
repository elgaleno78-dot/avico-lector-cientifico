# Lector de artículos — versión para Render

Sube un PDF, sepáralo por secciones, tradúcelo y analízalo con Claude.

## Qué necesitas
1. Una cuenta en GitHub y otra en Render (render.com).
2. Una clave de la API de Anthropic, que se crea en console.anthropic.com. El uso de la API se cobra aparte de tu suscripción a claude.ai.

## Pasos
1. Crea un repositorio en GitHub y sube estos archivos: `server.js`, `package.json`, `render.yaml` y la carpeta `public/`.
2. En Render: **New → Web Service** y conecta el repositorio.
   - Runtime: Node
   - Build command: `echo "sin dependencias"`
   - Start command: `node server.js`
3. En **Environment**, agrega:
   - `ANTHROPIC_API_KEY` = tu clave (obligatoria)
   - `APP_PASSWORD` = una contraseña (muy recomendable: sin ella, cualquiera que tenga el enlace gasta tu saldo)
4. Pulsa Deploy y abre la URL que te da Render. La primera vez que uses Claude, la app te pedirá la contraseña.

## Opcional: elegir modelos
- `MODEL_QUICK` (por defecto `claude-haiku-5-5`): se usa para los títulos.
- `MODEL_DEFAULT` (por defecto `claude-sonnet-5-5`): se usa para traducir y resumir.
- `MODEL_COMPLEX` (por defecto `claude-sonnet-5-5`): se usa para el análisis crítico y las preguntas. Puedes ponerle `claude-opus-5-5` si quieres más profundidad, aunque cuesta más.

## Diferencias con la versión de claude.ai
- **Biblioteca:** se guarda en el navegador (localStorage). No se sincroniza entre dispositivos y se borra si limpias los datos del navegador. Usa **Descargar** para tener una copia.
- **Plan gratuito de Render:** el servicio se duerme tras unos minutos sin uso, así que la primera carga puede tardar entre 30 y 60 segundos.
