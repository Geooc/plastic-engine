// app.js: main entry

import { Renderer } from './scene/renderer.js'
import { Controller } from './scene/controller.js'
import { GLTFLoader } from './scene/gltf-loader.js'
import { UserInterface } from './ui/user-interface.js'

class App {
    constructor() {
        this.ui = new UserInterface();
        this.gltfLoader = new GLTFLoader();
        this.renderer = new Renderer(this.gltfLoader);
        this.controller = new Controller(this.renderer, this.gltfLoader, this.ui);
    }

    init() {
        this.gltfLoader.load('@boss/scene.gltf');
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

