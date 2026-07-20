#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D u_matrix;
uniform float u_vmin;
uniform float u_vmax;
uniform int u_colorMap;
uniform vec2 u_canvasSize;

in vec2 v_uv;
out vec4 outColor;

vec3 rdbu(float t) {
  // Red-white-blue diverging (RdBu_r style)
  // t in [0,1]: 0=blue(low), 0.5=white, 1=red(high)
  vec3 blue = vec3(0.173, 0.373, 0.651);
  vec3 white = vec3(0.969, 0.969, 0.969);
  vec3 red = vec3(0.769, 0.298, 0.298);
  if (t < 0.5) {
    return mix(blue, white, t * 2.0);
  }
  return mix(white, red, (t - 0.5) * 2.0);
}

vec3 viridis(float t) {
  // Approximation of matplotlib viridis
  vec3 c0 = vec3(0.267, 0.005, 0.329);
  vec3 c1 = vec3(0.282, 0.140, 0.457);
  vec3 c2 = vec3(0.254, 0.265, 0.530);
  vec3 c3 = vec3(0.207, 0.372, 0.553);
  vec3 c4 = vec3(0.165, 0.471, 0.558);
  vec3 c5 = vec3(0.128, 0.567, 0.551);
  vec3 c6 = vec3(0.135, 0.659, 0.518);
  vec3 c7 = vec3(0.267, 0.749, 0.441);
  vec3 c8 = vec3(0.478, 0.821, 0.318);
  vec3 c9 = vec3(0.741, 0.873, 0.150);
  vec3 c10 = vec3(0.993, 0.906, 0.144);
  vec3 cs[11] = vec3[11](c0,c1,c2,c3,c4,c5,c6,c7,c8,c9,c10);
  float f = clamp(t, 0.0, 1.0) * 10.0;
  int i = int(f);
  if (i >= 10) return c10;
  return mix(cs[i], cs[i+1], fract(f));
}

vec3 diffRdBu(float t) {
  // White-centered diverging colormap for differential Hi-C (ΔIntensity)
  // t in [0,1]: 0=blue(negative), 0.5=white, 1=red(positive)
  vec3 neg2 = vec3(0.231, 0.298, 0.753);  // deep blue
  vec3 neg1 = vec3(0.431, 0.498, 0.853);  // mid blue
  vec3 white = vec3(0.969, 0.969, 0.969);
  vec3 pos1 = vec3(0.961, 0.510, 0.188);  // mid orange
  vec3 pos2 = vec3(0.804, 0.196, 0.196);  // deep red
  if (t < 0.25) return mix(neg2, neg1, t * 4.0);
  if (t < 0.5) return mix(neg1, white, (t - 0.25) * 4.0);
  if (t < 0.75) return mix(white, pos1, (t - 0.5) * 4.0);
  return mix(pos1, pos2, (t - 0.75) * 4.0);
}

void main() {
  // Note: Hi-C is upper-triangle (or symmetric); we render the full square
  float v = texture(u_matrix, v_uv).r;
  float t = clamp((v - u_vmin) / (u_vmax - u_vmin + 1e-9), 0.0, 1.0);
  vec3 rgb;
  if (u_colorMap == 0)      rgb = rdbu(t);
  else if (u_colorMap == 1) rgb = viridis(t);
  else if (u_colorMap == 2) rgb = diffRdBu(t);  // for differential Hi-C
  else                       rgb = rdbu(t);
  outColor = vec4(rgb, 1.0);
}