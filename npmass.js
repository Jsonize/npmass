const GetOpt = require("node-getopt");
const FS = require("fs");
const Template = require('lodash.template');
const ChildProcess = require("child_process");


const parsedArgs = GetOpt.create([
    ["h", "help", "shows help"],
    ["o", "overwrite=ARG+", "custom argument overwrite"],
    ["p", "print", "print evaluated package.json"],
    ["r", "run=NAME", "run a script"]
]).bindHelp().parseSystem();

var customArgs = {};
(parsedArgs.options.overwrite || []).forEach(function (keyvalue) {
    var splt = keyvalue.split(":");
    customArgs[splt.shift()] = splt.join(":");
});

const pkg = JSON.parse(FS.readFileSync("package.json"));


const objectMap = function (obj, f) {
    if (typeof obj === "object") {
        var result = {};
        for (var key in obj)
            result[key] = objectMap(obj[key], f);
        return result;
    } else
        return f(obj);
};

const objectValueEvaluationPass = function (value, env) {
    if (typeof value === "string")
        return Template(value)(env);
    else
        return value;
};

const objectEvaluationPass = function (obj, env) {
    var failures = 0;
    var result = objectMap(obj, function (value, key) {
        try {
            return objectValueEvaluationPass(value, env);
        } catch (e) {
            failures++;
            return value;
        }
    });
    return {
        failures: failures,
        result: result
    };
};

const objectEvaluation = function (obj, env) {
    var result = obj;
    var failures = 1;
    var lastFailures = 0;
    while (failures > 0 && failures !== lastFailures) {
        lastFailures = failures;
        env.pkg = result;
        const update = objectEvaluationPass(result, env);
        result = update.result;
        failures = update.failures;
    }
    return result;
};


const evpkg = objectEvaluation(pkg, {
    args: customArgs
});


if (parsedArgs.options.print)
    console.log(evpkg);

if (parsedArgs.options.run) {
    const cmd = evpkg.scripts[parsedArgs.options.run];
    const args = cmd.split(" ");
    const spwn = args.shift();
    const prc = ChildProcess.spawn(spwn, args);
    prc.stderr.pipe(process.stderr);
    prc.stdout.pipe(process.stdout);
}
