// renderer.js: gltf scene renderer

import { renderContext as rc } from '../render-context.js'
import { mathUtils } from '../utils/math-utils.js'

// screen drawcall for post process
let screenVbo = rc.createVertexBuffer().setData(new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]));
let screenDrawcall = rc.createDrawcall(rc.PRIM_TRIANGLE_STRIP, 4).bind().setAttributes({
    aPos: { buffer: screenVbo, size: 2, type: rc.DATA_FLOAT }
}).unbind();

// todo: IBL
function createIBL(hdriPath) {
    const envCubemapRes = 512;
    const radianceRes = 256;
    const irradianceRes = 32;
    const brdfLutRes = 16;
    let ret = {
        radianceMap : null,//rc.createTexture(rc.TEX_CUBE).bind().setData(radianceRes, radianceRes, rc.PIXEL_R11G11B10F, null),
        irradianceMap : rc.createTexture(rc.TEX_CUBE).bind().setData(irradianceRes, irradianceRes, rc.PIXEL_R11G11B10F, null),
        brdfLut : rc.createTexture(rc.TEX_2D).bind().setData(brdfLutRes, brdfLutRes, rc.PIXEL_R11G11B10F, null)
    };

    // matrices
    const projMat = mathUtils.calcPerspectiveProjMatrix(90, 1, 1, 10);
    let invViewProjMats = new Array(6);
    invViewProjMats[0] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [1, 0, 0], [0, -1, 0])));
    invViewProjMats[1] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [-1, 0, 0], [0, -1, 0])));
    invViewProjMats[2] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, 1, 0], [0, 0, 1])));
    invViewProjMats[3] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, -1, 0], [0, 0, -1])));
    invViewProjMats[4] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, 0, 1], [0, -1, 0])));
    invViewProjMats[5] = mathUtils.invMatrix(mathUtils.mulMatrices(projMat, mathUtils.calcLookAtViewMatrix([0, 0, 0], [0, 0, -1], [0, -1, 0])));

    let hdriTexture;
    let envCubePass;
    let radiancePass;
    let irradiancePass;
    let brdfPass;

    let asyncLoadCallback = () => {
        if (hdriTexture && envCubePass && irradiancePass) {
            // render target
            let renderTarget = rc.createRenderTarget();
            // convert to cubemap
            let envCubeMap = rc.createTexture(rc.TEX_CUBE).bind().setData(envCubemapRes, envCubemapRes, rc.PIXEL_R11G11B10F, null);
            envCubePass.setShaderParameters({
                uHDRI: hdriTexture
            });
            for (let i = 0; i < 6; ++i) {
                renderTarget.bind().setColorAttachments([{ texture: envCubeMap, face: i }]);
                envCubePass.setShaderParameters({
                    uInvViewProj: invViewProjMats[i]
                }).execute([screenDrawcall], renderTarget);
            }
            envCubeMap.bind().setSampler(rc.FILTER_TRILINEAR);

            // irradiance
            irradiancePass.setShaderParameters({
                uHDRI: envCubeMap
            });
            for (let i = 0; i < 6; ++i) {
                renderTarget.bind().setColorAttachments([{ texture: ret.irradianceMap, face: i }]);
                irradiancePass.setShaderParameters({
                    uInvViewProj: invViewProjMats[i]
                }).execute([screenDrawcall], renderTarget);
            }
            ret.irradianceMap.bind().setSampler(rc.FILTER_TRILINEAR);

            // finish
            envCubePass.destory();
            renderTarget.destory();

            ret.radianceMap = envCubeMap;
        }
    }

    rc.createTextureFromUrl(hdriPath, rc.FILTER_BILINEAR, rc.WARP_CLAMP, false, (tex) => {
        hdriTexture = tex;
        asyncLoadCallback();
    });
    rc.createRenderPassFromSourcePath('env cubemap', '@shaders/postprocess/pp_common_vs.glsl', '@shaders/env_cubemap_fs.glsl', (pass) => {
        envCubePass = pass;
        pass.setViewport(0, 0, envCubemapRes, envCubemapRes).setDepthFunc(rc.ZTEST_ALWAYS).setShaderFlag('USE_CUBEMAP_TEXCOORD', 1);
        asyncLoadCallback();
    });
    // todo
    // rc.createRenderPassFromSourcePath('radiance', '@shaders/postprocess/pp_common_vs.glsl', '@shaders/ibl/radiance_fs.glsl', (pass) => {
    //     radiancePass = pass;
    //     pass.setViewport(0, 0, radianceRes, radianceRes).setDepthFunc(rc.ZTEST_ALWAYS).setShaderFlag('USE_CUBEMAP_TEXCOORD', 1);
    //     asyncLoadCallback();
    // });
    rc.createRenderPassFromSourcePath('irradiance', '@shaders/postprocess/pp_common_vs.glsl', '@shaders/ibl/irradiance_fs.glsl', (pass) => {
        irradiancePass = pass;
        pass.setViewport(0, 0, irradianceRes, irradianceRes).setDepthFunc(rc.ZTEST_ALWAYS).setShaderFlag('USE_CUBEMAP_TEXCOORD', 1);
        asyncLoadCallback();
    });
    rc.createRenderPassFromSourcePath('brdf lut', '@shaders/postprocess/pp_common_vs.glsl', '@shaders/ibl/brdf_lut_fs.glsl', (pass) => {
        brdfPass = pass;
        pass.setViewport(0, 0, brdfLutRes, brdfLutRes).setDepthFunc(rc.ZTEST_ALWAYS);
        asyncLoadCallback();
    });

    return ret;
}

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
        }
    }

    init() {
        // IBL
        this.ibl = createIBL('@images/pedestrian_overpass_1k.hdr');
        // standard pass
        this.stdRenderPass = rc.createRenderPassFromSourcePath('std', '@shaders/std_vs.glsl', '@shaders/std_fs.glsl').setLoadAction(false, false);
        // final pass
        this.finalPass = rc.createRenderPassFromSourcePath('final', '@shaders/postprocess/pp_common_vs.glsl', '@shaders/postprocess/pp_final_fs.glsl')
            .setLoadAction(true, true).setDepthFunc(rc.ZTEST_LEQUAL).setShaderFlag('USE_CUBEMAP_TEXCOORD', 1);
    }

    renderScene() {
        if (!this.gltfLoader.isReady) return;

        let opaqueList = [];
        //let maskedList = [];
        //let translucentList = [];
        this.gltfLoader.getDrawcallLists(opaqueList);

        // draw meshes
        this.stdRenderPass.setShaderParameters({
            uIrradianceMap: this.ibl.irradianceMap,
            uView: this.viewMat,
            uProj: this.projMat
        }).execute(opaqueList);

        // maybe some postprocess
        this.finalPass.setShaderParameters({
            uInvViewProj: mathUtils.invMatrix(mathUtils.mulMatrices(this.projMat, this.viewMat)),
            uBackGround: this.ibl.radianceMap
        }).execute([screenDrawcall]);
    }

    render() {
        this._checkSize(this.canvas);

        this.renderScene();
    }
}

export { Renderer }

