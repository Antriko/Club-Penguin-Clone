// TODO - Change to SQLite

import { Database } from "bun:sqlite";
const db = new Database(":memory:");
// const db = new Database("db.sqlite");

var userTable = db.query(`CREATE TABLE users(
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT
)`)

var positionTable = db.query(`CREATE TABLE positions(
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    userID INTEGER,
    posX REAL,
    posY REAL,
    posZ REAL,
    facingX REAL DEFAULT 0,
    facingY REAL DEFAULT 0,
    facingZ REAL DEFAULT 0,
    isMoving BOOLEAN DEFAULT 0, 
    movingX REAL DEFAULT 0,
    movingY REAL DEFAULT 0,
    movingZ REAL DEFAULT 0,
    FOREIGN KEY (userID) REFERENCES users(ID)
)`)

userTable.run()
positionTable.run()

// Character creation selected clothing customisation table


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

                    var doesExist = db.query(`SELECT * FROM users WHERE username=${data.data.username}`)
                    var res = doesExist.get()
                    if(res) {
                        ws.send(JSON.stringify({
                            "type": "authResponse",
                            "success": false
                        }))
                        break
                    }
                    ws.send(JSON.stringify({
                        "type": "authResponse",
                        "success": true
                    }))
                    ws.subscribe("room")
                    ws.data.name = data.data.username

                    var existingUsersPos = db.query(`
                        SELECT users.username, positions.posX, positions.posY, positions.posZ
                        FROM users LEFT JOIN positions ON users.ID = positions.userID
                    `)
                    var res = existingUsersPos.all()
                    res.forEach(user => {
                        ws.send(JSON.stringify({
                            type: "initPlayer",
                            data: {
                                username: user.username,
                                position: {
                                    x: user.posX,
                                    y: user.posY,
                                    z: user.posZ,
                                }
                            }
                        }))
                    })

                    ws.publish("room", JSON.stringify({
                        type: "initPlayer",
                        data: {
                            username: ws.data.name,
                            position: data.data.position,
                        }
                    }))
                    var insertUser = db.query(`INSERT INTO users(username) VALUES (${ws.data.name})`)
                    var insertPosition = db.query(`INSERT INTO positions(userID, posX, posY, posZ) VALUES (
                        (SELECT ID FROM users WHERE username='${ws.data.name}'),
                        ${data.data.position.x},
                        ${data.data.position.y},
                        ${data.data.position.z}
                    )`)
                    insertUser.run()
                    insertPosition.run()

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
                    var updatePos = db.query(`UPDATE positions SET
                        posX=${data.data.current.x},
                        posY=${data.data.current.y},
                        posZ=${data.data.current.z},
                        isMoving=${data.data.goingTo.moving == 'true' ? 1 : 0},
                        movingX=${data.data.goingTo.movingTowards.x},
                        movingY=${data.data.goingTo.movingTowards.y},
                        movingZ=${data.data.goingTo.movingTowards.z} 
                        WHERE userID = (SELECT ID FROM users WHERE username='${ws.data.name}')
                    `)
                    updatePos.run()

                    ws.publish("room", JSON.stringify({
                        type: "coords",
                        data: {
                            user: ws.data.name,
                            data: data
                        }
                    }))
                    break;
                case "facing":
                    var updateFacing = db.query(`UPDATE positions SET
                        facingX=${data.data.x},
                        facingY=${data.data.y},
                        facingZ=${data.data.z}
                        WHERE userID = (SELECT ID FROM users WHERE username='${ws.data.name}')
                    `)
                    updateFacing.run()

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
            var removeUser = db.query(`DELETE FROM users WHERE username = ${ws.data.name}`)
            removeUser.run()


            ws.unsubscribe("room")
            ws.publish("room", `${ws.data.name} disconnected`);
            console.log(`${ws.data.name} disconnected`);
        }
    },
});

// On windows - wsl > cd server > bun run server.js
console.log(`Listening, run 'wscat -c ws://${server.hostname}:${server.port}?name=Drag'`);