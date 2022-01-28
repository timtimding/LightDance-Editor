/* eslint-disable camelcase */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
/* eslint-disable global-require */
import express from "express";
import http from "http";
import bodyParser from "body-parser";
import { WebSocketServer } from "ws";

import DancerSocket from "./websocket/dancerSocket.js";
import EditorSocket from "./websocket/editorSocket.js";

import NtpServer from "./ntp/index.js";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const board_config = require("../files/data/board_config.json");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const ntpServer = new NtpServer(); // ntp server for sync time

const dancerClients = {};
const editorClients = {};

/**
 * handle all message received from webSocket, and emit to other sockets
 * Ex. message from RPi's webSocket => emit message to editor's websocket
 * Ex. message from Editor's webSocket => emit to RPi (performance) or emit to other editor (multi editing)
 * @param {string} from - from who
 * @param {{ type, task, payload }} msg
 */
const socketReceiveData = (from, msg) => {
  const { type, task, payload } = msg;
  switch (type) {
    case "dancer": {
      Object.values(editorClients).forEach((editor) => {
        editor.sendDataToClientEditor([
          task,
          {
            from,
            response: payload,
          },
        ]);
      });
      break;
    }
    case "Editor": {
      break;
    }
    default:
      break;
  }

  console.log("dancerClients: ", Object.keys(dancerClients));
  console.log("editorClients: ", Object.keys(editorClients));
};

// DancerClientsAgent: to handle add or delete someone in dancerClients
const DancerClientsAgent = {
  addDancerClient: (dancerName, dancerSocket) => {
    dancerClients[dancerName] = dancerSocket;
  },
  deleteDancerClient: (dancerName) => {
    delete dancerClients[dancerName];
  },
  socketReceiveData,
};
// EditorClientsAgent: to handle add or delete someone in editorClients
const EditorClientsAgent = {
  addEditorClient: (editorName, editorSocket) => {
    editorClients[editorName] = editorSocket;
  },
  deleteEditorClient: (editorName) => {
    delete editorClients[editorName];
  },
  socketReceiveData,
};

// websocket
wss.on("connection", (ws) => {
  ws.onmessage = (msg) => {
    const [task, payload] = JSON.parse(msg.data);
    console.log("Client response: ", task, "\nPayload: ", payload);

    const { type } = payload;

    // We defined that the first task for clients (dancer and editor) will be boardInfo
    // This can then let us split the logic between dancerClients and editorClients
    if (task === "boardInfo") {
      const hostName = payload.name;
      if (type === "dancer") {
        // check if `dancer` type's hostname is in board_config.json
        if (hostName in board_config) {
          const { dancerName } = board_config[hostName];
          // ask about dancerClient
          const dancerSocket = new DancerSocket(
            ws,
            dancerName,
            DancerClientsAgent
          );
          dancerSocket.handleMessage();

          Object.values(editorClients).forEach((editor) => {
            const ws = editor.ws;
            ws.send(JSON.stringify(["getIp", { dancerClients }])); // render dancer's info at frontend
          });
        } else {
          // `dancer` type's hostName is not in board_config
          console.error(
            `'dancer' type board connected, but not found hostname in board_config`
          );
        }
      } else if (type === "editor") {
        const editorName = hostName; // send from editorSocketAPI

        const editorSocket = new EditorSocket(
          ws,
          editorName,
          EditorClientsAgent
        );

        editorSocket.handleMessage();

        ws.send(JSON.stringify(["getIp", { dancerClients }])); // render dancer's info at frontend
      } else {
        console.error(`Invalid type ${type} on connection`);
      }
    }
  };
});

app.set("wss", wss);

app.use(bodyParser.json({ limit: "20mb" }));

// router api for rpi and dancers
app.post("/api/controller/:command", (req, res) => {
  const { command } = req.params;
  const { selectedDancers, args } = req.body;

  selectedDancers.forEach((dancerName) => {
    dancerClients[dancerName].methods[command](args);
  });

  // // for editor play, pause stop
  // Object.values(editorClients).map(
  //   (ec) => ec.methods[command] && ec.methods[command](args)
  // );

  res.status(200).send(command);
});

const port = process.env.PORT || 8082;

server.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});