// controller.js: scene camera and input handler

import { mathUtils } from '../utils/math-utils.js'

const MoveMode = {
    NONE: 0,
    ROT: 1,
    TRANS: 2,
};

class Controller {
    constructor(renderer, gltfLoader, ui) {
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

        this._moveMode = MoveMode.NONE;

        this.renderer = renderer;
        this._addController(ui.$el);

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

    _handleTrans(x, y) {
        let deltaX = (this.startX - x) * this.cameraScaleSpeed;
        let deltaY = (y - this.startY) * this.cameraScaleSpeed;
        let RightAndUp = mathUtils.calcOrbitViewRightAndUp(this.pitch, this.yaw);
        this.targetAt = mathUtils.addVector(this.recordAt, mathUtils.scaleVector(RightAndUp[0], deltaX));
        this.targetAt = mathUtils.addVector(this.targetAt, mathUtils.scaleVector(RightAndUp[1], deltaY));
    }

    _handleMove(x, y) {
        switch (this._moveMode) {
            case MoveMode.ROT:
                this._handleRot(x, y);
                break;
            case MoveMode.TRANS:
                this._handleTrans(x, y);
                break;
            default:
                break;
        }
    }

    _handleScale(scale) {
        this.targetRadius = Math.max(this.targetRadius + scale * this.cameraScaleSpeed, 2);
    }
    // todo: needs refactor
    _addController(ui) {
        ui.onmousedown = (e) => {
            e.preventDefault();
            this._recordStart(e.clientX, e.clientY);

            switch (e.buttons) {
                case 1:
                    this._moveMode = MoveMode.ROT;
                    break;
                case 4:
                    this._moveMode = MoveMode.TRANS;
                    break;
                default:
                    break;
            }
        }
        ui.onmouseup = (e) => {
            e.preventDefault();
            this._moveMode = MoveMode.NONE;
        }
        ui.onmousemove = (e) => {
            e.preventDefault();
            this._handleMove(e.clientX, e.clientY);
            // ui.onMouseMove(e.clientX, e.clientY);
        }
        ui.onwheel = (e) => {
            e.preventDefault();
            this._handleScale(e.deltaY);
        }
        // for touch screen
        // todo: two finger
        ui.addEventListener('touchstart', (e) => {
            if (e.targetTouches.length != 1) return;
            e.preventDefault();
            this._recordStart(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
            this._moveMode = MoveMode.ROT;
        })
        ui.addEventListener('touchend', (e) => {
            if (e.targetTouches.length == 1) this._moveMode = MoveMode.NONE;
        });
        ui.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this._handleMove(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
        });
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

