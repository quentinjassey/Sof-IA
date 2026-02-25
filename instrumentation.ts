// Next.js instrumentation — runs once at server startup, before any route.
// Polyfills DOMMatrix for pdfjs-dist which needs it in Node.js environments.

export async function register() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    class DOMMatrixPolyfill {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
      m11 = 1; m12 = 0; m13 = 0; m14 = 0
      m21 = 0; m22 = 1; m23 = 0; m24 = 0
      m31 = 0; m32 = 0; m33 = 1; m34 = 0
      m41 = 0; m42 = 0; m43 = 0; m44 = 1
      is2D = true
      isIdentity = true

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(init?: any) {
        if (Array.isArray(init)) {
          if (init.length === 6) {
            ;[this.a, this.b, this.c, this.d, this.e, this.f] = init
            this.m11 = this.a; this.m12 = this.b
            this.m21 = this.c; this.m22 = this.d
            this.m41 = this.e; this.m42 = this.f
          } else if (init.length === 16) {
            ;[
              this.m11, this.m12, this.m13, this.m14,
              this.m21, this.m22, this.m23, this.m24,
              this.m31, this.m32, this.m33, this.m34,
              this.m41, this.m42, this.m43, this.m44,
            ] = init
            this.a = this.m11; this.b = this.m12
            this.c = this.m21; this.d = this.m22
            this.e = this.m41; this.f = this.m42
            this.is2D = false
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      static fromMatrix(other?: any) {
        const m = new DOMMatrixPolyfill()
        if (other) Object.assign(m, other)
        return m
      }
      static fromFloat32Array(arr: Float32Array) { return new DOMMatrixPolyfill(Array.from(arr)) }
      static fromFloat64Array(arr: Float64Array) { return new DOMMatrixPolyfill(Array.from(arr)) }

      inverse() { return new DOMMatrixPolyfill() }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      multiply(other?: any) { return DOMMatrixPolyfill.fromMatrix(other) }
      translate() { return new DOMMatrixPolyfill() }
      scale() { return new DOMMatrixPolyfill() }
      rotate() { return new DOMMatrixPolyfill() }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transformPoint(p?: any) { return p || { x: 0, y: 0, z: 0, w: 1 } }
      toFloat32Array() { return new Float32Array(16) }
      toFloat64Array() { return new Float64Array(16) }
      toString() { return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})` }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).DOMMatrix = DOMMatrixPolyfill
  }
}
