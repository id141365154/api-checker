#!/usr/bin / env node

const fs = require("fs");
const child_process = require("child_process");
const readline = require("readline");
const https = require("https");
const printMessage = require("print-message");

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", err => {
  throw err;
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const baseFile = "base.txt";
const tempFile = "temp.txt";
const confName = "api-check.config.json";
let config = "";

try {
  config = fs.readFileSync(confName, "utf8");
} catch (e) {
  console.log("\x1b[31m", `Can\`t read config file: ${confName}`);
  throw e;
}

try {
  config = JSON.parse(config);
} catch (e) {
  console.log(`Can\`t parse config file: ${confName}`);
  throw e;
}

printMessage(["API CHANGES"]);

const makeFilename = url => {
  return url
    .replace(/(http?s:\/\/)/g, "")
    .replace(/(www\.)/g, "")
    .replace(/\W/g, "_");
};

Promise.all(
  config.urls.map(
    url =>
      new Promise((resolve, reject) => {
        https
          .get(url, resp => {
            let data = "";

            // A chunk of data has been recieved.
            resp.on("data", chunk => {
              data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on("end", () => {
              console.log("\x1b[32m", "Fetch: " + url);
              let parsedData = data;
              try {
                data = JSON.parse(data);
                parsedData = JSON.stringify(data, null, 4);
              } catch (e) {}

              saveFile(
                config.tmpPath + makeFilename(url) + "_" + tempFile,
                parsedData,
                function(err) {
                  if (err) {
                    resolve({
                      error: "NetworkError"
                    });
                    return console.log(err);
                  }
                  console.log("", "Done");
                  if (
                    !fs.existsSync(
                      config.tmpPath + makeFilename(url) + "_" + baseFile
                    )
                  ) {
                    console.log("", "Local data does not exist, make it");
                    saveFile(
                      config.tmpPath + makeFilename(url) + "_" + baseFile,
                      parsedData,
                      function(err) {
                        if (err) {
                          return console.log(err);
                        }

                        checkDiff(resolve, url);
                      }
                    );
                  } else {
                    checkDiff(resolve, url);
                  }
                }
              );
            });
          })
          .on("error", err => {
            resolve({
              error: "NetworkError"
            });
            printMessage(
              ["Can`t resolve remote data", url, "API check bypassed"],
              {
                borderColor: "red"
              }
            );
            process.exit();
          });
      })
  )
)
  .then(results => {
    let hasDiff = false;

    results.map(res => {
      if (!res.proceed) {
        hasDiff = true;
        printMessage([res.url]);
        showChangesAlert(res.diff);
      }
    });

    if (hasDiff) {
      printMessage(
        ["Please, confirm that you are read this message, and we will proceed"],
        {
          borderColor: "red"
        }
      );
      rl.question("[y/n] ", answer => {
        if (answer.match(/^y(es)?$/i)) {
          results.map(res => updateBaseFile(res.url));
        } else {
          const err = new Error(
            "Aborted. Please read API changes and confirm it next time"
          );
          throw err;
        }

        rl.close();
      });
    } else {
      printMessage(["You are using actual API"], {
        borderColor: "green"
      });
      process.exit();
    }
  })
  .catch(console.log);

function saveFile(path, content, callback) {
  if (!fs.existsSync(config.tmpPath)) {
    fs.mkdirSync(config.tmpPath);
  }
  return fs.writeFile(path, content, "utf8", callback);
}

function updateBaseFile(url) {
  const tmpData = fs.readFileSync(
    config.tmpPath + makeFilename(url) + "_" + tempFile,
    "utf8"
  );
  saveFile(
    config.tmpPath + makeFilename(url) + "_" + baseFile,
    tmpData,
    function(err) {
      if (err) {
        return console.log(err);
      }
      console.log("\x1b[32m", url + " Updated!");
      process.exit();
    }
  );
}

function checkDiff(resolve, url) {
  child_process.exec(
    "git diff  --no-index " +
      config.tmpPath +
      makeFilename(url) +
      "_" +
      baseFile +
      " " +
      config.tmpPath +
      makeFilename(url) +
      "_" +
      tempFile,
    function(error, stdout, stderr) {
      if (stdout) {
        resolve({
          diff: stdout,
          proceed: false,
          url: url
        });
      } else {
        resolve({
          diff: "",
          proceed: true,
          url: url
        });
      }
    }
  );
}

function showChangesAlert(body) {
  var arDiff = body.split("\n");
  arDiff.forEach((str, i) => {
    let color = "\x1b[37m";

    if (str[0] === "-") {
      color = "\x1b[31m";
    }
    if (str[0] === "+") {
      color = "\x1b[32m";
    }

    console.log(color, str);
  });
}
