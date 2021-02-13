// user-interface.js

import { renderContext as rc } from '../render-context.js'
import { mathUtils } from '../utils/math-utils.js'

let uiVbo = rc.createVertexBuffer().setData(new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]));
let uiDrawcall = rc.createDrawcall(rc.PRIM_TRIANGLE_STRIP, 4).bind().setAttributes({
    aPos: { buffer: uiVbo, size: 2, type: rc.DATA_FLOAT }
}).unbind();

const CompType = {
    TEXT: 0,
    INPUT: 1,
    BUTTON: 2,
    CHECK_BOX: 3,
    RADIO_BOX: 4,
    DROP_MENU: 5,
    NEW_LINE: 6
}

class UserInterface
{
    constructor() {
        this.lineSpacing = 2;
        this.compSpacing = 2;

        this.compPadding = 2;
        this.compBorder = 1;

        this.panelPadding = 2;
        this.panelBorder = 1;

        // color
        this.compBgColor = [0.8, 0.8, 0.8, 0.0];
        
        this.panelMap = {
            default: {
                name: 'default',
                content: [],
            }
        };
        this.curPanel= this.panelMap['default'];
        this.curInputComp = null;

        this._statesMap = {};

        this._pickedList = [ null ];
        this._pickedId = 0;
        this._pickedName = '';

        this._hoveredId = 0;
        this._hoveredName = '';
        
        this._releasing = false;
        this._pressing = false;

        this._isHovered = false;
    }

    beginPanel(name) {
        if (this.panelMap[name]) {
            this.curPanel = this.panelMap[name];
        }
        else {
            this.panelMap[name] = {
                name: name,// title
                pos: [100, 100],
                size: null,// null means adaptive
                bg: '#ffffffff',// url or color code
                content: [],
            }
            this.curPanel = this.panelMap[name];
        }
    }

    endPanel() {
        this.curPanel = this.panelMap['default'];
    }

    text(str) {
        this.curPanel.content.push({
            type: CompType.TEXT,
            str: str
        });
    }

    input(str, onlyNumber = false) {
        // todo
    }

    button(name,) {
        this.curPanel.content.push({
            type: CompType.BUTTON,
            name: name
        });
        const compName = this.curPanel.name + '.' + name;
        this._pickedList.push(compName);
        // clicked
        if (this._releasing && compName == this._pickedName) return true;
        return false;
    }

    checkBox(value) {
        // todo
    }

    radioBox(name, list) {
        // todo
    }

    dropMenu(name, list) {
        // todo
    }

    sameLine() {
        // todo
        return this;
    }

    // event callback
    onPress(button) {
        //
    }

    onRelease(button) {
        //
    }

    onMouseMove(x, y) {
        //
    }

    onKey(key) {
        //
    }

    // states
    isHovered() {
        return this._isHovered;
    }
}

export { UserInterface }

