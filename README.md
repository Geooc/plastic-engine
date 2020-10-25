# plastic-engine

WIP

## Sample

```js
import { renderContext as rc } from './render-context.js'
// states
rc.setDepthFunc(rc.LEQUAL);
rc.writeDepth(true);
rc.renderFace(true, false);
// resources
const sceneTex = rc.createTextureFromData(null, rc.textureFormat.R11G11B10, width, height);
const depthTex = rc.createDepthTexture(width, height);
const drawcall = rc.createDrawcall(rc.TRIANGLES, vertexCount, {
    position	: { buffer : vbo, size : 3, type : rc.FLOAT, byteStride : 20, byteOffset : 0 },
    uv		    : { buffer : vbo, size : 2, type : rc.FLOAT, byteStride : 20, byteOffset : 12 },
    indices	  : { buffer : ebo, type : rc.USHORT }
});
// render pass
const renderPass = rc.createRenderPass('test-rp', vsSrc, fsSrc, [
    color0 : { texture : sceneTex },
    depth  : { texture : depthTex }
]);
rc.execRenderPass(renderPass, cmdList);
// post process
const postProcess = rc.createPostProcess('test-pp', ppSrc);
rc.execPostProcess(postProcess, {
    sceneColor : sceneTex,
    screenSize : [width, height]
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
  - [ ] Tonemapping
  - [ ] TAA
  - [ ] Bloom
  - [ ] SSR
- [ ] Rendering
  - [x] MRT*
  - [x] HDRI
  - [ ] PBR DirectLights
    - [ ] 4xLight(Directional/Point/Spot)
    - [ ] 1xShadowMap
  - [ ] IBL
  - [ ] ~~Deferred~~(MRT is not supported on ios)
- [ ] CameraController
  - [x] Orbit
  - [ ] TouchControl
  - [ ] FPS
- [ ] Misc
  - [ ] NodeJS module

## Road map 2021

- [ ] GLTF
  - [ ] Morph Target
  - [ ] GLB/Base64buffer
  - [ ] Extension
- [ ] Web page
- [ ] Rendering
  - [ ] Matcap
  - [ ] Spherical Harmonics
  - [ ] Terrain
  - [ ] Ocaen
  - [ ] Atmosphere
- [ ] PostProcess
  - [ ] DoF