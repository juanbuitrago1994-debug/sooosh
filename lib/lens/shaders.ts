/**
 * Shaders del efecto lupa del login. La base del abombamiento sigue el tutorial de Codrops «Creating a Bulge Distortion Effect with WebGL» (Robin Payot, licencia MIT):
 * el desplazamiento cae con 1 / (1 + distancia⁴). Cambios nuestros: (1) la lente la mueve el tiempo, no el ratón; (2) corrige la proporción de la pantalla y puede ser ancha;
 * (3) fuera de la lente la imagen queda intacta; (4) los elementos aparecen al pasar la lente; (5) PRISMA: cada canal de color (rojo, verde, azul) se abomba con distinta fuerza
 * y se desplaza en vertical, así aparecen franjas de color en los bordes; (6) ESTELA: desenfoque vertical de 7 muestras que crece con la intensidad; (7) CURVATURA global y color con su propia envolvente (breve y al comienzo); (9) DIRECCIÓN vertical u horizontal (`uAxis`); (8) la intensidad puede
 * concentrarse en el borde de la lente (`uRim`), que es donde en las referencias se ve el color.
 * Una sola pasada de pantalla completa con un triángulo (así lo hace OGL): `position` va de −1 a 1 y `uv` de 0 a 1 (con el exceso fuera de la pantalla).
 */
export const VERTEX = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`

export const FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uTexture;
uniform vec3 uBg;
uniform vec2 uCenter;
uniform float uAspect;
uniform float uRadius;
uniform float uWidth;
uniform float uStrength;
uniform float uBulge;
uniform float uBand;
uniform float uDispersion;
uniform float uPrism;
uniform float uBlur;
uniform float uRim;
uniform float uColor;
uniform float uCurve;
uniform float uAxis;
varying vec2 vUv;

const int TAPS = 7;

// Curvatura global (como un cristal curvo): los bordes de la pantalla se doblan; crece con el efecto y vuelve a cero al terminar.
vec2 baseUv() {
  vec2 c = vUv - vec2(0.5);
  vec2 d = c * vec2(uAspect, 1.0);
  return vec2(0.5) + c * (1.0 + uCurve * uBulge * dot(d, d));
}

// Dirección: con uAxis = 0 la lente baja (arriba → abajo). Con uAxis = 1 va de izquierda a derecha: todo se calcula en un espacio «girado» s (s.y = avance de la lente) y se vuelve al real al muestrear.
vec2 toS(vec2 v) { return uAxis > 0.5 ? vec2(v.y, 1.0 - v.x) : v; }
vec2 toReal(vec2 s) { return uAxis > 0.5 ? vec2(1.0 - s.y, s.x) : s; }
float aspectS() { return uAxis > 0.5 ? 1.0 / uAspect : uAspect; }

// Intensidad (0 a 1) del efecto en este punto: mayor cerca del centro de la lente o, con uRim, en su borde.
float intensity(vec2 uv0) {
  vec2 d = (uv0 - uCenter) * vec2(aspectS() / uWidth, 1.0);
  float dist = length(d) / uRadius;
  float falloff = 1.0 / (1.0 + pow(dist, 4.0));
  float ring = smoothstep(0.3, 1.0, dist) * (1.0 - smoothstep(1.0, 2.4, dist));
  return uBulge * mix(falloff, ring, uRim);
}

// Posición de la imagen que se ve en este punto para el canal c (−1 rojo, 0 verde, 1 azul): cada canal se abomba con distinta fuerza y se desplaza en vertical.
vec2 lens(vec2 uv0, float I, float c) {
  float s = uStrength * (1.0 + uDispersion * uColor * c);
  float scale = 1.0 - I * (1.0 - s);
  vec2 uv = uCenter + (uv0 - uCenter) * scale;
  uv.y += c * uPrism * uColor * I;
  return uv;
}

void main() {
  vec2 b = toS(baseUv());
  float I = intensity(b);
  vec3 col = vec3(0.0);
  float yMid = b.y;
  if (I * uBlur < 0.0005) {
    col = vec3(texture2D(uTexture, toReal(lens(b, I, -1.0))).r, texture2D(uTexture, toReal(lens(b, I, 0.0))).g, texture2D(uTexture, toReal(lens(b, I, 1.0))).b);
    yMid = lens(b, I, 0.0).y;
  } else {
    float wsum = 0.0;
    for (int i = 0; i < TAPS; i++) {
      float t = float(i) / float(TAPS - 1) * 2.0 - 1.0;
      float w = exp(-2.2 * t * t);
      vec2 off = vec2(0.0, t * uBlur * I);
      col += w * vec3(texture2D(uTexture, toReal(lens(b, I, -1.0) + off)).r, texture2D(uTexture, toReal(lens(b, I, 0.0) + off)).g, texture2D(uTexture, toReal(lens(b, I, 1.0) + off)).b);
      wsum += w;
    }
    col /= wsum;
    yMid = lens(b, I, 0.0).y;
  }
  // Lo que queda por debajo de la lente todavía no «llegó»: va apareciendo de arriba hacia abajo.
  float shown = smoothstep(uCenter.y - uBand, uCenter.y + uBand, yMid);
  gl_FragColor = vec4(mix(uBg, col, shown), 1.0);
}
`
