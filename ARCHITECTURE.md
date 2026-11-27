# Guía de Arquitectura y Seguridad de UMBRAL

Este documento explica cómo está organizado **UMBRAL** para que cualquier desarrollador (**Junior, Mid o Senior**) pueda ubicarse en minutos, entender el flujo de extremo a extremo y extender el proyecto sin romper su modelo de seguridad.

---

## 1. Principio fundamental: separación de responsabilidades

Ningún archivo mezcla responsabilidades distintas:

* **Backend (`worker/`):** Sigue una arquitectura en capas (`Routes → Middlewares / Validators → Services → Repositories → D1`).
  * Las **rutas (`routes/`)** solo leen parámetros HTTP y devuelven JSON. Nunca contienen SQL ni lógica compleja.
  * Los **servicios (`services/`)** contienen las reglas del negocio (cómo agrupar incidencias repetidas, cuándo escalar severidad, cuándo enviar alertas a Telegram/Discord).
  * Los **repositorios (`repositories/`)** contienen exclusivamente sentencias SQL parametrizadas (`?`) sobre Cloudflare D1.
  * Los **recolectores (`collectors/`)** se ejecutan automáticamente por reloj (`Cron Triggers`) para consultar tus dominios, Cloudflare GraphQL y Vercel REST API.
* **Frontend (`src/`):** Separa estado y lógica de presentación (`Services → Hooks → Domain Components`).
  * Los componentes visuales en `src/components/*` solo reciben propiedades (`props`) y pintan la interfaz; toda la carga de datos, temporizadores y sesión viven en `src/hooks/useDashboardData.ts`.

---

## 2. Mapa rápido: "¿Dónde toco si quiero cambiar X?"

| Si quieres... | Archivo exacto |
| :--- | :--- |
| Agregar o editar uno de tus dominios propios | `config/sites.config.ts` |
| Ajustar tiempos límite, umbrales o la cabecera CSP | `worker/constants/security.ts` |
| Cambiar cómo se detecta una caída o qué cabeceras se auditan | `worker/collectors/uptime.collector.ts` |
| Ajustar reglas al importar ataques WAF/DDoS desde Cloudflare | `worker/collectors/cloudflare.collector.ts` |
| Modificar el formato del mensaje de Telegram o Discord | `worker/services/alerts.service.ts` |
| Añadir un nuevo término o explicación al glosario del dashboard | `src/constants/glossary.ts` |
| Ajustar colores de los temas Obsidiana (oscuro) o Alabastro (claro) | `src/styles/index.css` |

---

## 3. Controles de seguridad implementados

1. **Lista blanca inmutable (`worker/security/allowlist.ts`):**
   Rechaza cualquier `siteId`, `zoneId` o `host` que no pertenezca a `config/sites.config.ts`.
2. **Verificación criptográfica real de Cloudflare Access (`worker/security/cf-access-jwt.ts`):**
   No confía ciegamente en las cabeceras HTTP `Cf-Access-*`: descarga las llaves públicas RSA (`JWKS`) de tu dominio Zero Trust y verifica firma `RS256`, `iss`, `aud` y `exp`.
3. **Comparación de secretos sin fuga de longitud (`worker/security/crypto.ts`):**
   Hashea ambos valores con `SHA-256` (32 bytes fijos) antes de invocar `crypto.subtle.timingSafeEqual`, evitando ataques de temporización (*timing attacks*).
4. **Doble protección Anti-Replay en `/api/ingest` (`worker/security/replay-guard.ts`):**
   Exige `x-timestamp` dentro de ±5 minutos **y** registra cada firma HMAC consumida para rechazar duplicados con `HTTP 409`.
5. **Sanitización y Anti-Prototype Pollution (`worker/validators/ingest.validator.ts`):**
   Elimina claves peligrosas (`__proto__`, `constructor`, `prototype`), caracteres de control ASCII y limita profundidad/tamaño de JSON.
6. **Rate Limiting en memoria (`worker/middlewares/rate-limit.ts`):**
   Frena intentos repetidos de fuerza bruta sobre `DASHBOARD_API_KEY`, inundaciones a `/api/ingest` y clics excesivos en el botón de escaneo manual.
7. **Cabeceras HTTP defensivas propias (`worker/middlewares/security-headers.ts` y `public/_headers`):**
   Aplica `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy` y `Permissions-Policy`.
