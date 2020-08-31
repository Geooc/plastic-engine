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
        let filename, filepath;
        if (req.url.startsWith('/@')) {// read from project path
            filename = '/' + req.url.slice(2);
            filepath = projectPath;
        }
        else {
            filename = url.parse(req.url, true).pathname;
            if (filename == '/') filename = '/index.html';
            filepath = path.resolve(__dirname, 'page');
        }
        filepath = path.join(filepath, filename);

        fs.readFile(filepath, (err, data) => {
            if (err) {
                res.statusCode = 404;
            }
            else {
                let ext = filename.substr(filename.lastIndexOf('.') + 1);
                switch (ext) {
                    case 'js':
                        res.setHeader('Content-Type', 'application/javascript');
                        break;
                    default:
                        break;
                }
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
