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

vec3 reflut(float t) {
  // Reference colormap: 16 stops evenly sampled from hic.html LUT_RGB [0, 255]
  vec3 cols[16] = vec3[16](
    vec3(0.357, 0.439, 0.600),  // entry   0
    vec3(0.384, 0.510, 0.710),  // entry  17
    vec3(0.404, 0.537, 0.710),  // entry  34
    vec3(0.486, 0.631, 0.780),  // entry  51
    vec3(0.525, 0.702, 0.847),  // entry  68
    vec3(0.565, 0.745, 0.839),  // entry  85
    vec3(0.659, 0.769, 0.761),  // entry 102
    vec3(0.722, 0.757, 0.635),  // entry 119
    vec3(0.776, 0.722, 0.455),  // entry 136
    vec3(0.847, 0.729, 0.345),  // entry 153
    vec3(0.890, 0.694, 0.247),  // entry 170
    vec3(0.898, 0.620, 0.243),  // entry 187
    vec3(0.890, 0.545, 0.259),  // entry 204
    vec3(0.863, 0.412, 0.208),  // entry 221
    vec3(0.859, 0.365, 0.263),  // entry 238
    vec3(0.780, 0.361, 0.365)   // entry 255
  );
  float f = clamp(t, 0.0, 1.0) * 15.0;
  int i = int(f);
  if (i >= 15) return cols[15];
  return mix(cols[i], cols[i+1], fract(f));
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
  // Differential colormap sampled from diff.html LUT_RGB (7 stops, evenly span [0, 255])
  // t in [0,1]: 0=purple(negative), ~0.5=white, 1=red(positive)
  vec3 cols[7] = vec3[7](
    vec3(0.431, 0.337, 0.576),  // entry   0: purple (negative)
    vec3(0.420, 0.365, 0.643),  // entry  42: blue-purple
    vec3(0.663, 0.635, 0.808),  // entry  85: light purple
    vec3(0.992, 0.969, 0.996),  // entry 128: near white
    vec3(0.969, 0.824, 0.847),  // entry 170: pink
    vec3(0.941, 0.518, 0.557),  // entry 212: red-pink
    vec3(0.835, 0.161, 0.192)   // entry 255: deep red (positive)
  );
  float f = clamp(t, 0.0, 1.0) * 6.0;
  int i = int(f);
  if (i >= 6) return cols[6];
  return mix(cols[i], cols[i+1], fract(f));
}

void main() {
  // Note: Hi-C is upper-triangle (or symmetric); we render the full square
  float v = texture(u_matrix, v_uv).r;
  float t = clamp((v - u_vmin) / (u_vmax - u_vmin + 1e-9), 0.0, 1.0);
  vec3 rgb;
  if (u_colorMap == 0)      rgb = rdbu(t);
  else if (u_colorMap == 1) rgb = viridis(t);
  else if (u_colorMap == 2) rgb = diffRdBu(t);  // for differential Hi-C
  else if (u_colorMap == 3) rgb = reflut(t);    // reference colormap
  else                       rgb = rdbu(t);
  outColor = vec4(rgb, 1.0);
}
