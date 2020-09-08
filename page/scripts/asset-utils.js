function readText(url, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = () => { callback(xhr.responseText); }
    xhr.send();
}

function loadVertexShaderAndFragmentShader(vsUrl, fsUrl, callback) {
    let vsSrc, fsSrc;
    readText(vsUrl, (src) => { vsSrc = src; if (fsSrc) callback(vsSrc, fsSrc); });
    readText(fsUrl, (src) => { fsSrc = src; if (vsSrc) callback(vsSrc, fsSrc); });
}

function loadImage(url, callback) {
    let img = new Image();
    img.onload = () => { callback(img) };
    img.src = url;
}

// gltf
function loadDataAsArrayBuffer(url, callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = "blob";
    xhr.onload = () => {
        if (xhr.response) {
            let reader = new FileReader();
            reader.readAsArrayBuffer(xhr.response);
            reader.onload = callback;
        }
        else alert(`can't load data from ${url}!`);
    };
    xhr.send();
}

function loadMeshesFromGLTF(gltf, gltfArrayBuffers, scene) {
    // todo
}

function loadAnimationsFromGLTF(gltf, gltfArrayBuffers, scene) {
    // todo
}

function loadMaterialsFromGLTF(gltf, path, scene) {
    // todo
}

function loadSceneFromGLTF(url, callback) {
    let scene = {};
    const path = url.slice(0, url.lastIndexOf('/') + 1);
    let xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = () => {
        const gltf = JSON.parse(xhr.responseText);
        if (!gltf) alert('wrong gltf file!');
        // load data refed by gltf
        //if (!gltf.buffers) return;
        let gltfArrayBuffers = new Array(gltf.buffers.length);
        let loadedBuffersCount = 0;
        for (let i = 0; i < gltf.buffers.length; ++i) {
            let gltfArrayBuffer = gltfArrayBuffers[i];
            loadDataAsArrayBuffer(path + gltf.buffers[i].uri, (e) => {
                gltfArrayBuffer = e.target.result;
                // start load after all buffers ready
                if (++loadedArrayBuffersCount == gltf.buffers.length) {
                    loadMeshesFromGLTF(gltf, gltfArrayBuffers, scene);
                    loadAnimationsFromGLTF(gltf, gltfArrayBuffers, scene);
                    loadMaterialsFromGLTF(gltf, path, scene);
                    callback(scene);
                }
            });
        }
    };
    xhr.send();
}

export { readText, loadVertexShaderAndFragmentShader, loadImage }