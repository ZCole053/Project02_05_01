//Author: Zedekiah Cole

//Summary: Constructing front end
// implements ajax calls to handles clicks on friends interface
//

//file name: main.js
//Date made: Febuary 21 2019
//LTE: February 25 2019


//expression has to evaluate as a function
// will evaluate as a function andthe call itself
//IIFE
(function(){
    //tracks which friend notes are for
    var selectedUserId;
    //cache for nodes
    var cache = {};
    //alert("I am saying hello, I am an IIFE.");//debug

    function startup(){
       //alert("I am in startup");//debug

       //get an array of list items with friends name
       var friends = document.getElementsByClassName('friend');
       for(var i = 0; i < friends.length; i++){
        //adds event listner for a click event
        friends[i].addEventListener('click', function(){
            //this refers to current object which is the friends[i]
            for(var j = 0; j < friends.length; j++){
                friends[j].className = 'friend';
            }
            this.className += ' active';
            selectedUserId = this.getAttribute('uid');
            console.log("twitter id: ",selectedUserId);
            //not the same as the backend function
            //protected by the iffe scope is limited to the iffe
            var notes = getNotes(selectedUserId, function(notes){
                //building user interface
                //creates mini doc to swap in swap out
                var docFragment = document.createDocumentFragment();
                var notesElements = createNoteElements(notes);
                notesElements.forEach(function(element){
                    docFragment.appendChild(element);
                });
                //adds button to click to add anew note
                var newNoteButton = createAddNoteButton();
                docFragment.appendChild(newNoteButton);
                //getting the real dom to add the li between the ul
                document.getElementById('notes').innerHTML = "";
                document.getElementById('notes').appendChild(docFragment);

            });
        });
       }
    }

    //cache is json that holds the notes name value pair
    function getNotes(userId, callback){
        if(cache[userId]){
            return callback(cache[userId]);
        }
        //setting up AJAX request to get notes
        //geting XHR object
        //creates a new object 
        var xhttp = new XMLHttpRequest();
        //event property value can be set to event handler
        xhttp.onreadystatechange = function(){
            //will activate every time the xhttp state changes
            //request is done when it gets to ready state 4; 0-4
            if(xhttp.readyState == 4 && xhttp.status == 200){
                var notes = JSON.parse(xhttp.responseText || []);//if gotten back it will be in the repose text
                cache[userId] = notes;
                //getting out and sends notes back
                callback(notes);
            }
        };
        //construct a request 
        //open needs to know how we want to send it
        //elimates characters using the encoding
        xhttp.open('GET','/friends/' + encodeURIComponent(userId) + '/notes');
        //sending the request
        xhttp.send();
    }

    function postNewNote(userId, note, callback){
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function(){
            if(xhttp.readyState == 4 && xhttp.status == 200){
                //what ever is given back in response text will be parsed
                var serverNote = JSON.parse(xhttp.responseText || {});
                //pushes onto the end 
                cache[userId].push(serverNote);
                callback(serverNote);
            }
        };
        xhttp.open('POST', '/friends/' + encodeURIComponent(userId) + '/notes');
        //setting header on request
        xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8"); 
        //sending data the content needs to be json 
        xhttp.send(JSON.stringify(note));
    }


    function putNote(userId, note, callback){
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function(){
            if(xhttp.readyState == 4 && xhttp.status == 200){
                //what ever is given back in response text will be parsed
                var serverNote = JSON.parse(xhttp.responseText || {});
                callback(serverNote);
            }
        };
        xhttp.open('PUT', '/friends/' + encodeURIComponent(userId) + '/notes/' + encodeURIComponent(note._id), true);
        //setting header on request
        xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8"); 
        //sending data the content needs to be json 
        xhttp.send(JSON.stringify(note));
    }


    function deleteNote(userId, note, callback){
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function(){
            if(xhttp.readyState == 4 && xhttp.status == 200){
                //another array method; takes array filters out elements and reconstructes it
                //filter does not work in place needs to be assigned back to itself
                cache[userId] = cache[userId].filter(function(localNote){
                    //if it is equal to it then it will get ride of it
                    return localNote._id != note._id;
                });
                callback();
            }
        };
        xhttp.open('DELETE', '/friends/' + encodeURIComponent(userId) + '/notes/' + encodeURIComponent(note._id), true);       
        //sending data the content needs to be json 
        xhttp.send(JSON.stringify(note));
    }

//GUI
    function createNoteElements(notes){
        //mapping array of json too elemnts
        return notes.map(function(note){
            var element = document.createElement('li');//making li html elements
            element.className = 'note';//css things
            element.setAttribute('contenteditable', true);//made to be editable
            element.textContent = note.content;//puts into notes content
            //adding event handle onto the note boxes
            //best time to cick off event is when the user leaves the box
            element.addEventListener('blur', function(){
                //this = current object most likely the li
                note.content = this.textContent;
                //checking the note content
                if(note.content == ""){
                    //if it existed and it is wiped out it will be deleted
                    if(note._id){
                        deleteNote(selectedUserId, note, function(){
                            document.getElementById('notes').removeChild(element);
                        });
                    }else{
                        document.getElementById('notes').removeChild(element);
                    }
                }else if(!note._id){
                    //activaes and passes in post new notes function
                    postNewNote(selectedUserId, {content: this.textContent}, function(newNote){
                        //adds the id that mongo has created
                        note._id = newNote._id//puts note id back into element
                    });
                }else{
                    //updates by complete override
                    putNote(selectedUserId, note,function(){

                    });
                }
            });
            //parameters can be added from handler
            //can use properties and methods from the event itself
            //depends on event for properties and methods
            element.addEventListener('keydown', function(e){
                //trapping key
                //code of key that was fired or keyboard number
                if(e.keyCode == 13){
                    e.preventDefault();
                    //next sibling is the add note button
                    if(element.nextSibling.className == 'add-note'){
                        //clicks add note button within the code
                        element.nextSibling.click();
                    }else{
                        //if another note bellow it will go to the next note
                        element.nextSibling.focus();
                    }
                }
            });
            return element;
        });
        return notes;//debug
    }

    //function to creat note doesn't need parameters
    function createAddNoteButton(){
        var element = document.createElement('li');
        //getting css
        element.className = 'add-note';
        //adding css content
        element.textContent = "Add a new note...";
        element.addEventListener('click', function(){
            var noteElement = createNoteElements([{}])[0];//bug
            document.getElementById('notes').insertBefore(noteElement, this);
            noteElement.focus();
        });
        return element;
    }

    //creating an eventhandler
    //fires at a specific time and when the dom is completed
    //it will call start up
    //only for chrome
    document.addEventListener('DOMContentLoaded', startup, false);
})();//calls itself with the second parenthesis