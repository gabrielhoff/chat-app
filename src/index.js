const express = require('express')
const path = require('path')
const http = require('http')
const socketio = require('socket.io')
const Filter = require('bad-words')
const {generateMessage, generateLocation} = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const publicDirPath = path.join(__dirname, '../public')
const port = process.env.port || 3000

const app = express()
const server = http.createServer(app)
const io = socketio(server)

app.use(express.static(publicDirPath))

io.on('connection', (socket) => {
    console.log('New WebSocket connection')

    socket.on('sendMessage', (newMessage, callback) => {
        const filter = new Filter()
        if(filter.isProfane(newMessage)) {
            return callback('Profanity is not allowed')
        }
        const user = getUser(socket.id)
        if(!user) {
            callback('User not found')
        }
        io.to(user.room).emit('message', generateMessage(user.username, newMessage))
        callback()
    })

    socket.on('join', ( {username, room}, callback ) => {
        const {error, user} = addUser({
            id: socket.id,
            username,
            room
        })
        if(error) {
            return callback(error)
        }

        socket.join(user.room)
        
        socket.emit('message', generateMessage('Chat App', 'Welcome!') )
        socket.broadcast.to(user.room).emit('message', generateMessage('Chat App', `${username} has joined!`) )

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        if(!user) {
            callback('User not found')
        }
        io.to(user.room).emit('locationMsg', generateLocation(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)
        if(user) {
            io.to(user.room).emit('message', generateMessage('Chat App', `${user.username} has left`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

app.get('', (req, res) => {
    res.render('index')    
})

server.listen(port, () => {
    console.log('Server is up on port ' + port)
})
