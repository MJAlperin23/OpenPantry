// code based on example bot https://github.com/jw84/messenger-bot-tutorial
//   and sample watson messenger here https://github.com/nheidloff/facebook-watson-bot
'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const http = require('http')

const pg = require('pg')
const watson = require('watson-developer-cloud');
const extend = require('util')._extend;
const app = express()
const conString = 'postgres://Mickey:password@localhost:5432/open_pantry'


/*****       WATSON STUFF      **********/
var conversation = watson.conversation( {
  url: 'https://gateway.watsonplatform.net/conversation/api',
  username: '33253a14-1799-4760-a3e9-730ed6661ed5',
  password: 'XSfZCg4wquKl',
  version_date: '2016-07-11',
  version: 'v1'
} );

/***** FUNCTIONS AND ENDPOINTS  *****/
app.set('port', (process.env.PORT || 5000))

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))
app.use(express.static('dist'));
app.use(express.static('public'));
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
  let workspace = '2e91f30c-45c1-4c24-9898-4e0ad80d7ac2'
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
	      console.log("error talking to watson1")
				console.log(err)
	    }
	    getWatsonResponse(senderID, data);
	  } );
  }
}

function getWatsonResponse(senderID, data) {
  if(data) {
    var botResponse = data.output.text[0]
    determineNext(senderID, data)
  	sendTextMessage(senderID, botResponse)
  }
}

function sendMessageToWatsonInternal(messengerText, senderID, arrayLoc, callback) {
  let workspace = '2e91f30c-45c1-4c24-9898-4e0ad80d7ac2'
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
	      console.log("error talking to watson2")
				console.log(err)
	    }
	    getWatsonResponseInternal(senderID, data, arrayLoc, callback);
	  } );
  }
}

function getWatsonResponseInternal(senderID, data, arrayLoc, callback) {
  var numIngredients = 0
  let ingred = [];
  if(data) {
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

    checkPantryForRecipe(senderID, ingredientsInRecipe, numIngredients, arrayLoc, callback)
  }
}

function determineNext(senderID, data) {
  for (var i = 0; i < data.intents.length; i++) {
    if (data.intents[i].intent === 'Meals_to_make') {

      let tot = '';
      let cuisine  = "";
      let ingred = [];
      for (var i = 0; i < data.entities.length; i++) {  
        if (data.entities[i].entity === 'cuisine') {
          cuisine = data.entities[i].value.toLowerCase();
          tot += data.entities[i].value.toLowerCase() + '%20'
          // tot.push(data.entities[i].value.toLowerCase())
        }
        else if (data.entities[i].entity === 'ingredients'){
          ingred.push(data.entities[i].value.toLowerCase());
          tot += data.entities[i].value.toLowerCase() + '%20'
          // tot.push(data.entities[i].value.toLowerCase());
        }
      }

      tot = tot.replace(/\s/g, "%20")
      // console.log(tot);
      // totString = tot.toString().replace(/,/g , "");
      // console.log(totString);

      // console.log("string being sent to api: " + tot);

      search(senderID, tot, function(data) {
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
          responseMessage = "You have "
          for(var i = 0; i<result.rows.length; i++) {
            responseMessage += result.rows[i].item_name + ", "
          }
        }
        responseMessage = responseMessage.substring(0, responseMessage.length - 2)
        sendTextMessage(senderID, responseMessage)
      })
    }

    else if (data.intents[i].intent === 'allergy' && data.entities.length !== 0) {
      let allergins = [];
      for (var i = 0; i < data.entities.length; i++) {  
        if (data.entities[i].entity === 'ingredients'){
          allergins.push(data.entities[i].value.toLowerCase());
        }
      }
        insertAllergyItems(senderID, allergins)
    }
  }
}

function getPossibleRecipies(senderID, data, callback) {

  var possibleRecipeArray = []
  var respCounter = 0
  var length = 5 //recipes.length
  for(var rec=0; rec< length; rec++ ) {

    getRecipe(senderID, data.recipes[rec].recipe_id, rec, function(recipe, recpLoc) {
        console.log(recipe.recipe);
        let recipe_ingred = recipe.recipe.ingredients.toString();

        let recipe_String = ''
        for (var i = 0; i < recipe.recipe.ingredients.length; i++) {
          recipe_String += recipe.recipe.ingredients[i].toString()
          recipe_String += ' '
        }

        sendMessageToWatsonInternal(recipe_String.replace(/(\r\n|\n|\r)/gm,""), senderID, recpLoc, function(isPossible, arrayLoc) {
            respCounter++;
            if(isPossible) {
              possibleRecipeArray.push(data.recipes[arrayLoc])
            }

            if(respCounter == length) {
              callback(possibleRecipeArray)
            }
        });
    })
  }
}

function getRecipe(senderID, id, arrayLoc, callback) {
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
            return callback(parsed, arrayLoc);
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
	  client.query('INSERT INTO messengerusers (id, timestamp_created) VALUES ($1, $2);', [senderID, Date.now()], function (err, result) {
	    done()
	    if (err) {
	      return console.error('error happened during query', err)
	    }
			sendTextMessage(senderID, "Welcome to OpenPantry. Your Account Has been Created! \n Click the link below to check out some examples. \n https://openpantry.herokuapp.com/")
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

function insertAllergyItems(senderID, itemArray) {

	pg.connect(process.env.DATABASE_URL, function (err, client, done) {
		if (err) {
			return console.error('error fetching client from pool', err)
		}

		for(var i = 0; i < itemArray.length; i++) {
			client.query('INSERT INTO allergyitems (user_id, item_name) VALUES ($1, $2);', [senderID, itemArray[i]], function (err, result) {
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
			client.query('DELETE FROM pantryitems WHERE user_id = $1 AND item_name like $2;', [senderID, itemArray[i]], function (err, result) {
				done()
				if (err) {
					return console.error('error happened during query', err)
				}
			})
		}

	})
}

function checkPantryForRecipe(senderID, itemList, numItems, arrayLoc, callback) {
  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
		if (err) {
			return console.error('error fetching client from pool', err)
		}

			client.query('SELECT DISTINCT item_name FROM pantryitems WHERE user_id = $1 AND item_name IN ' + itemList
                    + 'AND item_name NOT IN (SELECT item_name FROM allergyitems WHERE user_id = $1);', [senderID], function (err, result) {
				done()
				if (err) {
					return console.error('error happened during query', err)
				}

        if(result.rows.length == numItems) {
          callback(true, arrayLoc)
        } else {
          callback(false, null)
        }
			})
	})
}

function checkItemsInPantry(senderID, itemList, callback) {
  pg.connect(process.env.DATABASE_URL, function (err, client, done) {
    if (err) {
      return console.error('error fetching client from pool', err)
    }

      client.query('SELECT DISTINCT item_name FROM pantryitems WHERE user_id = $1 AND item_name IN ' + itemList + ';', [senderID], function (err, result) {
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

  if(possibleRecipeArray.length == 0) {
    sendTextMessage(senderID, "Sorry, you do not have the right ingredients for that.")
  } else {
    var recipiesToSend = []
    var numSend = possibleRecipeArray.length

    if(numSend > 3){
      numSend = 3
    }

    for(var i=0; i<numSend; i++) {
      var builtRecipe = {
        "title": possibleRecipeArray[i].title,
        "subtitle": possibleRecipeArray[i].publisher,
        "image_url": possibleRecipeArray[i].image_url,
        "buttons": [{
          "type": "web_url",
          "url": possibleRecipeArray[i].source_url,
          "title": "Link To Recipe"
        }],
      }
      recipiesToSend.push(builtRecipe)
    }

    console.log(recipiesToSend)

    var messageData = {
  		"attachment": {
  			"type": "template",
  			"payload": {
  				"template_type": "generic",
  				"elements": recipiesToSend,
  			}
  		}
  	}

  	request({
  		url: 'https://graph.facebook.com/v2.6/me/messages',
  		qs: {access_token:token},
  		method: 'POST',
  		json: {
  			recipient: {id:senderID},
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
}

app.listen(app.get('port'), function() {
	console.log('running on port', app.get('port'))
})
