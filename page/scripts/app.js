import { WebGLContext } from './webgl-context.js'

class App {
    constructor() {
        this.frame = 0;
        this.delta = 0;
        this._lastFrame = 0;

        this.glContext = new WebGLContext();
    }

    updateTime(now) {
        this.delta = (now - this._lastFrame) * 0.001;
        this.frame = now * 0.001;
        this._lastFrame = now;
    }

    resize(width, height) {
        // todo: camera perspective
        console.log('resized');
        this.glContext.setViewport(0, 0, width, height);
    }

    checkSize(canvas) {
        let displayWidth = Math.floor(canvas.clientWidth * window.devicePixelRatio);
        let displayHeight = Math.floor(canvas.clientHeight * window.devicePixelRatio);
        if (canvas.width != displayWidth || canvas.height != displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            this.resize(canvas.width, canvas.height);
        }
    }

    init() {

    }

    tick(now) {
        this.updateTime(now);
        this.checkSize(this.glContext.getCanvas());

        this.glContext.clearColorAndDepth();
    }
}

let app = new App();

app.init();

(function loop(now) {
    app.tick(now);
    requestAnimationFrame(loop);
})(0)