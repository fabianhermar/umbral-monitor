export type GlossaryGroup =
  | "estados"
  | "brujula"
  | "incidencias"
  | "perimetro"
  | "telemetria"
  | "seguridad";

export interface GlossaryEntry {
  key: string;
  term: string;
  shortTag?: string;
  group: GlossaryGroup;
  accent?: string;
  summary: string;
  details: string;
}

export const GLOSSARY_GROUPS: Array<{ id: GlossaryGroup | "all"; label: string }> = [
  { id: "all", label: "Todo" },
  { id: "estados", label: "Estados" },
  { id: "brujula", label: "Brújula (UP / HDR / DEF)" },
  { id: "incidencias", label: "Incidencias" },
  { id: "perimetro", label: "Perímetro y WAF" },
  { id: "telemetria", label: "Telemetría (P50 / P95)" },
  { id: "seguridad", label: "Arquitectura UMBRAL" },
];

export const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  // ==================== ESTADOS ====================
  {
    key: "status-up",
    term: "OPERATIVO",
    shortTag: "Estado del dominio",
    group: "estados",
    accent: "var(--signal-mint)",
    summary: "Tu página responde correctamente y dentro del tiempo esperado.",
    details:
      "El chequeo HTTP devolvió un código esperado (200, 204, 301 o 302), la latencia está por debajo del umbral de aviso (2500 ms) y no existen ataques críticos activos en este momento.",
  },
  {
    key: "status-degraded",
    term: "DEGRADADO",
    shortTag: "Estado del dominio",
    group: "estados",
    accent: "var(--signal-ochre)",
    summary: "El sitio funciona con lentitud elevada o tuvo 1 fallo puntual.",
    details:
      "Aparece cuando la respuesta supera los 2500 ms o cuando ocurre un único fallo aislado (todavía sin cumplir los 2 fallos consecutivos necesarios para declararlo CAÍDO). Sirve como alerta temprana antes de una caída real.",
  },
  {
    key: "status-down",
    term: "CAÍDO",
    shortTag: "Estado del dominio",
    group: "estados",
    accent: "var(--signal-crimson)",
    summary: "El sitio dejó de responder en 2 o más chequeos consecutivos.",
    details:
      "Se activa tras confirmar al menos 2 fallos seguidos (timeout > 10s, error de red, error 5xx de Vercel o 52x de Cloudflare). Abre automáticamente una incidencia CRÍTICA y envía alerta inmediata si tienes Telegram/Discord configurado. Se cierra sola cuando el sitio vuelve a responder.",
  },
  {
    key: "status-under_attack",
    term: "BAJO ATAQUE",
    shortTag: "Estado del dominio",
    group: "estados",
    accent: "var(--signal-vermilion)",
    summary: "Tu web sigue en línea, pero está recibiendo un ataque activo mitigado.",
    details:
      "Indica que el dominio tiene una incidencia abierta de categoría ATAQUE con severidad Alta o Crítica (por ejemplo, mitigación DDoS L7 de Cloudflare o un pico fuerte de bloqueos WAF).",
  },
  {
    key: "status-unknown",
    term: "SIN SEÑAL",
    shortTag: "Estado del dominio",
    group: "estados",
    accent: "var(--ink-muted)",
    summary: "Todavía no se ha ejecutado ningún chequeo para este sitio.",
    details:
      "Es el estado inicial antes del primer escaneo. Pulsa «Ejecutar escaneo» o espera al siguiente minuto del Cron automático de Cloudflare.",
  },

  // ==================== BRÚJULA ====================
  {
    key: "perimeter-score",
    term: "SCORE / 100 (Índice Perimetral)",
    shortTag: "Fórmula compuesta",
    group: "brujula",
    accent: "var(--ink-primary)",
    summary: "Calificación global de salud y seguridad de tus sitios (0 a 100).",
    details:
      "Combina los tres arcos de la brújula con esta ponderación exacta: 45% Disponibilidad (UP) + 25% Cabeceras de Seguridad (HDR) + 30% Calma Operativa / Defensa (DEF). Un puntaje ≥ 90 significa operación óptima.",
  },
  {
    key: "metric-up",
    term: "UP — Disponibilidad (24h)",
    shortTag: "Arco exterior · Verde",
    group: "brujula",
    accent: "var(--signal-mint)",
    summary: "Porcentaje de chequeos exitosos en las últimas 24 horas.",
    details:
      "Se calcula dividiendo los chequeos HTTP exitosos entre el total de chequeos realizados cada minuto desde Cloudflare Edge. Al correr fuera de Vercel, sigue midiendo incluso si Vercel sufre una caída.",
  },
  {
    key: "metric-hdr",
    term: "HDR — Higiene de Cabeceras HTTP",
    shortTag: "Arco intermedio · Azul",
    group: "brujula",
    accent: "var(--signal-cobalt)",
    summary: "Evalúa si tus páginas envían las 4 cabeceras clave de seguridad web.",
    details:
      "Cada chequeo audita 4 cabeceras defensivas: Strict-Transport-Security (HSTS), Content-Security-Policy (CSP), X-Content-Type-Options y X-Frame-Options (o frame-ancestors en CSP). Cada cabecera ausente resta 25 puntos sobre 100.",
  },
  {
    key: "metric-def",
    term: "DEF — Índice de Defensa y Calma",
    shortTag: "Arco interior · Bermellón",
    group: "brujula",
    accent: "var(--signal-vermilion)",
    summary: "Mide qué tan libre de incidencias activas está tu perímetro ahora mismo.",
    details:
      "Parte de 100 puntos y descuenta 28 puntos por cada incidencia CRÍTICA activa y 8 puntos por cada incidencia abierta de menor severidad. Al resolver las incidencias, DEF vuelve automáticamente a 100%.",
  },

  // ==================== INCIDENCIAS ====================
  {
    key: "cat-downtime",
    term: "CAÍDA (downtime)",
    shortTag: "Categoría",
    group: "incidencias",
    accent: "var(--signal-crimson)",
    summary: "Indisponibilidad del sitio, timeouts, errores 5xx/52x o latencia alta.",
    details:
      "Detectada por el monitor cada minuto o por picos de respuestas 5xx en Cloudflare. Incluye tanto caídas totales (Crítica) como latencia sostenida superior a 2500 ms (Media).",
  },
  {
    key: "cat-attack",
    term: "ATAQUE (attack)",
    shortTag: "Categoría",
    group: "incidencias",
    accent: "var(--signal-vermilion)",
    summary: "Intentos hostiles detectados o mitigados (DDoS, WAF, escaneos).",
    details:
      "Se genera cuando Cloudflare mitiga un ataque DDoS L7 o cuando los eventos de firewall superan el umbral configurado en 5 minutos (ej. bots buscando /.env, /wp-login.php, SQLi o XSS).",
  },
  {
    key: "cat-block",
    term: "BLOQUEO (block)",
    shortTag: "Categoría",
    group: "incidencias",
    accent: "var(--signal-ochre)",
    summary: "Tráfico frenado por exceso de peticiones (Rate Limit) o fuerza bruta.",
    details:
      "Registra bloqueos HTTP 429/403 originados por reglas de Rate Limiting de Cloudflare o por tu propio middleware en Vercel al detener intentos repetidos de login o abuso de APIs.",
  },
  {
    key: "cat-security",
    term: "SEGURIDAD (security)",
    shortTag: "Categoría",
    group: "incidencias",
    accent: "var(--signal-cobalt)",
    summary: "Debilidades de configuración defensiva detectadas en tus sitios.",
    details:
      "Por ejemplo, ausencia de cabeceras HTTP de protección (CSP, HSTS, X-Content-Type-Options, X-Frame-Options) o alertas de postura de seguridad enviadas por tu app.",
  },
  {
    key: "cat-error",
    term: "ERROR APP (error)",
    shortTag: "Categoría",
    group: "incidencias",
    accent: "#e879f9",
    summary: "Excepciones 500 o fallos internos reportados desde tu código en Vercel.",
    details:
      "Enviados en tiempo real usando sdk/vercel-monitor.ts (reportAppError). Incluye ruta, método HTTP, mensaje de error y traza resumida.",
  },
  {
    key: "cat-deployment",
    term: "DEPLOY (deployment)",
    shortTag: "Categoría",
    group: "incidencias",
    accent: "var(--signal-mint)",
    summary: "Despliegues fallidos o cancelados en tus proyectos de Vercel.",
    details:
      "El Worker consulta la API de Vercel cada 5 minutos para tus projectId. Si el último build termina en ERROR o CANCELED abre una incidencia; cuando un nuevo despliegue llega a READY se resuelve sola.",
  },
  {
    key: "occurrences-fingerprint",
    term: "Ocurrencias (×N) y Fingerprint",
    shortTag: "Deduplicación inteligente",
    group: "incidencias",
    accent: "var(--signal-vermilion)",
    summary: "Agrupa eventos repetidos en una sola incidencia para evitar ruido.",
    details:
      "Si una misma IP ataca 50 veces en 5 minutos, UMBRAL usa una huella única (fingerprint) para actualizar la misma incidencia e incrementar ×50 en lugar de llenar tu pantalla con 50 alertas duplicadas.",
  },
  {
    key: "incident-lifecycle",
    term: "Estados: Abierta · Investigando · Resuelta",
    shortTag: "Ciclo de vida",
    group: "incidencias",
    accent: "var(--ink-secondary)",
    summary: "Seguimiento manual y automático de cada incidencia.",
    details:
      "Abierta = requiere atención. Investigando = ya la estás revisando (evita confusión). Resuelta = cerrada (manualmente desde el inspector o automáticamente cuando el monitor verifica recuperación).",
  },

  // ==================== PERÍMETRO Y WAF ====================
  {
    key: "waf-block",
    term: "Acción: block",
    shortTag: "Cloudflare WAF",
    group: "perimetro",
    accent: "var(--signal-crimson)",
    summary: "Petición rechazada inmediatamente antes de llegar a Vercel.",
    details:
      "Cloudflare cortó la conexión en el borde (HTTP 403) porque coincidió con una regla WAF, lista de bloqueo o mitigación DDoS. Tu servidor en Vercel ni siquiera consumió recursos.",
  },
  {
    key: "waf-challenge",
    term: "Acción: managed_challenge / jschallenge",
    shortTag: "Cloudflare Bot Defense",
    group: "perimetro",
    accent: "var(--signal-ochre)",
    summary: "Reto automático para distinguir humanos reales de bots maliciosos.",
    details:
      "Cloudflare presenta una verificación invisible o interactiva (Turnstile/JS). Los navegadores legítimos pasan sin fricción y los scripts automatizados quedan bloqueados.",
  },
  {
    key: "waf-ratelimit",
    term: "Acción: rate_limit",
    shortTag: "Protección anti-abuso",
    group: "perimetro",
    accent: "var(--signal-vermilion)",
    summary: "Bloqueo temporal por superar el límite de peticiones por minuto.",
    details:
      "Frena ataques de fuerza bruta en formularios, logins o endpoints API devolviendo HTTP 429 Too Many Requests.",
  },
  {
    key: "cf-52x",
    term: "Códigos Cloudflare 520–526 / 530",
    shortTag: "Errores de origen",
    group: "perimetro",
    accent: "var(--signal-crimson)",
    summary: "Indican que Cloudflare está activo, pero falló la comunicación con Vercel.",
    details:
      "520 = respuesta inesperada de origen; 521 = origen rechazó conexión; 522 = timeout conectando a Vercel; 524 = Vercel tardó demasiado en responder; 525/526 = error de certificado SSL entre Cloudflare y Vercel.",
  },
  {
    key: "cf-vercel-sync",
    term: "CF SYNC / VERCEL SYNC",
    shortTag: "Conectores de cada dominio",
    group: "perimetro",
    accent: "var(--signal-mint)",
    summary: "Indica si el dominio tiene vinculado su Zone ID y Project ID.",
    details:
      "CF SYNC significa que el sitio tiene cloudflareZoneId en config/sites.config.ts para importar eventos WAF/DDoS cada 5 min. VERCEL READY/ERROR muestra el estado real del último despliegue en Vercel.",
  },

  // ==================== TELEMETRÍA ====================
  {
    key: "signal-strip",
    term: "Tira de 24 pulsos",
    shortTag: "Historial rápido",
    group: "telemetria",
    accent: "var(--signal-mint)",
    summary: "Últimos 24 chequeos cronológicos de cada sitio.",
    details:
      "Cada barra vertical es un chequeo individual: verde = OK rápido, ámbar = OK lento (> 2000 ms), rojo = fallo/caída. La altura de la barra representa proporcionalmente la latencia medida.",
  },
  {
    key: "metric-p50",
    term: "P50 (Mediana de latencia)",
    shortTag: "Telemetría",
    group: "telemetria",
    accent: "var(--ink-primary)",
    summary: "Tiempo de respuesta típico: la mitad de las peticiones son más rápidas.",
    details:
      "Es mucho más fiel que el promedio simple porque no se distorsiona por un pico aislado. Si P50 es 140 ms, la experiencia habitual de tus visitantes es muy fluida.",
  },
  {
    key: "metric-p95",
    term: "P95 (Percentil 95)",
    shortTag: "Telemetría",
    group: "telemetria",
    accent: "var(--signal-ochre)",
    summary: "El 95% de las respuestas fueron más rápidas que este valor.",
    details:
      "Sirve para detectar lentitud intermitente o arranques en frío (cold starts) de funciones serverless en Vercel que el promedio suele ocultar.",
  },
  {
    key: "metric-max-fails",
    term: "Pico Máximo y Fallos",
    shortTag: "Telemetría",
    group: "telemetria",
    accent: "var(--signal-crimson)",
    summary: "Muestra el peor tiempo registrado y cuántas pruebas fallaron.",
    details:
      "Calculados sobre la ventana seleccionada (6H, 24H o 72H). Te permite identificar rápidamente si hubo una congestión puntual o cortes repetidos.",
  },

  // ==================== SEGURIDAD UMBRAL ====================
  {
    key: "allowlist-strict",
    term: "Lista Blanca Exclusiva",
    shortTag: "Cierre a tus dominios",
    group: "seguridad",
    accent: "var(--signal-vermilion)",
    summary: "UMBRAL solo funciona con los dominios declarados en código.",
    details:
      "No existe ninguna API pública para registrar sitios externos. Tanto los chequeos de uptime como Cloudflare GraphQL, Vercel API y /api/ingest rechazan con HTTP 403 cualquier dominio fuera de config/sites.config.ts.",
  },
  {
    key: "hmac-ingest",
    term: "Firma HMAC-SHA256 + Anti-Replay",
    shortTag: "Autenticación de eventos",
    group: "seguridad",
    accent: "var(--signal-mint)",
    summary: "Garantiza que los eventos de tus apps realmente vienen de tus servidores.",
    details:
      "Cada proyecto en Vercel firma el payload con su secreto exclusivo (SITE_SECRETS_JSON) + timestamp actual. Si la firma no coincide o tiene más de 5 minutos de antigüedad, el Worker la rechaza con HTTP 401.",
  },
  {
    key: "auth-modes",
    term: "CF ACCESS · API KEY · ENTORNO LOCAL",
    shortTag: "Acceso al dashboard",
    group: "seguridad",
    accent: "var(--signal-cobalt)",
    summary: "Indica cómo está protegida tu sesión actual en UMBRAL.",
    details:
      "CF ACCESS (recomendado en producción) valida tu correo mediante Cloudflare Zero Trust antes de abrir la página. API KEY exige tu clave privada. ENTORNO LOCAL solo opera en tu computadora durante desarrollo.",
  },
];

const ENTRY_MAP = new Map<string, GlossaryEntry>(
  GLOSSARY_ENTRIES.map((entry) => [entry.key, entry])
);

export function getGlossaryEntry(key: string): GlossaryEntry | undefined {
  return ENTRY_MAP.get(key);
}
