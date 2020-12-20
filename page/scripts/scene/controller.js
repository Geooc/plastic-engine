// controller.js: scene camera and input handler

import { mathUtils } from '../utils/math-utils.js'

class Controller {
    constructor(renderer, gltfLoader) {
        this.frame = 0;
        this.delta = 0;
        this._lastFrame = 0;
        
        this.pitch = 0;
        this.yaw = 0;
        this.radius = 5;
        this.at = [0, 0, 0];
        this.cameraScaleSpeed = 0.01;
        this.cameraRotSpeed = 0.5;
        this.cameraSmooth = 10.0;
        this.targetPitch = this.pitch;
        this.targetYaw = this.yaw;
        this.targetRadius = this.radius;
        this.targetAt = this.at;
        this.needFitBounds = true;

        this.renderer = renderer;
        this._addCameraController(renderer.canvas);

        this.gltfLoader = gltfLoader;
    }

    _fitBounds(bounds) {
        this.targetAt = this.at = [
            (bounds.max[0] + bounds.min[0]) / 2,
            (bounds.max[1] + bounds.min[1]) / 2,
            (bounds.max[2] + bounds.min[2]) / 2,
        ];
        this.targetRadius = this.radius = Math.max(
            bounds.max[0] - bounds.min[0],
            Math.max(
                bounds.max[1] - bounds.min[1],
                bounds.max[2] - bounds.min[2],
            )
        );
        this.cameraScaleSpeed = this.targetRadius / 1000;
    }

    _recordStart(x, y) {
        this.startX = x;
        this.startY = y;
        this.recordPitch = this.pitch;
        this.recordYaw = this.yaw;
        this.recordAt = this.at;
    }

    _handleRot(x, y) {
        let deltaX = (x - this.startX) * this.cameraRotSpeed;
        let deltaY = (y - this.startY) * this.cameraRotSpeed;
        this.targetPitch = this.recordPitch + deltaX;
        this.targetYaw = Math.max(Math.min(this.recordYaw + deltaY, 75), -75);
    }

    _handleMove(x, y) {
        let deltaX = (this.startX - x) * this.cameraScaleSpeed;
        let deltaY = (y - this.startY) * this.cameraScaleSpeed;
        let RightAndUp = mathUtils.calcOrbitViewRightAndUp(this.pitch, this.yaw);
        this.targetAt = mathUtils.addVector(this.recordAt, mathUtils.scaleVector(RightAndUp[0], deltaX));
        this.targetAt = mathUtils.addVector(this.targetAt, mathUtils.scaleVector(RightAndUp[1], deltaY));
    }

    _handleScale(scale) {
        this.targetRadius = Math.max(this.targetRadius + scale * this.cameraScaleSpeed, 2);
    }
    // todo: needs refactor
    _addCameraController(canvas) {
        canvas.onmousedown = (e) => {
            e.preventDefault();
            this._recordStart(e.clientX, e.clientY);
            if (e.buttons == 1) {
                canvas.onmousemove = (e) => {
                    e.preventDefault();
                    this._handleRot(e.clientX, e.clientY);
                }
            }
            else if (e.buttons == 4) {
                canvas.onmousemove = (e) => {
                    e.preventDefault();
                    this._handleMove(e.clientX, e.clientY);
                }
            }
            canvas.onmouseup = (e) => {
                canvas.onmousemove = null;
            }
        }
        canvas.onwheel = (e) => {
            e.preventDefault();
            this._handleScale(e.deltaY);
        }
        // for touch screen
        // todo: use HAMMER.JS
        canvas.addEventListener('touchstart', (e) => {
            if (e.targetTouches.length != 1) return;
            e.preventDefault();
            this._recordStart(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
            canvas.addEventListener('touchmove', (e) => {
                if (e.targetTouches.length == 1) {
                    e.preventDefault();
                    this._handleRot(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
                }
                else if (e.targetTouches.length == 2) {
                    // todo
                }
            });
            canvas.addEventListener('touchend', (e) => {
                if (e.targetTouches.length == 1)
                    canvas.addEventListener('touchmove', null);
            });
        })//
    }

    update(now) {
        // time
        this.delta = (now - this._lastFrame) * 0.001;
        this.frame = now * 0.001;
        this._lastFrame = now;
        // fit bounds
        if (this.needFitBounds && this.gltfLoader.isReady) {
            this._fitBounds(this.gltfLoader.geometry.bounds);
            this.needFitBounds = false;
        }
        // view
        let amount = this.cameraSmooth * this.delta;
        this.pitch += (this.targetPitch - this.pitch) * amount;
        this.yaw += (this.targetYaw - this.yaw) * amount;
        this.radius += (this.targetRadius - this.radius) * amount;
        this.at = mathUtils.addVector(mathUtils.scaleVector(mathUtils.subVector(this.targetAt, this.at), amount), this.at);
        // set view mat
        this.renderer.viewMat = mathUtils.calcOrbitViewMatrix(this.pitch, this.yaw, this.radius, this.at);
        this.gltfLoader.setAnimation(this.frame);
    }
}

export { Controller }

