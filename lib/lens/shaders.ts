/**
 * Shaders del efecto lupa del login. La fórmula de abombamiento sigue el tutorial de Codrops «Creating a Bulge Distortion Effect with WebGL» (Robin Payot, licencia MIT):
 * el desplazamiento de la imagen cae con 1 / (1 + distancia⁴). Cambios nuestros: (1) la lente la mueve el tiempo, no el ratón; (2) corrige la proporción de la pantalla para
 * que la lente sea un círculo; (3) fuera de la lente la imagen queda intacta (el original encoge todo lo lejano); (4) los elementos aparecen al pasar la lente (de arriba abajo).
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
uniform float uStrength;
uniform float uBulge;
uniform float uBand;
varying vec2 vUv;

vec2 bulge(vec2 uv, vec2 center) {
  vec2 d = (uv - center) * vec2(uAspect, 1.0);
  float dist = length(d) / uRadius;
  float falloff = 1.0 / (1.0 + pow(dist, 4.0));
  float scale = 1.0 - uBulge * (1.0 - uStrength) * falloff;
  return center + (uv - center) * scale;
}

void main() {
  vec2 uv = bulge(vUv, uCenter);
  vec3 tex = texture2D(uTexture, uv).rgb;
  // Lo que queda por debajo de la lente todavía no «llegó»: va apareciendo de arriba hacia abajo.
  float shown = smoothstep(uCenter.y - uBand, uCenter.y + uBand, uv.y);
  gl_FragColor = vec4(mix(uBg, tex, shown), 1.0);
}
`
