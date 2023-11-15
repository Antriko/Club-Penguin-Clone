// TODO - Change to SQLite
var activeUsers = []

// currentPlayers fields
// coords
// facing
// customisation

const timeToString = (time) => {
    return `${("0" + time.getHours()).slice(-2)}:${("0" + time.getMinutes()).slice(-2)}:${("0" + time.getSeconds()).slice(-2)}`
}

const server = Bun.serve({
    fetch(req, server) {
        server.upgrade(req, {
            data: {
                joined: Date.now()
            }
        });
    },
    websocket: {
        open(ws) {
            
            console.log(`New connection attempt`)
            
        },
        message(ws, message) {
            // console.log(message)
            try {
                var data = JSON.parse(message)
            } catch (_) {
                var data = {}
            }

            if(data.type !== 'facing' && data.type !== 'coords') console.log(data.type)
            switch (data.type) {
                case "auth":
                    if(ws.data.name) return;

                    console.log(data.data, data.data.username)
                    if(activeUsers.includes(data.data.username)) {
                        ws.send(JSON.stringify({
                            "type": "authResponse",
                            "success": false
                        }))
                        break
                    }

                    
                    ws.subscribe("room")

                    
                    ws.send(JSON.stringify({
                        "type": "authResponse",
                        "success": true
                    }))
                    activeUsers.forEach(user => {
                        ws.send(JSON.stringify({
                            type: "initPlayer",
                            data: {
                                username: user,
                                position: data.data.position
                            }
                        }))
                    })


                    ws.data.name = data.data.username
                    activeUsers.push(ws.data.name)

                    ws.publish("room", JSON.stringify({
                        type: "initPlayer",
                        data: {
                            username: ws.data.name,
                            position: data.data.position,
                        }
                    }))
                    console.log(`${ws.data.name} authenticated`)
                    break;

                case "message":
                    // console.log('msg', data.data, ws.data.name)
                    ws.publish("room", JSON.stringify({
                        type: "message",
                        data: {
                            time: timeToString(new Date()),
                            username: ws.data.name,
                            message: data.data
                        }
                    }))
                    break;

                // TODO
                case "coords":
                    ws.publish("room", JSON.stringify({
                        type: "coords",
                        data: {
                            user: ws.data.name,
                            data: data
                        }
                    }))
                    break;
                case "facing":
                    ws.publish("room", JSON.stringify({
                        type: "facing",
                        data: {
                            user: ws.data.name,
                            data: data
                        }
                    }))
                    break;
                case "emote":
                    break;

                default:
                    console.log(`Unknown request ${JSON.stringify(data)}`)
                    break
            }
        },
        close(ws) {
            activeUsers = activeUsers.filter(e => e !== ws.data.name)
            ws.unsubscribe("room")
            ws.publish("room", `${ws.data.name} disconnected`);
            console.log(`${ws.data.name} disconnected`, activeUsers);
        }
    },
});

// On windows - wsl > cd server > bun run server.js
console.log(`Listening, run 'wscat -c ws://${server.hostname}:${server.port}?name=Drag'`);