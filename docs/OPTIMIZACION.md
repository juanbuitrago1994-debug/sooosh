# Análisis de rendimiento: vistas, resultados y Supabase (26-nov-2026)

Medido, no supuesto: las cifras están en `docs/BENCHMARKS.md` («Rendimiento de las vistas y la base»).

## Qué se encontró
1. **El tiempo de cada vista es red, no consultas.** Un viaje a la base cuesta ~**150–200 ms** (Mac en Colombia → Supabase en São Paulo, por el pooler); las consultas tardan **~11 ms** dentro de la base. Una vista que hace 7 consultas SEGUIDAS espera ~1,2 s aunque cada una sea instantánea.
2. **La puerta de acceso gastaba 2 viajes en cada página**: la consulta del dispositivo y, después, la del perfil, más lo que hiciera la propia página. La verificación de la sesión de Supabase NO es el problema (las claves son ES256: se verifica sin red).
3. **La lista de una alerta hacía ~7 viajes seguidos** (puerta, alerta, marcar actividad, leer avisos, ver nuevas, títulos, tarjetas) y mientras tanto se quedaba en blanco (`fallback={null}`): lo que Juan vio como «demora mucho».
4. **La campana** (en todas las páginas) hacía 3 consultas (crear alerta inicial, no leídas, últimas 5) además de la puerta.
5. **La sincronización del CV** preguntaba a la cuenta en cada pantalla (2 viajes).
6. **El buscador** repetía consultas idénticas a la base y volvía a pedirle a Ollama el vector del mismo texto cada vez (0,4–0,9 s).
7. **El modo desarrollo** suma la compilación de cada ruta la primera vez (1,3–1,6 s medidos); en producción no existe.

## Qué se hizo (esta entrega)
| Cambio | Efecto |
|---|---|
| `getSession` (`lib/auth/session.ts`): una consulta trae dispositivo + perfil + «alerta inicial creada», y `cache` de React la comparte en toda la petición | −1 viaje por página; el menú de cuenta, la campana y las páginas ya no repiten nada |
| La campana: 1 consulta (últimas 5 + total sin leer con función de ventana); la alerta inicial solo se crea si la sesión dice que falta | 3 → 1 consulta |
| Lista de una alerta: lo independiente se pide a la vez; las ofertas que cumplen las condiciones salen de una memoria compartida de unos minutos (`use cache`, `lib/alerts/cached.ts`) | ~7 → 3 viajes seguidos (2 si la memoria está fresca) |
| `/notificaciones`: lectura de avisos, alertas y «actividad» a la vez | −1 viaje |
| Esqueletos (`ListSkeleton`) en alertas, notificaciones, mis ofertas y ajustes | la pantalla responde al instante en vez de quedarse en blanco |
| Sincronización del CV: no pregunta a la cuenta si ya quedó igual hace < 10 min en esa pestaña y el CV local no cambió | 0 consultas en la mayoría de pantallas |
| `/api/search`: memoria de 2 min (sin el CV de por medio) y vector del texto en memoria 30 min (`lib/util/memo.ts`) | 0,4–0,9 s → ~8 ms en repeticiones |

## Lo que más ayudaría y no se hizo (recomendado, en orden)
1. **Poner la app en la misma región que la base (São Paulo, `gru1`) al desplegar.** Entre servidor y base el viaje pasa de ~150 ms a unos pocos ms: TODAS las vistas ganan 1 s o más. Es la mayor mejora y no requiere cambiar código (solo elegir la región de las funciones). Desde casa en modo desarrollo seguirás pagando los ~150 ms por viaje, así que localmente parecerá más lento que en producción.
2. **Reducir viajes seguidos en la página de inicio** (puerta de acceso + sincronización del CV + campana): hoy el contenido espera a la puerta. Se puede dejar pasar el esqueleto de la página mientras se verifica (la protección real sigue en cada acción y en el proxy).
3. **Un solo viaje para el seguimiento** al guardar desde el buscador (hoy: ver si existe, contar, insertar).
4. **Caché HTTP** para listas públicas con `GET` (hoy la búsqueda es `POST`, no se puede cachear en el borde).
5. **Índices**: el asesor de Supabase marca como «sin uso» `jobs_regions_idx`, `jobs_skills_idx`, `jobs_embedding_idx`, `jobs_dedupe_key_idx`, `tracked_offers_due_idx`, `tracked_offers_collection_idx` y `alerts_enabled_idx`. Con 4.822 ofertas Postgres prefiere recorrer la tabla (10 ms); **no conviene borrarlos**, se usarán al crecer. Revisar cuando haya ~50.000 ofertas.
6. **Pooler**: el límite de 5 conexiones (`max: 5`) y `max_pipeline: 1` (ver nota del pooler) hacen que consultas en paralelo se encolen un poco; subir `max` solo si se ven esperas.

## Cómo se mide de nuevo
Las consultas y la red: ver «Rendimiento de las vistas y la base» en `docs/BENCHMARKS.md` (viaje a la base, `explain analyze`, peso de las tarjetas, `/api/search` repetido). Regla: contar los viajes SEGUIDOS de una vista y paralelizar o fusionar lo independiente antes de optimizar una consulta.
