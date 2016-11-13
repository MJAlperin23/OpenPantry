// code based on example bot https://github.com/jw84/messenger-bot-tutorial
//   and sample watson messenger here https://github.com/nheidloff/facebook-watson-bot
'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const http = require('http');
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
	//res.send('hello world i am a secret bot')
  res.render('pages/example.ejs')
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
		if(sender != 1161553940576727) {
			if (event.message && event.message.text) {
				let text = event.message.text
				checkExistingUser(sender, text)
			}
		}
	}
	res.sendStatus(200)
})

// recommended to inject access tokens as environmental variables, e.g.
// const token = process.env.PAGE_ACCESS_TOKEN
const token = "EAABkONPnt84BADCZAO1mku0ZBFh478b78dwHbiJt5jPEQLrdedAWsiXXLKCYZBAxAwEpyQOTES7t84Vt9b2T4XIKCZAQuMZC58v3edIHN21N1S1HDgr3ZC3yKvicqAJga3HksYNwqaZB13ZCCcC19egH8x1FDuD5dJCJvI9sImuwrAZDZD"

function checkExistingUser(senderID, text) {
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
				sendMessageToWatson(text.replace(/(\r\n|\n|\r)/gm,""), senderID)
			} else {
				addNewUser(senderID, text.replace(/(\r\n|\n|\r)/gm,""))
			}
  	})
	})
}

function sendMessageToWatson(messengerText, senderID) {
  let workspace = '3f05808d-946c-4286-83d3-686d9bdbdf09'
  if (messengerText) {
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

function sendMessageToWatsonInternal(messengerText, senderID, callback) {
  let workspace = '3f05808d-946c-4286-83d3-686d9bdbdf09'
  if (messengerText) {
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
	    getWatsonResponseInternal(senderID, data, callback);
	  } );
  }
}

function getWatsonResponse(senderID, data) {
	var botResponse = data.output.text[0]
  determineNext(senderID, data)
	sendTextMessage(senderID, botResponse)
}

function getWatsonResponseInternal(senderID, data, callback) {
  var numIngredients = 0
  let ingred = [];
  for (var i = 0; i < data.entities.length; i++) {  
    if (data.entities[i].entity === 'ingredients'){
      ingred.push(data.entities[i].value.toLowerCase());
    }
  }

  numIngredients = ingred.length;

  let ingredientsInRecipe = '(';
  for (var i = 0; i < ingred.length; i++) {  
    if (i === ingred.length - 1) {
      ingredientsInRecipe += "\'" + ingred[i] + "\'"
    }
    else {
      ingredientsInRecipe += "\'" + ingred[i] + "\',"
    }
  }
  ingredientsInRecipe += ")"

  checkPantryForRecipe(senderID, ingredientsInRecipe, numIngredients, callback)

}

function determineNext(senderID, data) {
  for (var i = 0; i < data.intents.length; i++) {
    if (data.intents[i].intent === 'Meals_to_make') {

      let tot = [];
      let cuisine  = "";
      let ingred = [];
      for (var i = 0; i < data.entities.length; i++) {  
        if (data.entities[i].entity === 'cuisine') {
            cuisine = data.entities[i].value.toLowerCase();
            tot.push(data.entities[i].value.toLowerCase())
        }
        else if (data.entities[i].entity === 'ingredients'){
          ingred.push(data.entities[i].value.toLowerCase());
          tot.push(data.entities[i].value.toLowerCase());
        }
      }

      search(senderID, tot.toString(), function(data) {
        getPossibleRecipies(senderID, data, function(possibleRecipeArray){
          buildRecipeMessageRespose(senderID, possibleRecipeArray)
        })
      })
    }
    else if (data.intents[i].intent === 'food_I_have') {
      let purchased = [];
      for (var i = 0; i < data.entities.length; i++) {  
        if (data.entities[i].entity === 'ingredients'){
          purchased.push(data.entities[i].value.toLowerCase());
        }
      }

      insertNewItems(senderID, purchased)
    }
    else if (data.intents[i].intent === 'I_dont_have') {
      let runout = [];
      for (var i = 0; i < data.entities.length; i++) {  
        if (data.entities[i].entity === 'ingredients'){
          runout.push(data.entities[i].value.toLowerCase());
        }
      }

      deleteItems(senderID, runout)
    }

    else if (data.intents[i].intent === 'do_I_have') {
      let itemsToCheck = [];
      for (var i = 0; i < data.entities.length; i++) {  
        if (data.entities[i].entity === 'ingredients'){
          itemsToCheck.push(data.entities[i].value.toLowerCase());
        }
      }

      let itemsCheckString = '(';
      for (var i = 0; i < itemsToCheck.length; i++) {  
        if (i === itemsToCheck.length - 1) {
          itemsCheckString += "\'" + itemsToCheck[i] + "\'"
        }
        else {
          itemsCheckString += "\'" + itemsToCheck[i] + "\',"
        }
      }
      itemsCheckString += ")"


      checkItemsInPantry(senderID, itemsCheckString, function(result) {

        var responseMessage = "";
        if(result.rows.length == 0)
        {
          responseMessage = "You do not have any of those items."
        } else if(result.rows.length > 0) {
          responseMessage = "You have these items: "
          for(var i = 0; i<result.rows.length; i++) {
            responseMessage += result.rows[i].item_name + ","
          }
        }
        sendTextMessage(senderID, responseMessage)
      })
    }
  }
}

function getPossibleRecipies(senderID, data, callback) {

  var possibleRecipeArray = []
  var respCounter = 0
  var length = 3 //recipes.length
  for(var rec=0; rec< length; rec++ ) {
    getRecipe(senderID, data.recipes[rec].recipe_id, function(recipe) {
        let recipe_ingred = recipe.recipe.ingredients.toString();

        let recipe_String = ''
        for (var i = 0; i < recipe.recipe.ingredients.length; i++) {
          recipe_String += recipe.recipe.ingredients[i].toString()
          recipe_String += ' '
        }

        sendMessageToWatsonInternal(recipe_String.replace(/(\r\n|\n|\r)/gm,""), senderID, function(isPossible) {
            respCounter++;
            if(isPossible) {
              //console.log(data.recipes[i])
              possibleRecipeArray.push(data.recipes[rec])
            }

            console.log(respCounter + "     :    " + (length - 1))
            if(respCounter == length) {
              console.log(possibleRecipeArray)
              callback(possibleRecipeArray)
            }
        });
    })
  }
}

function getRecipe(senderID, id, callback) {
    return http.get({
		host: 'food2fork.com',
		path: '/api/get?key=9372d5221aa1903af724bba0c775b4b7&rId=' + id
    }, function(response) {
        // Continuously update stream with data
        var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {

            // Data reception is done, do whatever with it!
            var parsed = JSON.parse(body);
            return callback(parsed);
        });
    });

}


function search(senderID, searchterms, callback) {
    //http.get('http://eternagame.wikia.com/wiki/EteRNA_Dictionary', callback);

    return http.get({
		host: 'food2fork.com',
		path: '/api/search?key=9372d5221aa1903af724bba0c775b4b7&q=' + searchterms
    }, function(response) {
        // Continuously update stream with data
        var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {

            // Data reception is done, do whatever with it!
            var parsed = JSON.parse(body);
            return callback(parsed);
        });
    });

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

	pg.connect(process.env.DATABASE_URL, function (err, client, done) {
		if (err) {
			return console.error('error fetching client from pool', err)
		}

		for(var i = 0; i < itemArray.length; i++) {
			client.query('INSERT INTO pantryitems (user_id, item_name) VALUES ($1, $2);', [senderID, itemArray[i]], function (err, result) {
				done()
				if (err) {
					return console.error('error happened during query', err)
				}
			})
		}

	})
}

function deleteItems(senderID, itemArray) {

	pg.connect(process.env.DATABASE_URL, function (err, client, done) {
		if (err) {
			return console.error('error fetching client from pool', err)
		}

		for(var i = 0; i < itemArray.length; i++) {
			client.query('DELETE FROM pantryitems WHERE item_name like $1;', [itemArray[i]], function (err, result) {
				done()
				if (err) {
					return console.error('error happened during query', err)
				}
			})
		}

	})
}

function checkPantryForRecipe(senderID, itemList, numItems, callback) {
  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
		if (err) {
			return console.error('error fetching client from pool', err)
		}

			client.query('SELECT item_name FROM pantryitems WHERE item_name IN ' + itemList + ';', function (err, result) {
				done()
				if (err) {
					return console.error('error happened during query', err)
				}

        if(result.rows.length == numItems) {
          callback(true)
        } else {
          callback(false)
        }
			})
	})
}

function checkItemsInPantry(senderID, itemList, callback) {
  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
    if (err) {
      return console.error('error fetching client from pool', err)
    }

      client.query('SELECT item_name FROM pantryitems WHERE item_name IN ' + itemList + ';', function (err, result) {
        done()
        if (err) {
          return console.error('error happened during query', err)
        }

        callback(result)
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

function buildRecipeMessageRespose(senderID, possibleRecipeArray) {

  var builtRecipe = {
    "title": possibleRecipeArray[0].title,
    "subtitle": possibleRecipeArray[0].publisher,
    "image_url": possibleRecipeArray[0].image_url,
    "buttons": [{
      "type": "web_url",
      "url": possibleRecipeArray[0].source_url,
      "title": "Click Here For Recipe"
    }]
  }

  var messageData = {
		"attachment": {
			"type": "template",
			"payload": {
				"template_type": "generic",
				"elements": [builtRecipe],
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
/*
{
  "title": "First card",
  "subtitle": "Element #1 of an hscroll",
  "image_url": "http://messengerdemo.parseapp.com/img/rift.png",
  "buttons": [{
    "type": "web_url",
    "url": "https://www.messenger.com",
    "title": "web url"
  }
*/
app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})
