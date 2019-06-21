#!/usr/bin / env node

const fs = require("fs");
const child_process = require("child_process");
const readline = require("readline");
const https = require("https");

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
              console.log("\x1b[32m", "Fetch remote data");
              saveFile(config.tmpPath + tempFile, data, function(err) {
                if (err) {
                  resolve({ error: "NetworkError" });
                  return console.log(err);
                }
                console.log("Done.");
                if (!fs.existsSync(config.tmpPath + baseFile)) {
                  console.log("Local data does not exist, make it");
                  saveFile(config.tmpPath + baseFile, data, function(err) {
                    if (err) {
                      return console.log(err);
                    }
                    console.log("\x1b[32m", "Done.");
                    // checkDiff();
                    //if (true) resolve({ success: true })
                    checkDiff(resolve);
                  });
                } else {
                  //if (true) resolve({ success: true })
                  // checkDiff();
                  checkDiff(resolve);
                }
              });
            });
          })
          .on("error", err => {
            resolve({ error: "NetworkError" });
            //   showRemoteErrorAlert();
            //   console.log("Error: " + err.message);
            //   process.exit();
          });
      })
  )
)
  .then(results => {
    console.log(results);
  })
  .catch(console.log);

function saveFile(path, content, callback) {
  if (!fs.existsSync(config.tmpPath)) {
    fs.mkdirSync(config.tmpPath);
  }
  return fs.writeFile(path, content, "utf8", callback);
}

function updateBaseFile() {
  console.log("Update local data from tmp...");
  const tmpData = fs.readFileSync(config.tmpPath + tempFile, "utf8");
  saveFile(config.tmpPath + baseFile, tmpData, function(err) {
    if (err) {
      return console.log(err);
    }
    console.log("\x1b[32m", "Updated!");
    process.exit();
  });
}

function checkDiff(resolve) {
  child_process.exec(
    "git diff  --no-index " +
      config.tmpPath +
      baseFile +
      " " +
      config.tmpPath +
      tempFile,
    function(error, stdout, stderr) {
      if (stdout) {
        resolve({
          diff: stdout,
          proceed: false
        });

        //showChangesAlert(stdout);

        /* 
            Перенести отсюда
          */

        /* rl.question(
          "Please, confirm that you are read this message, and we will proceed [y/n] ",
          answer => {
            if (answer.match(/^y(es)?$/i)) {
              updateBaseFile();
            } else {
              const err = new Error(
                "Aborted. Please read API changes and confirm it next time"
              );
              throw err;
            }

            rl.close();
          }
        ); */
      } else {
        resolve({
          diff: "",
          proceed: true
        });
        //showSuccessAlert()
        //process.exit()
      }
    }
  );
}

function showChangesAlert(body) {
  const header = `
    =================================
    ========== API CHANGES ==========
    =================================
    `;

  const footer = `
    =================================
    `;
  console.log("\x1b[31m", header);
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
  console.log("\x1b[31m", footer);
}

function showRemoteErrorAlert() {
  const header = `
    =================================
    ========== API CHANGES ==========
    =================================
    `;
  const body = `
    == Can\`t resolve remote data  ==
    ==      API check bypassed     ==
    `;
  const footer = `
    =================================
    `;
  console.log("\x1b[31m", header);
  console.log("\x1b[36m", body);
  console.log("\x1b[31m", footer);
}

function showSuccessAlert() {
  const header = `
    =================================
    ========== API CHANGES ==========
    =================================
    `;
  const body = `
    ==== You are use actual API  ====
    `;
  const footer = `
    =================================
    `;
  console.log("\x1b[31m", header);
  console.log("\x1b[36m", body);
  console.log("\x1b[31m", footer);
}

function promiseFromChildProcess(child) {
  return new Promise(function(resolve, reject) {
    child.addListener("error", reject);
    child.addListener("exit", resolve);
  });
}
