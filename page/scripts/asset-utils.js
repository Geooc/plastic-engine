let assetUtils = {
    readText : function(url, callback) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = () => { callback(xhr.responseText); }
        xhr.send();
    },
    
    loadVertexShaderAndFragmentShader : function(vsUrl, fsUrl, callback) {
        let vsSrc, fsSrc;
        this.readText(vsUrl, (src) => { vsSrc = src; if (fsSrc) callback(vsSrc, fsSrc); });
        this.readText(fsUrl, (src) => { fsSrc = src; if (vsSrc) callback(vsSrc, fsSrc); });
    },
    
    loadImage : function(url, callback) {
        let img = new Image();
        img.onload = () => { callback(img) };
        img.src = url;
    },
    
    loadBinaryAsArrayBuffer : function(url, callback) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = "blob";
        xhr.onload = () => {
            if (xhr.response) {
                let reader = new FileReader();
                reader.readAsArrayBuffer(xhr.response);
                reader.onload = (e) => {
                    callback(e.target.result);
                };
            }
            else alert(`can't load ${url}!`);
        };
        xhr.send();
    },
    
    loadGLTF : function(url, callback) {
        const path = url.slice(0, url.lastIndexOf('/') + 1);
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = () => {
            const gltf = JSON.parse(xhr.responseText);
            if (!gltf || !gltf.buffers) {
                alert('wrong gltf file!');
                return;
            }
            // load buffers first
            let gltfArrayBuffers = new Array(gltf.buffers.length);
            let loadedArrayBuffersCount = 0;
            for (let i = 0; i < gltf.buffers.length; ++i) {
                this.loadBinaryAsArrayBuffer(path + gltf.buffers[i].uri, (arrayBuffer) => {
                    gltfArrayBuffers[i] = arrayBuffer;
                    if (++loadedArrayBuffersCount == gltf.buffers.length) {
                        callback(gltf, gltfArrayBuffers);
                    }
                });
            }
        };
        xhr.send();
    },
};

export { assetUtils }