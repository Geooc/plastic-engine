# plastic-engine

WIP

## Sample

```js
import { renderContext as rc } from './render-context.js'

rc.setDepthFunc(rc.LEQUAL);
rc.writeDepth(true);
rc.renderBack(true);

const drawcall = rc.createDrawcall(rc.TRIANGLES, vertexCount, {
    position	: { buffer : vbo, type : rc.FLOAT, byteStride : 20, byteOffset : 0 },
    uv		: { buffer : vbo, type : rc.FLOAT, byteStride : 20, byteOffset : 12 },
    indices	: { buffer : ebo, type : rc.USHORT }
});
const renderPass = rc.createRenderPass('test render pass', vsSrc, fsSrc);
const texture = rc.createTextureRGBA8(img, filter, warp);

rc.setRenderTarget({
    color0 : { texture : tex },
    depth  : { texture : depthTex }
});
rc.execRenderPass(renderPass, cmdList);

rc.setRenderTarget();
let testPostProcess = rc.createPostProcess(name, fsSrc);
rc.execPostProcess(testPostProcess, [0, 0, 800, 600], {
    sceneColor : color0,
    screenSize : [800, 600]
});
```

## Road map 2020

- [ ] GraphicsAPI
  - [x] Drawcall
  - [x] Texture
  - [x] RenderPass
  - [ ] RenderTarget
  - [ ] PostProcess
- [ ] GLTF
  - [x] Mesh
  - [ ] VTF Animation
  - [ ] Material
- [ ] PostProcess
  - [ ] Bloom
  - [ ] SSR
  - [ ] Tonemapping
  - [ ] TAA
- [ ] Rendering
  - [ ] Deferred
  - [ ] MRT
  - [ ] HDRI
  - [ ] IBL
- [ ] DirectLight
  - [ ] 4xLight(Directional/Point/Spot)
  - [ ] 1xShadowMap
- [ ] CameraController
  - [ ] TouchControl
  - [ ] FPS
- [ ] Misc
  - [ ] NodeJS
