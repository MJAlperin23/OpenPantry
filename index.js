// code based on example bot https://github.com/jw84/messenger-bot-tutorial

'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()

const pg = require('pg')
const conString = 'postgres://Mickey:password@localhost:5432/open_pantry'


app.set('port', (process.env.PORT || 5000))

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json())

/*
pg.connect(conString, function (err, client, done) {
  if (err) {
    return console.error('error fetching client from pool', err)
  }
  client.query('SELECT * from messengerusers', function (err, result) {
    done()

    if (err) {
      return console.error('error happened during query', err)
    }
    console.log(result.rows.length)
    process.exit(0)
  })
})*/

// index
app.get('/', function (req, res) {
	res.send('hello world i am a secret bot')
})

// for facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
		res.send(req.query['hub.challenge'])
	}
	res.send('Error, wrong token')
})

// to post data
app.post('/webhook/', function (req, res) {
	let messaging_events = req.body.entry[0].messaging
	for (let i = 0; i < messaging_events.length; i++) {
		let event = req.body.entry[0].messaging[i]
		let sender = event.sender.id
		let senderName = event.sender.name
		if (event.message && event.message.text) {
			let text = event.message.text
			if (text === 'Generic') {
				sendGenericMessage(sender)
				continue
			}
			//sendTextMessage(sender, "Text received from: " + sender + "   " + text.substring(0, 200))
			var userStatus = checkExistingUser(sender)
			console.log("Status: " + userStatus)
			if(userStatus == false) {
				addNewUser(sender, senderName)
				sendTextMessage(sender, "Welcome to OpenPantry. Your Account Has been Created!", token)
			}

			 sendTextMessage(sender, "Text received, echo: " + text.substring(0, 200))

		}
		if (event.postback) {
			let text = JSON.stringify(event.postback)
			sendTextMessage(sender, "Postback received: "+text.substring(0, 200), token)
			continue
		}
	}
	res.sendStatus(200)
})

// recommended to inject access tokens as environmental variables, e.g.
// const token = process.env.PAGE_ACCESS_TOKEN
const token = "EAABkONPnt84BADCZAO1mku0ZBFh478b78dwHbiJt5jPEQLrdedAWsiXXLKCYZBAxAwEpyQOTES7t84Vt9b2T4XIKCZAQuMZC58v3edIHN21N1S1HDgr3ZC3yKvicqAJga3HksYNwqaZB13ZCCcC19egH8x1FDuD5dJCJvI9sImuwrAZDZD"


function checkExistingUser(senderID) {


	var userID = 0
	pg.connect(process.env.DATABASE_URL, function (err, client, done) {
	  if (err) {
	    return console.error('error fetching client from pool', err)
	  }
	  client.query('SELECT * FROM messengerusers WHERE id = $1', [senderID], function (err, result) {
	    done()
	    if (err) {
	      return console.error('error happened during query', err)
	    }

			if(result.rows.length > 0){
					userID = result.rows[0].id
			}

	  })
	})

	console.log("Sender: " + senderID + "User: " + userID)
	if(senderID == userID)
	{
		return true
	} else {
		return false
	}
}

function addNewUser(senderID, senderName) {
	pg.connect(process.env.DATABASE_URL, function (err, client, done) {
	  if (err) {
	    return console.error('error fetching client from pool', err)
	  }
	  client.query('INSERT INTO messengerusers (id, name) VALUES ($1, $2);', [senderID, senderName], function (err, result) {
	    done()
	    if (err) {
	      return console.error('error happened during query', err)
	    }
	  })
	})
}

function sendTextMessage(sender, text) {
	let messageData = { text:text }

	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

function sendGenericMessage(sender) {
	let messageData = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "generic",
				"elements": [{
					"title": "First card",
					"subtitle": "Element #1 of an hscroll",
					"image_url": "http://messengerdemo.parseapp.com/img/rift.png",
					"buttons": [{
						"type": "web_url",
						"url": "https://www.messenger.com",
						"title": "web url"
					}, {
						"type": "postback",
						"title": "Postback",
						"payload": "Payload for first element in a generic bubble",
					}],
				}, {
					"title": "Second card",
					"subtitle": "Element #2 of an hscroll",
					"image_url": "http://messengerdemo.parseapp.com/img/gearvr.png",
					"buttons": [{
						"type": "postback",
						"title": "Postback",
						"payload": "Payload for second element in a generic bubble",
					}],
				}]
			}
		}
	}
	request({
		url: 'https://graph.facebook.com/v2.6/me/messages',
		qs: {access_token:token},
		method: 'POST',
		json: {
			recipient: {id:sender},
			message: messageData,
		}
	}, function(error, response, body) {
		if (error) {
			console.log('Error sending messages: ', error)
		} else if (response.body.error) {
			console.log('Error: ', response.body.error)
		}
	})
}

// spin spin sugar
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})
