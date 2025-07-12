const dotenv = require("dotenv");
const fs = require("fs");

if (fs.existsSync(".env")) {
  dotenv.config({ path: ".env" });
}
if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local", override: true });
}