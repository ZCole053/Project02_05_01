//Author: Zedekiah Cole

//Summary: This file displays multiple endpoints with different 
//possible functions on the website 

//file name: Index.js
//Date made: January 17 2019
//LTE: February 25 2019


//declaring local variables
var express = require('express'); 


var bodyParser = require('body-parser');


//constructing object and putting it into app.
var app = express();

//imports the file authenticator.js
var authenticator = require('./authenticator.js');

//require translates json files
var config = require('./config.json');

//purpose to give help with url
var url = require('url');

//not global, not npm, it is a core module
var queryString =  require('querystring');

//pulling in new async module file
var async = require('async');
var MongoClient = require('mongodb').MongoClient;
var storage = require('./storage.js');
storage.connect();


//creating server port
//var port = 8080;


//mounting middleware
//it is a constructor
//it is an iffe returns function name
app.use(require('cookie-parser')());


//places any data request into json
app.use(bodyParser.json());

//looks for static content like index but we made it relative with dirname
app.use(express.static(__dirname + '/public'));

//dynamic resources
//interpertes files with ejs extenstion as a ejs file
app.set('view engine', 'ejs');


//clearing cash after a while 
setInterval(function(){
    //if connection is good it will clear it
    if(storage.connect){
        console.log("Clearing MongoDB cash");
        storage.deleteFriends();
    }
}, 1000 * 60 * 5);//setting the time to 5 minute for debug


//checking for my end points endpoint
app.get('/', function(req,res) {
    var credentials = authenticator.getCredentials();
    if(!credentials.access_token || !credentials.access_token_secret){
        return res.redirect('login');
    }       
    if(!storage.connected()){
        console.log("Loading")
        return renderMainPageFromTwitter(req,res);
     }
     console.log("Loading friends from MongoDB.");
     //this is where the callback gets defined
     storage.getFriends(credentials.twitter_id, function(err, friends){
        if(err){
            return res.status(500).send(err);
        }
        //success empty array or full array
        if(friends.length > 0){
            console.log("Friends successfully loaded from MongoDB.");
            //reordering the array
            //function tells what it needs to do and always has 2 parameters
            //needs previouse and current friend and a possible swap
            friends.sort(function(a, b){
                //lower casing to make sorting easier
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            });
            res.render('index', {friends: friends});
        }
        else{
            console.log("Loading friends from Twitter.");
            renderMainPageFromTwitter(req, res);
        }
     });
});

//pulling url route
//naming so we can use it in another module
app.get('/auth/twitter', authenticator.redirectToTwitterLoginPage);

///creating route to post tweet
//routes usually have req and res
app.get('/tweet', function(req,res){
    //grabs the credetials from the authenticator
    var credentials = authenticator.getCredentials();
    //if failure
    if(!credentials.access_token || !credentials.access_token_secret){
        ///prevents spin mode while also exiting the statment
        return res.sendStatus(418);
    }
    var url = "https://api.twitter.com/1.1/statuses/update.json";
    authenticator.post(url, credentials.access_token,credentials.access_token_secret, 
        {
            //text that is being tweeted
            status: "Was up"
     },function(error, data){
        if(error){
            //chain together response
            return res.status(400).send(error);
        }
        res.send("Tweet successful");
     });
});

//gets all the tweetes sent and replied to a certain account
//get something off url bar
app.get('/search', function(req, res){
    var credentials = authenticator.getCredentials();
     //if failure
     if(!credentials.access_token || !credentials.access_token_secret){
        ///prevents spin mode while also exiting the statment
        return res.sendStatus(418);
    }
    var url = "https://api.twitter.com/1.1/search/tweets.json";
    //filter stringify will format spaces and things for a url
    var query = queryString.stringify({ q: 'NASA'});//sending json with name value pairs 
    url += '?' + query;
    //doesn't get body because data is not being posted
    authenticator.get(url,credentials.access_token,credentials.access_token_secret, 
    function(error,data){
        if(error){
            return res.status(400).send(error);
        }
        //sends back the data so we can see what we got
        res.send(data);//debug
    });
});

//cursor collection
app.get('/friends', function(req, res){
    var credentials = authenticator.getCredentials();
     //if failure
     if(!credentials.access_token || !credentials.access_token_secret){
        ///prevents spin mode while also exiting the statment
        return res.sendStatus(418);
     }
    var url = "https://api.twitter.com/1.1/friends/list.json";
    //defaults to first page
    //if not first time through it will execute
    if(req.query.cursor){
        //modifying the url
        url += '?' + queryString.stringify({ cursor: req.query.cursor});
    }
    authenticator.get(url,credentials.access_token,credentials.access_token_secret,
    function(error,data){
        if(error){
            //another example of a chain
            return res.status(400).send(error);
        }
        res.send(data);//debug
    });

});


//new route for waterfall method
app.get('/allfriends', function(req,res){
    renderMainPageFromTwitter(req, res);
});

function renderMainPageFromTwitter(req, res) {
    var credentials = authenticator.getCredentials();
    //constructing async waterfall
    async.waterfall([
        //get our friends ID'S
        function(callback){
            //preseting to 1
            var cursor = -1;
            var ids=[];
            //console.log("ids.length: " + ids.length);
            //parm1 = when to stop, parm2 = what task it does in each loop
            async.whilst(function(){//always returns bollean response
                return cursor !=0;//return true
            }, 
            function(callback){
                var url = "https://api.twitter.com/1.1/friends/ids.json";
                url += "?" + queryString.stringify({ 
                    user_id: credentials.twitter_id,
                    cursor: cursor});
                //requesting another page
                authenticator.get(url,credentials.access_token,credentials.access_token_secret,
                    function(error,data){
                        if(error){
                            return res.status(400).send(error);
                        }
                        //converts to usable json
                        data = JSON.parse(data);
                        //changes the cursor to the next one
                        cursor = data.next_cursor_str;
                        //array concat function
                        ids = ids.concat(data.ids);
                        //console.log("ids.length: " + ids.length);//debug
                        //calling the callback
                        callback();
                });
            },
            function(error){
                // console.log('last callback');
                if(error){
                    return res.status(500).send(error);
                }
                // console.log(ids);
                callback(null, ids);
            });
        },
        //start of task 2
        //look up friends data
        function(ids,callback){
            var getHundredIds = function(i){
                //slices the arrary requires the position and the amount of slices
                return ids.slice(100*i, Math.min(ids.length, 100*(i+1)));
            };
            var requestsNeeded = Math.ceil(ids.length/100);
            //second parameter does whatever our task is
            //similar to for loop            same as i
            async.times(requestsNeeded, function(n,next){
                var url = "https://api.twitter.com/1.1/users/lookup.json";
                url += "?" + queryString.stringify({ user_id: getHundredIds(n).join(',')});//join par1 needs what it seperates
                authenticator.get(url,credentials.access_token,credentials.access_token_secret,
                function(error,data){
                    if(error){
                        return res.status(400).send(error);//debug
                    }
                    var friends = JSON.parse(data);
                    next(null, friends);
                });
            },
            function(error,friends){
                //console.log("n: ",n,friends);
                //attempts to reduce the array to a single value
                //friends/data is an array within an array 
                friends = friends.reduce(function(previousValue,currentValue,currentIndex, array){
                    //concat 2 arrays into 1
                    return previousValue.concat(currentValue);
                }, []);
                //needs fnction on how to sort
                friends.sort(function(a,b){
                    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
                });
                friends = friends.map(function(friend) {
                    return {
                        twitter_id:friend.id_str,
                        for_user: credentials.twitter_id,
                        name: friend.name,
                        screen_name: friend.screen_name,
                        location: friend.location,
                        profile_image_url: friend.profile_image_url
                    }
                });
                res.render("index", { friends:friends});
                if(storage.connected()) {
                    storage.insertFriends(friends);
                }
                console.log('friends.length', friends.length);
            });
        }
    ]);
    //res.sendStatus(200);//debug
}

app.get(url.parse(config.oauth_callback).path, function(req,res){
    //creating a callback function with a callback function
    authenticator.authenticate(req, res, function(err){
        //if it erors it will send 401 to the user and the error in the console
        if (err) {
            console.log(err);  
            //completes http rout
            //completes the circle
            res.redirect("/login");
        }else{
            //Sends to a user that it works
            res.redirect("/");
        }
    });
});

app.get('/login', function(req,res){
    if(storage.connected()){
        console.log("Deleting friends collection on Login.");
        storage.deleteFriends();
    }
    res.render('login');
});

app.get('/logout', function(req,res){
    authenticator.clearCredentials();
    res.clearCookie('twitter_id');
    if(storage.connected()){
        console.log("Deleting friends collection on Logout.");
        storage.deleteFriends();
    }
    res.redirect('/login');
});

//middle ware to check credentials
function ensureLoggedIn(req,res,next){
    var credentials = authenticator.getCredentials();
    //trap to see if user logged in
    if(!credentials.access_token || 
        !credentials.access_token_secret || 
        !credentials.twitter_id){
        return res.sendStatus(401);//closed middle ware and route
    }
    //sets cookie
    //setting paremeters for security in json (little security should encrypt)
    res.cookie('twitter_id',credentials.twitter_id,{httponly: true});//reads cookie as only http
    //next would go over to the res side unless there is a middle ware chain
    next();
}

//main route into api; creating route for testing
//manuelly mounting middle ware
//it will shut down if failure so it won't activate call back
//will route the api
app.get('/friends/:uid/notes', ensureLoggedIn, function(req,res){
    //creating incase cookie can't be read
    var credentials = authenticator.getCredentials();
    //places the data into the route
    //parse will store the id as a request parameter
    storage.getNotes(credentials.twitter_id, req.param.uid, function(err, notes){
        //error is that getnotes fails
        if(err){
            return  res.status(500).send(err);
        }
        res.send(notes);
    });//primitive get notes in storage
});

//looking for post request so we can post data
//can use the same route of we use a diffrent verb
app.post('/friends/:uid/notes', ensureLoggedIn, function(req,res,next){
    //associative array storred in req global
    storage.insertNote(req.cookies.twitter_id,req.param.uid, req.body.content,function(err,note){
        if(err){
            return  res.status(500).send(err);
        }
        //formulating a response if it works it will be sent back
        res.send(note);
    });
});

//creating to update
app.put('/friends/:uid/notes/:noteid',ensureLoggedIn,function(req, res){
    //uri component not going in the url
    storage.updateNote(req.params.noteid ,req.cookies.twitter_id,req.body.content, function(err,note){
        if(err){
            return  res.status(500).send(err);
        }
        //returning json object
        //sending content we want to update 
        res.send({
            _id: note._id,
            content: note.content
        });
    });
});

//deleting a note
app.delete('/friends/:uid/notes/:noteid',ensureLoggedIn,function(req, res){
    //uri component not going in the url
    storage.deleteNote(req.params.noteid ,req.cookies.twitter_id, function(err,note){
        if(err){
            return  res.status(500).send(err);
        }
        //returning json object
        //sending content we want to update 
        res.sendStatus(200);
    });
});

//building server and listening to the port
app.listen(config.port,function(){
    console.log("Server is listening on localhost:%s",config.port);
    //?
    console.log('OAuth callback: ' + url.parse(config.oauth_callback).hostname + url.parse(config.oauth_callback).path);
});

