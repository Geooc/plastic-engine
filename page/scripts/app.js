// app.js: main entry

import { Renderer } from './scene/renderer.js'
import { Controller } from './scene/controller.js'
import { GLTFLoader } from './scene/gltf-loader.js'

var ui = new Vue({
    el: '#ui',
    data: {
        text: 'Hello Vue!',
        nodes : [

        ]
    }
})

class App {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.renderer = new Renderer(this.gltfLoader);
        this.controller = new Controller(this.renderer, this.gltfLoader, ui);
    }

    init() {
        this.gltfLoader.load('@boss/scene.gltf');
        this.renderer.init();
        ui.text = 'init succcess!';
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

