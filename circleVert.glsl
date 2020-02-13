precision mediump float;
attribute vec2 position;
attribute float pointWidth;
attribute vec4 nodeColor;
varying vec4 color;

void main () {
  color = nodeColor;
  gl_PointSize = pointWidth;
  gl_Position = vec4(position, 0, 1);
}
