function parseHDRI(arrayBuffer) {
    let hdri = {
        data: null,
        width: 0,
        height: 0
    };

    let index = 0;
    const u8Array = new Uint8Array(arrayBuffer);
    // header
    let header = '';
    while (!header.match(/\n\n[^\n]+\n/g)) header += String.fromCharCode(u8Array[index++]);
    // format
    if (header.match(/FORMAT=(.*)$/m)[1] != '32-bit_rle_rgbe') alert('wrong hdri format!');
    // size
    const resolutionString = header.split(/\n/).reverse()[1].split(' ');
    hdri.width = parseInt(resolutionString[3], 10);
    hdri.height = parseInt(resolutionString[1], 10);
    // pixel data
    hdri.data = new Float32Array(hdri.width * hdri.height * 3);
    let scanlineData = new Uint8Array(hdri.width * 4);
    let scanlinePtr = 0;
    for (let j = 0; j < hdri.height; ++j) {
        if (2 != u8Array[index] || 2 != u8Array[index + 1] || (u8Array[index + 2] & 0x80)) alert('bad scanline!');
        index += 4;
        // decode scanline
        scanlinePtr = 0;
        while (scanlinePtr < scanlineData.length) {
            let count = u8Array[index++];
            if (count > 128) {// repeat data
                count -= 128;
                let repeatData = u8Array[index++];
                while (count--) scanlineData[scanlinePtr++] = repeatData;
            }
            else {
                scanlineData.set(u8Array.subarray(index, index + count), scanlinePtr);
                index += count; scanlinePtr += count;
            }
        }
        // fill in Float32Array
        for (let i = 0; i < hdri.width; ++i) {
            let scale = Math.pow(2.0, scanlineData[hdri.width * 3 + i] - 128.0) / 255.0;
            let ofs = (j * hdri.width + i) * 3;
            hdri.data[ofs + 0] = scanlineData[hdri.width * 0 + i] * scale;
            hdri.data[ofs + 1] = scanlineData[hdri.width * 1 + i] * scale;
            hdri.data[ofs + 2] = scanlineData[hdri.width * 2 + i] * scale;
        }
    }

    return hdri;
};

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

    loadHDRImage : function(url, callback) {
        this.loadBinaryAsArrayBuffer(url, (arrayBuffer) => {
            callback(parseHDRI(arrayBuffer));
        });
    },
    
    loadBinaryAsArrayBuffer : function(url, callback) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
            if (xhr.response) callback(xhr.response);
            else alert(`can't load ${url}!`);
        };
        xhr.send();
    },
};

export { assetUtils }

