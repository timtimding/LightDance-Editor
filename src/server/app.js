/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
/* eslint-disable global-require */
require("dotenv").config();
const express = require("express");
const path = require("path");
const http = require("http");

const WebSocketApp = require("./websocket");
const apiRouter = require("./routes");

const app = express();
const server = http.createServer(app);

if (process.env.NODE_ENV !== "prod") {
  const webpack = require("webpack");
  const { merge } = require("webpack-merge");
  const commonConfig = require("../../config/webpack.common.js");
  const envConfig = require("../../config/webpack.dev.js");
  const webpackConfig = merge(commonConfig, envConfig);
  const compiler = webpack(webpackConfig);

  app.use(
    require("webpack-dev-middleware")(compiler, {
      publicPath: webpackConfig.output.publicPath,
    })
  );
  app.use(
    require("webpack-hot-middleware")(compiler, {
      log: false,
      path: "/__hmr",
      heartbeat: 2000,
    })
  );
} else {
  const buildPath = path.resolve(__dirname, "..", "..", "./build");
  app.use(express.static(buildPath));
}

const assetPath = path.resolve(__dirname, "..", "..", "./asset");
app.use("/asset", express.static(assetPath));
const dataPath = path.resolve(__dirname, "..", "..", "./data");
app.use("/data", express.static(dataPath));
app.use("/api", apiRouter);

const wss = new WebSocketApp(server);
app.set("wss", wss);

const port = 8080;

// app.listen(port, () => {
//   const wss = new WebSocketApp(server);
//   console.log(`Listening on port: ${port}`);
// });

server.listen(port, () => {
  wss.listen();
  console.log(`Listening on http://localhost:${port}`);
});
