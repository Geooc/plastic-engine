function check (condition, log) {
    if (!condition) alert(log);
}

function error(log) {
    alert(log);
}

function warning(log) {
    // todo
}

export { check, error }