#!/usr/bin/env node

function newProject(projectPath) {
    //
}

function openProject(projectPath) {
    const http = require('http');
    const url = require('url');
    const path = require('path');
    const fs = require('fs');

    const port = 2020;
    const editorUrl = 'http://localhost:' + port;

    const server = http.createServer((req, res) => {
        let filename = url.parse(req.url, true).pathname;
        if (filename == '/') filename = '/index.html';
        let filepath = path.resolve(__dirname, 'page');
        filepath = path.join(filepath, filename);
        console.log(filepath);

        fs.readFile(filepath, function (err, data) {
            if (err) {
                res.write('404 Not Found');
            }
            else {
                res.write(data);
            }
            res.end();
        });
    });
    server.listen(port);

    const exec = require('child_process').exec;
    switch (process.platform) {
        case 'darwin':
            exec(`open ${editorUrl}`);
            break;
        case 'win32':
            exec(`start ${editorUrl}`);
            break;
        default:
            exec(`xdg-open ${editorUrl}`);
            break;
    }
    console.log('Running at', editorUrl);
}

function buildProject(projectPath) {
    //
}

const args = process.argv.slice(2);

if (args[0]) {
    if (args[0] == 'new') {
        newProject(process.cwd());
    }
    else if (args[0] == 'open') {
        openProject(process.cwd());
    }
    else if (args[0] == 'build') {
        buildProject(process.cwd());
    }
    else {
        console.log('Wrong parameter(s)');
    }
}
else {
    // todo: print help
    console.log('Help');
}
