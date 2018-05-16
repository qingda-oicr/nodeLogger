var ts = require('tail-stream')
    , es = require('event-stream')
    , leftPad = require('left-pad')
    , defaultFields = require('./viewFields.js')

var lineNr = 0;
var indent = "                      ";

var args = process.argv;
//console.log(args);
args.splice(0, 2);
var argSet = "";
var viewFields = [];
var viewAll = false;
var constraints = {};
for (var i = 0; i<args.length; i++) {
    if (args[i] == '-a') {
        //console.log('HIT C');
        viewAll = true;
    }
    else if (args[i] == '-c') {
        //console.log('HIT C');
        argSet = "constraints";
    }
    else if (args[i] == '-v') {
        //console.log('HIT C');
        argSet = "filter";
    }
    else if (argSet == "filter") {
        viewFields.push(args[i]);
    } 
    else if (argSet == "constraints") {
        //console.log(args[i]);
        var constraint = args[i].split("=");
        constraints[constraint[0]] = constraint[1];
    }
}

if (viewFields.length == 0) {
    /*viewFields = [
        'req',
        'res',
        'url',
        'method',
        'statusCode',
    ];*/
    viewFields = defaultFields;
}
//console.log(viewFields);

/*var constraints = {
    //"hostname": "a3613a3aabd5",
    "res": { "statusCode": 404 }
}*/

function dateMaker(timeStamp) {
    //console.log("TIMESTAMP : ", timeStamp);
    var d = new Date(timeStamp);
    //var months = 
    var year = d.getFullYear();
    //console.log("YEAR : " + year);
    var month = "0" + (d.getMonth() + 1);
    var date = "0" + d.getDate();
    var hour = d.getHours();
    var minute = "0" + d.getMinutes();
    var second = "0" + d.getSeconds();

    var time = "[" + year + "-" + month.substr(-2) + "-" + date.substr(-2) + " | " + hour + ":" + minute.substr(-2) + ":" + second.substr(-2) + "]"; 
    return time;
}

function alertLevel(levelCode) {
    switch(levelCode) {
        case 100:
            return "OFF\x1b[0m";
        case 60:
            return "\x1b[31mFATAL\x1b[0m";
        case 50:
            return "\x1b[31mERROR\x1b[0m";
        case 40:
            return "\x1b[33mWARN\x1b[0m";
        case 30:
            return "\x1b[32mINFO\x1b[0m";
        case 20:
            return "\x1b[33mDEBUG\x1b[0m";
        case 10:
            return "\x1b[32mTRACE\x1b[0m";
        default:
            return "unknown";
    }
}

function otherFields(viewFields, jsonOutput) {
    var print = "";
    //console.log(viewFields);
    viewFields.forEach((field) => {
        //console.log(field);
        var fields = field.split(".");
        //print = print + indent + "|\x1b[34m" + field + "\x1b[0m : \x1b[37m" + fieldGetter(fields, jsonOutput) + "\x1b[0m\n";
        field = leftPad(field, 22);
        print = print + "\x1b[34m" + field + "\x1b[0m| " + fieldGetter(fields, jsonOutput) + "\x1b[0m\n";
        //console.log(print);
    })
    return print;
}

function otherFieldsObj(viewFields, jsonOutput) {
    var fieldObj = {};
    //console.log(viewFields);
    viewFields.forEach((field) => {
        //console.log(field);
        var fields = field.split(".");
        fieldObj[field] = fieldGetter(fields, jsonOutput);
        console.log(fieldObj[field]);
    })
    return fieldObj;
}

function fieldGetter(fieldArray, object) {
    //console.log("fieldarray : " + fieldArray);
    if (fieldArray.length == 1) {
        //console.log(fieldArray[0] + " " + object);
        return object[fieldArray[0]];
    }
    else {
        var field = fieldArray.shift();
        //console.log(object[field]);
        return fieldGetter(fieldArray, object[field]);
    }
}

var jsonify = (input) => {
    
    /*var viewFields = */
    var jsonOutput = "";

    // try-catch block to process only those lines that are json, remaining go into catch block.
    try {
        //jsonOutput = JSON.parse(input); 
        jsonOutput = JSON.parse(input.replace(/ 0+(?![\. }])/g, ' '));
        //console.log("TIME : ", jsonOutput.time);
        for (var val in constraints) {
            var constraintArray = val.split(".");
            if (fieldGetter(constraintArray, jsonOutput) != constraints[val]) {
                return "";
            }
        }
        
        var time = "\x1b[37m" + dateMaker(jsonOutput.time) + "\x1b[0m";
        //var time = "\x1b[1m" + dateMaker(jsonOutput.time) + "\x1b[0m";
        var level = alertLevel(jsonOutput.level);
        var process = "(" + jsonOutput.pid + " on " + jsonOutput.hostname + ")";
        var message = "\x1b[36m" + jsonOutput.msg + "\x1b[0m";
        var others = otherFields(viewFields, jsonOutput);
        //var othersObj = otherFieldsObj(viewFields, jsonOutput);
        //othersObj = [othersObj];
        //console.log(othersObj);
        //console.log(time);
        jsonOutput = JSON.stringify(jsonOutput, null, 2);
        var fields = viewAll ? jsonOutput : others;
        
        return time + " " + level + " " + process + ": " + message + '\n' + fields;
    }
    catch (error) {
        jsonOutput="";
    }
    return jsonOutput;
};

var s = ts.createReadStream('combined.log')
    .pipe(es.split())
    .pipe(es.mapSync(function (line) {

        //console.log(s);

        // pause the readstream
        //s.pause();

        lineNr += 1;

        // process line here and call s.resume() when rdy
        // function below was for logging memory usage

        var output = jsonify(line);
        if (output !== "")
            process.stdout.write(output);

        //console.log(lineNr, " : ", line);
        // resume the readstream, possibly from a callback
        //s.resume();
    })
        .on('error', function (err) {
            console.log('Error while reading file.', err);
        })
        .on('end', function () {
            console.log('Read entire file.')
        })
    );
