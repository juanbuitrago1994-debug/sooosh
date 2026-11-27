# Investigación: secciones de «Your resume» (27-nov-2026)

Objetivo: decidir qué secciones tendrá el perfil profesional editable en la app antes de planear la vista.
Estado: **propuesta por aprobar** (no hay código todavía).

## 1. Lo que ya tenemos

- Esquema `lib/schemas/cv.ts`: `header` (nombre, titular, correo, teléfono, ubicación, enlaces), `summary`, `experience`, `education`, `skills` (grupos), `languages`, `projects`, más `sectionOrder`.
- Formulario manual `components/cv/cv-form.tsx` + `form-parts.tsx` (`Section`, `EntryList`, `TextField`, `StringList`, `TagsField`).
- CV validado guardado en la cuenta (`cvs.cv`, jsonb; `lib/cv-store/store.ts`). Sección «Ajustes» con el patrón título a la izquierda / formulario a la derecha (`components/settings/settings-section.tsx`).
- `lib/cv/sections.ts` ya **reconoce** encabezados que el esquema no guarda: certificaciones, cursos, voluntariado, publicaciones, premios, referencias, intereses, información personal. Hoy caen en «other» y se pierden.

## 2. Qué muestran los CV de prueba (`Pruebas VC/`, 49 archivos)

Encabezados contados en los .docx:

| Encabezado | Veces |
|---|---|
| Perfil profesional / Professional Summary | 23 |
| Habilidades / Skills | 23 |
| Experiencia laboral / Work Experience | 23 |
| Proyectos destacados / Selected Projects | 23 |
| Formación académica / Education | 23 |
| **Voluntariado / Volunteering** | **16** |
| **Certificaciones y cursos** | **2** |

Conclusión: el esquema cubre 5 de 7; **voluntariado y certificaciones aparecen en los CV reales y hoy no tienen dónde vivir**. Idiomas suele ir como línea dentro de Habilidades.

## 3. Qué dicen las fuentes externas

- **ATS** (Enhancv, Kickresume, Toptal, Buffalo, Novoresume): usar encabezados convencionales (Professional Summary, Work Experience, Education, Skills, Certifications, Projects); una sola columna; contacto arriba y enlaces en texto plano; cronología inversa; explicar siglas. Orden según etapa: recién graduado → Educación primero; con experiencia → Experiencia primero; técnico → Habilidades/Proyectos pueden subir.
- **LinkedIn** (ayuda y guías): About, Experience, Education, Licenses & certifications, Skills, Languages, Volunteer experience, Publications, Honors & awards, Projects, Organizations, Patents, Test scores. Cada entrada = título, organización, fechas y descripción; el resto son extras.
- **JSON Resume / Reactive Resume** (estándares abiertos): basics, work, volunteer, education, awards, certificates, publications, skills, languages, interests, references, projects. Es la lista «cerrada» más aceptada: sirve de referencia para no inventar secciones.
- **Por perfil**:
  - *Tecnología*: GitHub/portafolio en contacto; habilidades agrupadas (lenguajes, frameworks, nube); proyectos con tecnologías y enlace; certificaciones (AWS, Google, etc.); opcional publicaciones/charlas para perfiles senior.
  - *Diseño*: portafolio y Behance/Dribbble/Figma como enlaces obligatorios; casos de estudio (= nuestros proyectos con rol, impacto y enlace); herramientas; certificaciones y premios opcionales.
  - *Marketing*: resultados con cifras por campaña/canal; herramientas (GA4, HubSpot, Meta Ads); certificaciones de plataforma (Google, HubSpot, Meta Blueprint); portafolio o casos; idiomas.

## 4. Propuesta de secciones

Principio: **el estándar de ATS manda y lo opcional aparece solo si la persona lo agrega.** Ninguna sección es obligatoria salvo datos de contacto y nombre.

| # | Sección | Estado en el esquema | Obligatoria | Notas |
|---|---|---|---|---|
| 1 | Datos personales (nombre, titular, correo, teléfono, ciudad, enlaces) | existe (`header`) | sí | Enlaces con etiqueta: LinkedIn, portafolio, GitHub, Behance… |
| 2 | Resumen profesional | existe (`summary`) | no | |
| 3 | Experiencia laboral | existe | no (recién graduados) | |
| 4 | Educación | existe | no | |
| 5 | Habilidades (por grupos) | existe | no | |
| 6 | Idiomas | existe | no | |
| 7 | Proyectos / casos de estudio | existe | no | Se reutiliza para diseño y tecnología |
| 8 | **Certificaciones y cursos** | **nueva** | no | nombre, entidad, fecha, enlace de credencial |
| 9 | **Voluntariado** | **nueva** | no | organización, rol, fechas, viñetas |
| 10 | **Premios y reconocimientos** | **nueva (opcional)** | no | nombre, entidad, fecha |
| 11 | **Publicaciones y charlas** | **nueva (opcional)** | no | título, medio/evento, fecha, enlace |

**Fuera de alcance a propósito**: foto, edad, estado civil, documento de identidad (riesgo de sesgo y de privacidad; los ATS y la guía `CONOCIMIENTO-ATS.md` los desaconsejan), referencias («disponibles bajo petición» no aporta), intereses/hobbies, patentes y puntajes de pruebas (nicho; se pueden añadir después si Juan lo pide).

Cada sección se puede **quitar o agregar** desde la vista («Agregar sección»), y el orden se guarda en `sectionOrder`.

## 5. Impacto técnico (para el plan)

1. Ampliar `cvSchema` con `certifications`, `volunteering`, y (si se aprueban) `awards`, `publications`; todas con `default([])`, así los CV ya guardados siguen válidos (jsonb, sin migración de tabla).
2. Lectura del CV: llevar esos encabezados de `other` a su propia sección (`lib/cv/sections.ts`, `segment.ts`, extracción con IA) y al verificador anti-invención.
3. Plantilla ATS/PDF/Word/TXT/Markdown: pintar las secciones nuevas solo si traen datos.
4. Vista «Your resume»: reutiliza `SettingsSection`/`SettingsSections` y las piezas de `form-parts.tsx`.
5. Botón «Salir» en la validación del CV (a la vista inicial) y botón mágico «Llenar con tu CV» en la vista.

## Fuentes

- Enhancv, Kickresume, Toptal, University at Buffalo, Novoresume, Resume Worded, Himalayas (ATS y encabezados).
- LinkedIn Help y guías de Coursera, UW Careers (secciones del perfil).
- JSON Resume (jsonresume.org/docs), Reactive Resume (docs.rxresu.me).
- Guías de carrera de Duke, Berkeley I School, CareerFoundry, 2U (tecnología, diseño, marketing).
- Interna: `docs/CONOCIMIENTO-ATS.md` y los 49 archivos de `Pruebas VC/`.
