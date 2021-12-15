const { program } = require("commander");
const FS = require("fs");
const Template = require('lodash.template');
const ChildProcess = require("child_process");
const Extend = require("extend");


program
    .option("-o, --overwrite <arg...>", "custom argument overwrite")
    .option("-p, --print", "print evaluated package.json")
    .option("-r, --run <name>", "run a script")
    .option("-i, --increaseversion", "increase package version");

program.parse(process.argv);
const options = program.opts();

var customArgs = {};
(options.overwrite || []).forEach(function (keyvalue) {
    var splt = keyvalue.split(":");
    customArgs[splt.shift()] = splt.join(":");
});

var pkg = JSON.parse(FS.readFileSync("package.json"));

if (pkg.npmass) {
    if (pkg.npmass.increaseversion) {
        options.increaseversion = true;
    }
    if (pkg.npmass.includes) {
        pkg.npmass.includes.forEach(function (incl) {
            if (FS.existsSync(incl))
                pkg = Extend(pkg, JSON.parse(FS.readFileSync(incl)));
        });
    }
}

if (options.increaseversion) {
    const last = JSON.parse(ChildProcess.execSync("git show HEAD:package.json") + "");
    if (pkg.version === last.version) {
        const version = pkg.version.split(".");
        var revision = parseInt(version.pop(), 10);
        revision += 1;
        version.push(revision + "");
        pkg.version = version.join(".");
        FS.writeFileSync("package.json", JSON.stringify(pkg, "", 4));
    }
}

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


if (options.print)
    console.log(evpkg);

if (options.run) {
    let cmd = evpkg.scripts[options.run];
    console.log(cmd);
    const next = function (cmds) {
        if (cmds.length > 0) {
            let cmd = cmds.shift().trim();
            var args = cmd.split(" ");
            if (cmds.length === 0)
                args = args.concat(program.args);
            let spwn = args.shift();
            let prc = ChildProcess.spawn(spwn, args, {
                shell: true
            });
            prc.stderr.pipe(process.stderr);
            prc.stdout.pipe(process.stdout);
            prc.on("close", function () {
                next(cmds);
            });
        }
    };
    next(cmd.split("&&"));
}