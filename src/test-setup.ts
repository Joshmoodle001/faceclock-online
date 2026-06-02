if (typeof ImageData === 'undefined') {
  // @ts-ignore
  globalThis.ImageData = class ImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace: string;

    constructor(data: Uint8ClampedArray | number, width: number, height?: number, settings?: ImageDataSettings) {
      if (typeof data === 'number') {
        this.width = data;
        this.height = width;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else if (height === undefined) {
        this.width = width;
        this.height = data.length / (4 * width);
        this.data = data;
      } else {
        this.width = width;
        this.height = height;
        this.data = data;
      }
      this.colorSpace = settings?.colorSpace || 'srgb';
    }
  } as unknown as typeof ImageData;
}

if (typeof HTMLVideoElement === 'undefined') {
  // @ts-ignore
  globalThis.HTMLVideoElement = class {} as unknown as typeof HTMLVideoElement;
}

if (typeof HTMLCanvasElement === 'undefined') {
  // @ts-ignore
  globalThis.HTMLCanvasElement = class {} as unknown as typeof HTMLCanvasElement;
}

if (typeof OffscreenCanvas === 'undefined') {
  // @ts-ignore
  globalThis.OffscreenCanvas = class {} as unknown as typeof OffscreenCanvas;
}
