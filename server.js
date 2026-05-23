const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({
    host: "0.0.0.0",
    port: PORT
});

console.log("Server started on port", PORT);

const https = require("https");

function getPublicIP(cb) {
    https.get("https://api.ipify.org", res => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => cb(data.trim()));
    }).on("error", () => cb(null));
}


const sessions = {}; // code -> host socket

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

wss.on('connection', ws => {
    ws.on('message', msg => {
        ws._ip = ws._socket.remoteAddress;
        let data;
        try { data = JSON.parse(msg); }
        catch { return; }

        if (data.type === "host") {
            const code = generateCode();
            sessions[code] = ws;
            ws.send(JSON.stringify({ type: "code", code }));
        }

        if (data.type === "join") {
            const host = sessions[data.code];
            if (!host) {
                ws.send(JSON.stringify({ type: "error", message: "Invalid code" }));
                return;
            }

            // attach IPs
            host._ip = host._socket.remoteAddress;
            ws._ip = ws._socket.remoteAddress;

            // send peer info to both sides
            getPublicIP(ip => {
                host.send(JSON.stringify({
                    type: "peer",
                    role: "joiner",
                    ip: ip
                }));

                ws.send(JSON.stringify({
                    type: "peer",
                    role: "host",
                    ip: ip
                }));
            });

            delete sessions[data.code];
        }
    });
});
