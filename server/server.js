// TODO - Change to SQLite
var activeUsers = []

// currentPlayers fields
// coords
// facing
// customisation

const server = Bun.serve({
    fetch(req, server) {
        var name = new URL(req.url).searchParams.get("name")

        // Authentication for duplicate users
        if(activeUsers.includes(name)) throw new Response("Duplicate username", {status: 401})

        activeUsers.push(name)
        server.upgrade(req, {
            data: {
                joined: Date.now(),
                name: name
            }
        });
    },
    websocket: {
        open(ws) {
            ws.subscribe("room")
            console.log(`${ws.data.name} connected`)
            console.log(JSON.stringify({type: "a", data: "a"}))
            ws.send(JSON.stringify({type: "a", data: "a"}))
            ws.publish("room", `${ws.data.name} connected`);
        },
        message(ws, message) {
            try {
                var data = JSON.parse(message)
            } catch (_) {
                throw new Response("Invalid JSON", {status: 401})
            }

            switch (data.type) {
                case "message":
                    var time = new Date()
                    var timeMessage = `${("0" + time.getHours()).slice(-2)}:${("0" + time.getMinutes()).slice(-2)}:${("0" + time.getSeconds()).slice(-2)}`
                    ws.publish("room", JSON.stringify({
                        type: "message",
                        data: {
                            time: timeMessage,
                            name: ws.data.name,
                            message: data.data
                        }
                    }))
                    break;

                // TODO
                case "movement":
                    break;
                case "emote":
                    break;

                default:
                    console.log(`Unknown request ${data}`)
                    break
            }
        },
        close(ws) {
            activeUsers = activeUsers.filter(e => e !== ws.data.name)
            console.log(`${ws.data.name} disconnected`, activeUsers);
            ws.unsubscribe("room")
            ws.publish("room", `${ws.data.name} disconnected`);
        }
    },
});

// On windows - wsl > cd server > bun run server.js
console.log(`Listening, run 'wscat -c ws://${server.hostname}:${server.port}?name=Drag'`);