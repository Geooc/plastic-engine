// renderer.js: gltf scene renderer

import { renderContext as rc } from '../render-context.js'
import { mathUtils } from '../utils/math-utils.js'

// todo: IBL
// function createIBL(hdriTexture) {
//     const radianceRes = 1024;
//     const irradianceRes = 1024;
//     let ret = {
//         radianceMap : rc.createTexture(rc.TEX_CUBE).setData(radianceRes, radianceRes, rc.PIXEL_R11G11B10F, null),
//         irradianceMap : rc.createTexture(rc.TEX_CUBE).setData(irradianceRes, irradianceRes, rc.PIXEL_R11G11B10F, null),
//         brdfLut : rc.createTexture(rc.TEX_2D).setData(64, 64, rc.PIXEL_R11G11B10F, null)
//     };

//     const projMat = mathUtils.calcPerspectiveProjMatrix(90, 1, 1, 10);
//     let invViewProjMats = new Array(6);
//     invViewProjMats[0] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [1, 0, 0], [0, -1, 0])));
//     invViewProjMats[1] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [-1, 0, 0], [0, -1, 0])));
//     invViewProjMats[2] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, 1, 0], [0, 0, 1])));
//     invViewProjMats[3] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, -1, 0], [0, 0, -1])));
//     invViewProjMats[4] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, 0, 1], [0, -1, 0])));
//     invViewProjMats[5] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, 0, -1], [0, -1, 0])));

//     rc.createRenderPassFromSourcePath('radiance', '@shaders/postprocess/pp_common_vs.glsl', '@shaders/ibl/radiance_fs.glsl', (renderPass) => {
//         renderPass.setViewport(0, 0, radianceRes, radianceRes).setDepthFunc(rc.ZTEST_ALWAYS).setShaderFlag('USE_VIEW_DIR', 1);
//         let radianceRT = rc.createRenderTarget();

//         for (let i = 0; i < 6; ++i) {
//             radianceRT.bind().setColorAttachments({ texture: ret.radianceMap, face: i });
//             renderPass.setShaderParameters({
//                 uInvViewProj: invViewProjMats[i],
//                 uHDRI: hdriTexture
//             }).execute(this.screenDrawcall, radianceRT);
//         }
        
//         ret.radianceMap.genMipmap();
//         radianceRT.destory();
//         renderPass.destory();
//     });

//     return ret;
// }

class Renderer {
    constructor(gltfLoader) {
        this.gltfLoader = gltfLoader;
        this.canvas = rc.getCanvas();

        this.near = 0.1;
        this.far = 10000;
        this.fovy = 70;

        this.projMat = mathUtils.calcPerspectiveProjMatrix(this.fovy, this.canvas.width / this.canvas.height, this.near, this.far);
        this.viewMat = mathUtils.identityMatrix();
    }

    _checkSize(canvas) {
        let displayWidth = Math.floor(canvas.clientWidth * window.devicePixelRatio);
        let displayHeight = Math.floor(canvas.clientHeight * window.devicePixelRatio);
        if (canvas.width != displayWidth || canvas.height != displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            
            this.projMat = mathUtils.calcPerspectiveProjMatrix(this.fovy, displayWidth / displayHeight, this.near, this.far);
            this.sceneColor.bind().setData(this.canvas.width, this.canvas.height, rc.PIXEL_RGBA16F);
            this.sceneDepth.bind().setData(this.canvas.width, this.canvas.height, rc.PIXEL_DEPTH);
        }
    }

    init() {
        this.sceneColor = rc.createTexture(rc.TEX_2D).bind().setData(this.canvas.width, this.canvas.height, rc.PIXEL_RGBA16F).setSampler(rc.FILTER_BILINEAR);
        this.sceneDepth = rc.createTexture(rc.TEX_2D).bind().setData(this.canvas.width, this.canvas.height, rc.PIXEL_DEPTH).setSampler(rc.FILTER_BILINEAR);
        this.hdrRT = rc.createRenderTarget().bind()
            .setColorAttachments([{ texture: this.sceneColor }])
            .setDepthAttachment({ texture: this.sceneDepth });
        // standard pass
        this.stdRenderPass = rc.createRenderPassFromSourcePath('std', '@shaders/std_vs.glsl', '@shaders/std_fs.glsl').setLoadAction(false, false);
        // screen drawcall for post process
        this.screenVbo = rc.createVertexBuffer().setData(new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]));
        this.screenDrawcall = rc.createDrawcall(rc.PRIM_TRIANGLE_STRIP, 4).bind().setAttributes({
            aPos: { buffer: this.screenVbo, size: 2, type: rc.DATA_FLOAT }
        }).unbind();
        // final pass
        this.finalPass = rc.createRenderPassFromSourcePath('final', '@shaders/postprocess/pp_common_vs.glsl', '@shaders/postprocess/pp_final_fs.glsl')
            .setLoadAction(false, false).setDepthFunc(rc.ZTEST_ALWAYS);
    }

    renderScene() {
        if (!this.gltfLoader.isReady) return;

        let opaqueList = [];
        //let maskedList = [];
        //let translucentList = [];
        this.gltfLoader.getDrawcallLists(opaqueList);

        // draw meshes
        this.stdRenderPass.setShaderParameters({
            uView: this.viewMat,
            uProj: this.projMat
        }).execute(opaqueList, this.hdrRT);

        // maybe some postprocess
        this.finalPass.setShaderParameters({
            uInput: this.sceneColor
        }).execute([this.screenDrawcall]);
    }

    render() {
        this._checkSize(this.canvas);

        this.renderScene();
    }
}

export { Renderer }

