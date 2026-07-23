#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  // Map [-1,1] to [0,1] and flip Y so texture row 0 (matrix top)
  // renders at the top of the viewport (OpenGL origin is bottom-left).
  v_uv = vec2(a_position.x * 0.5 + 0.5, 1.0 - (a_position.y * 0.5 + 0.5));
  gl_Position = vec4(a_position, 0.0, 1.0);
}