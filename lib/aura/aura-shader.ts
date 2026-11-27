/**
 * Shader del AURA de la pantalla inicial (arrastrar un CV), en la línea de Siri y Apple Intelligence: luz suave y fluida que nace en el centro, sin deformar nada. Se dibuja sobre
 * un lienzo TRANSPARENTE (la página real se ve debajo, no hace falta una «foto»); la salida es con alfa premultiplicado.
 *
 * Qué se ve:
 * - HALO: un anillo ancho y suave de luz alrededor del mensaje central (el centro se atenúa `uHole` para que el texto se lea). Su radio es orgánico: lo mueve un ruido que fluye.
 * - COLOR FLUIDO: la paleta (5 tonos de los tokens `flow-*`) gira alrededor del halo y se mezcla con ruido, como los reflejos de un líquido de luz; lóbulos que se desplazan despacio.
 * - GOLPE (primer contacto): el halo se hincha y se enciende con fuerza y sale una onda de luz ancha del centro a los bordes, frenándose (curva de salida); después todo se calma.
 * - RESPIRACIÓN y PULSOS (bucle): el halo respira despacio (radio y brillo) y cada cierto tiempo sale una onda de luz más suave, mucho más débil que el golpe.
 * Sin desenfoque de la imagen, sin distorsión: solo se suma luz.
 */
export const AURA_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uAspect;
uniform float uRadius;
uniform float uWidth;
uniform float uHole;
uniform float uIntensity;
uniform float uWarp;
uniform float uScale;
uniform float uFlow;
uniform float uBreathHz;
uniform float uBreathRadius;
uniform float uBreathLight;
uniform float uHit;
uniform float uSwell;
uniform float uShock;
uniform float uShockWidth;
uniform float uShockPower;
uniform float uPulseStart;
uniform float uPulseEvery;
uniform float uPulseAmp;
uniform float uReach;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uC4;
varying vec2 vUv;

const float TAU = 6.2831853;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// Paleta cíclica de 5 tonos con transiciones suaves.
vec3 palette(float k) {
  k = fract(k) * 5.0;
  float f = smoothstep(0.0, 1.0, fract(k));
  if (k < 1.0) return mix(uC0, uC1, f);
  if (k < 2.0) return mix(uC1, uC2, f);
  if (k < 3.0) return mix(uC2, uC3, f);
  if (k < 4.0) return mix(uC3, uC4, f);
  return mix(uC4, uC0, f);
}

// Una onda de luz ancha que sale del centro y se frena (curva de salida) mientras se debilita; s va de 0 (nace) a 1 (llega al borde).
float shockRing(float r, float s, float width) {
  if (s <= 0.0 || s >= 1.0) return 0.0;
  float radius = uReach * (1.0 - exp(-uShockPower * s)) / (1.0 - exp(-uShockPower));
  float x = (r - radius) / (width * (1.0 + 1.5 * s));
  return exp(-0.5 * x * x) * (1.0 - s) * (1.0 - s);
}

void main() {
  vec2 d = (vUv - vec2(0.5)) * vec2(uAspect, 1.0);
  float r = length(d);
  float ang = atan(d.y, d.x);
  float t = uTime * uFlow;

  // Ruido que fluye: n1 mueve el radio del halo (orgánico), n2 mezcla el color.
  vec2 q = d * uScale;
  float n1 = fbm(q + vec2(t * 1.3, -t));
  float n2 = fbm(q * 1.7 + vec2(-t, t * 0.8) + 5.0);

  // Halo: radio con respiración, hinchazón del golpe y deformación orgánica; el centro se atenúa para que el texto se lea.
  float breath = sin(uTime * TAU * uBreathHz);
  float R = uRadius * (1.0 + uBreathRadius * breath + uSwell) + (n1 - 0.5) * uWarp * 0.22;
  float x = (r - R) / uWidth;
  float halo = exp(-0.5 * x * x);
  halo *= mix(1.0, smoothstep(0.0, R * 0.95, r), uHole);

  // Color: giro lento alrededor del halo + ruido + lóbulos que se desplazan.
  float k = ang / TAU + n2 * 0.7 + uTime * 0.03;
  vec3 col = palette(k);
  float lobes = 0.55 + 0.45 * sin(ang * 3.0 + uTime * 0.5 + n1 * 5.0);
  col = mix(col, palette(k + 0.4), 0.35 * lobes);

  float light = halo * uIntensity * (1.0 + uBreathLight * breath + uHit);
  // Golpe (una vez) y pulsos suaves en bucle.
  float shock = shockRing(r, uShock, uShockWidth) * uHit;
  float p = (uTime - uPulseStart) / uPulseEvery;
  float pulse = p >= 0.0 ? shockRing(r, fract(p), uShockWidth * 1.2) * uPulseAmp : 0.0;
  float I = light + shock * 0.9 + pulse;

  // Un toque de luz blanca en el corazón del halo da la sensación de energía; todo suma luz sobre la página (alfa premultiplicado).
  vec3 rgb = col * I + vec3(0.12) * halo * uHit;
  float a = clamp(I, 0.0, 1.0);
  gl_FragColor = vec4(min(rgb, vec3(1.0)), a);
}
`
