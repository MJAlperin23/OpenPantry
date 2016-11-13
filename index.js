// code based on example bot https://github.com/jw84/messenger-bot-tutorial
//   and sample watson messenger here https://github.com/nheidloff/facebook-watson-bot
'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
//const cfenv = require("cfenv");
const pg = require('pg')
const watson = require('watson-developer-cloud');
const extend = require('util')._extend;
const app = express()
const conString = 'postgres://Mickey:password@localhost:5432/open_pantry'


/*****       WATSON STUFF      **********/
var conversation = watson.conversation( {
  url: 'https://gateway.watsonplatform.net/conversation/api',
  username: '3cd9b082-fe46-41ba-adad-fe59c3a5c70a',
  password: 'CkGtDZAhAOdS',
  version_date: '2016-07-11',
  version: 'v1'
} );



/***** FUNCTIONS AND ENDPOINTS  *****/
app.set('port', (process.env.PORT || 5000))

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json())

// index
app.get('/', function (req, res) {
	res.send('hello world i am a secret bot')
})

// for facebook verification
app.get('/webhook/', function (req, res) {
	if (req.query['hub.verify_token'] === 'my_voice_is_my_password') {
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
		let context = req.body.context
		if (event.message && event.message.text) {
			let text = event.message.text
			checkExistingUser(sender, text, context)
		}
	}
	res.sendStatus(200)
})

// recommended to inject access tokens as environmental variables, e.g.
// const token = process.env.PAGE_ACCESS_TOKEN
const token = "EAABkONPnt84BADCZAO1mku0ZBFh478b78dwHbiJt5jPEQLrdedAWsiXXLKCYZBAxAwEpyQOTES7t84Vt9b2T4XIKCZAQuMZC58v3edIHN21N1S1HDgr3ZC3yKvicqAJga3HksYNwqaZB13ZCCcC19egH8x1FDuD5dJCJvI9sImuwrAZDZD"


function sendMessageToWatson(messengerText, senderID, context) {
  let workspace = '3f05808d-946c-4286-83d3-686d9bdbdf09'
  if (text) {
		var payload = {
	    workspace_id: workspace,
	    context: {},//context,
	    input: {}//text.substring(0,200)
	  };

		var textDict = {
			text: messengerText
		};

		payload.input = textDict;

	  // Send the input to the conversation service
	  conversation.message( payload, function(err, data) {
	    if ( err ) {
	      console.log("error talking to watson")
				console.log(err)
	    }
	    getWatsonResponse(senderID, data);
	  } );
  }
}

function getWatsonResponse(senderID, data) {
	console.log(data)
	var botResponse = data.input.text
	sendTextMessage(senderID, botResponse)
}

function checkExistingUser(senderID, text, context) {
	const results = [];
	 var returnLength = 0
	pg.connect(process.env.DATABASE_URL, function (err, client, done) {
  if (err) {
    return console.error('error fetching client from pool', err)
  }
	  client.query('SELECT id from messengerusers where id = $1', [senderID], function (err, result) {
	    done()
	    if (err) {
	      return console.error('error happened during query', err)
	    }

			if(result.rows.length > 0)
			{
				sendMessageToWatson(text, senderID, context)
				//sendTextMessage(senderID, "Text received, echo: " + text.substring(0, 200))
			} else {
				addNewUser(senderID, text)
			}
  	})
	})
}

function addNewUser(senderID, text) {
	pg.connect(process.env.DATABASE_URL, function (err, client, done) {
	  if (err) {
	    return console.error('error fetching client from pool', err)
	  }
	  client.query('INSERT INTO messengerusers (id, name) VALUES ($1, $2);', [senderID, 'HI'], function (err, result) {
	    done()
	    if (err) {
	      return console.error('error happened during query', err)
	    }
			sendTextMessage(senderID, "Welcome to OpenPantry. Your Account Has been Created!")
	  })
	})
}

function insertNewItems(senderID, itemArray) {

	pg.connect(conString, function (err, client, done) {
		if (err) {
			return console.error('error fetching client from pool', err)
		}

		for(var i = 0; i < itemArray.length; i++) {
			client.query('INSERT INTO PantryItems (user_id, item_name) VALUES ($1, $2);', [senderID, itemArray[i]], function (err, result) {
				done()
				if (err) {
					return console.error('error happened during query', err)
				}
			})
		}

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

// spin spin sugar
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})
