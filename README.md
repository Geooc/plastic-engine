# plastic-engine

WIP

## Sample

```js
import { renderContext as rc } from './render-context.js'

rc.setDepthFunc(rc.LEQUAL);
rc.writeDepth(true);
rc.renderFace(true, false);

const drawcall = rc.createDrawcall(rc.TRIANGLES, vertexCount, {
    position	: { buffer : vbo, size : 3, type : rc.FLOAT, byteStride : 20, byteOffset : 0 },
    uv		    : { buffer : vbo, size : 2, type : rc.FLOAT, byteStride : 20, byteOffset : 12 },
    indices	  : { buffer : ebo, type : rc.USHORT }
});
const renderPass = rc.createRenderPass('test render pass', vsSrc, fsSrc);
const texture = rc.createTextureFromImage(img, filter, warp);

rc.setRenderTarget({
    color0 : { texture : tex },
    depth  : { texture : depthTex }
});
rc.execRenderPass(renderPass, cmdList);

rc.setRenderTarget();
let testPostProcess = rc.createPostProcess(name, fsSrc);
rc.execPostProcess(testPostProcess, {
    sceneColor : color0,
    screenSize : [800, 600]
});
```

## Road map 2020

- [x] GraphicsAPI
  - [x] Drawcall
  - [x] Texture
  - [x] RenderPass
  - [x] RenderTarget
  - [x] PostProcess
- [x] GLTF
  - [x] Mesh
  - [x] VTF Animation
  - [x] Material
- [ ] PostProcess
  - [ ] Bloom
  - [ ] SSR
  - [ ] Tonemapping
  - [ ] TAA
- [ ] Rendering
  - [ ] Deferred
  - [x] MRT*
  - [ ] HDRI
  - [ ] IBL
- [ ] DirectLight
  - [ ] 4xLight(Directional/Point/Spot)
  - [ ] 1xShadowMap
- [ ] CameraController
  - [x] Orbit
  - [ ] TouchControl
  - [ ] FPS
- [ ] Misc
  - [ ] NodeJS
