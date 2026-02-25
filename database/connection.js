require("dotenv").config();
const oracledb = require("oracledb");
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let connection;

async function connectDB() {
  connection = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_STRING
  });

  console.log("Connected to Oracle DB");
}

function getConnection() {
  return connection;
}

module.exports = { connectDB, getConnection };