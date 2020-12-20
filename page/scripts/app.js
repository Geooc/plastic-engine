// app.js: main entry

import { Renderer } from './scene/renderer.js'
import { Controller } from './scene/controller.js'
import { GLTFLoader } from './scene/gltf-loader.js'

class App {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.renderer = new Renderer(this.gltfLoader);
        this.controller = new Controller(this.renderer, this.gltfLoader);
    }

    init() {
        this.gltfLoader.load('@scene/scene.gltf');
        this.renderer.init();
    }

    tick(now) {
        this.controller.update(now);
        this.renderer.render();
    }
}

let app = new App();
app.init();

(function loop(now) {
    app.tick(now);
    requestAnimationFrame(loop);
})(0)

