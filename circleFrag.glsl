#ifdef GL_OES_standard_derivatives
   #extension GL_OES_standard_derivatives : enable
#endif
precision mediump float;
varying vec4 color;
void main() {
			float r = 0.0;
			float delta = 0.0;
			float alpha = 1.0;
			vec2 cxy = 2.0 * gl_PointCoord - 1.0;

      // We can make circles by taking the dot product of a coordinate,
      // and discard any pixels that have a dot product greater than 1
			r = dot(cxy, cxy);

			delta = fwidth(r);

			alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);

			if (r > 1.0) {
				discard;
			}

			gl_FragColor = color;
}
