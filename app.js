const util = require('util');
const consoleStamp = require('console-stamp');
consoleStamp(console, {
  pattern: 'HH:MM:ss.l',
  colors: {
    stamp: 'yellow',
    label: 'blue'
  }
});
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/ToDoListDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false
});

const port = process.env.PORT || 3000;
const defaultListName = 'To Do List';
const express = require('express');
const bodyParser = require('body-parser');
const date = require(__dirname + '/date.js');
const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
const _ = require('lodash');

const listItemSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    maxlength: 40
  }
});
const ListItem = mongoose.model('ListItem', listItemSchema);

const listSchema = mongoose.Schema({
  listName: {
    type: String,
    required: true,
    maxlength: 25
  },
  items: [listItemSchema]
});
const List = mongoose.model('List',listSchema);

// Initialize DB if it's empty
function initializeList(res,requestedList,callback){
  List.findOne({
    listName:requestedList },
    function(err, result) {
      if (err) {
        res.render('error',{ err:err });
        console.error(err);
      } else {
        if (result === null) {
          checkListLimit(res,(/*count*/)=>{
            let items = [];
            items.push(new ListItem({
              name: 'Welcome to your ToDoList!'
            }));
            items.push(new ListItem({
              name: 'Hit the + button to add a new item.'
            }));
            items.push(new ListItem({
              name: '<-- Hit this to delete an item.'
            }));
            let list = new List({
              listName: requestedList,
              items: items
            });
            list.save((err)=>{
              if (err) {
                res.render('error',{ err:err });
                console.error(err);
              } else {
                callback();
              }
            });
          });
        } else {
          callback();
        }
      }
    }
  );
}

function checkListLimit(res,callback){
  const limit = 10;
  List.countDocuments({},(err,count)=>{
    if (err) {
      res.render('error',{ err:err });
      console.error(err);
    } else {
      if (count < limit) {
        callback(count);
      } else {
        findListNames(res,(toDoLists)=>{
          const kindOfDay = date.getDate();
          res.render('limit', {
            listName: defaultListName,
            listURL: '/'+_.kebabCase(defaultListName),
            kindOfDay: kindOfDay,
            toDoLists: toDoLists
          });
        });
      }
    }
  });
}

function checkItemLimit(res,requestedList,callback){
  const limit = 10;
  List.findOne({listName:requestedList},(err,result)=>{
    if (err) {
      res.render('error',{ err:err });
      console.error(err);
    } else {
      if (result.items.length < limit) {
        callback(result);
      } else {
        findListNames(res,(toDoLists)=>{
          const kindOfDay = date.getDate();
          res.render('limit', {
            listName: requestedList,
            listURL: '/'+_.kebabCase(requestedList),
            kindOfDay: kindOfDay,
            toDoLists: toDoLists
          });
        });
      }
    }
  });
}

function findListNames(res,callback) {
  List.find({},{listName:1},(err,lists)=>{
    if (err) {
      res.render('error',{ err:err });
      console.error(err);
    } else {
      let toDoLists = [];
      lists.forEach((list)=>{
        toDoLists.push({
          listName: list.listName,
          listURL: '/'+_.kebabCase(list.listName)
        })
      })
      toDoLists.sort((a,b)=>{
        if (a.listName<=b.listName)
          return -1;
        return 1;
      });
      callback(toDoLists)
    }
  });
}

app.get('/', function(req, res) {
  initializeList(res,_.upperFirst(_.lowerCase(defaultListName)),()=>{
    res.redirect('/'+_.kebabCase(defaultListName));
  });
});

app.get('/:listName', function(req, res) {
  const requestedList = _.upperFirst(_.lowerCase(req.params.listName));
  if (requestedList.length > 25) {
    res.redirect('/'+_.kebabCase(requestedList.substring(0,25)));
  } else {
    const kindOfDay = date.getDate();
    List.findOne({listName:requestedList}, (err,result)=>{
      if (err) {
        res.render('error',{ err:err });
        console.error(err);
      } else {
        if (result === null) {
          initializeList(res,_.upperFirst(_.lowerCase(requestedList)),()=>{
            res.redirect('/'+_.kebabCase(requestedList));
          });
        } else {
          findListNames(res,(toDoLists)=>{
            res.render('list', {
              kindOfDay: kindOfDay,
              list: result.items,
              listName: requestedList,
              listURL: '/'+_.kebabCase(requestedList),
              toDoLists: toDoLists
            });
          });
        }
      }
    });
  }
});

app.post('/create', function(req, res) {
  const requestedList = _.upperFirst(_.lowerCase(req.body.newListName));
  initializeList(res,requestedList,()=>{
    res.redirect('/'+_.kebabCase(requestedList));
  });
});

app.post('/add', function(req, res) {
  const requestedList = _.upperFirst(_.lowerCase(req.body.button));
  checkItemLimit(res,requestedList,(result)=>{
    result.items.push(new ListItem({
      name: req.body.newItem.substring(0,40)
    }));
    result.save((err)=>{
      if (err) {
        res.render('error',{ err:err });
        console.error(err);
      } else {
        res.redirect('/'+_.kebabCase(requestedList));
      }
    });
  });
});

app.post('/delete', function(req, res) {
  const requestedList = _.upperFirst(_.lowerCase(req.body.listName));
  const itemID = req.body.checkbox;
  List.findOneAndUpdate({listName:requestedList},{$pull: {items:{_id:itemID}}},(err/*,foundList*/)=>{
    if (err) {
      res.render('error',{ err:err });
      console.error(err);
    } else {
      res.redirect('/'+_.kebabCase(requestedList));
    }
  });
});

app.post('/deletelist', function(req, res) {
  const requestedList = _.upperFirst(_.lowerCase(req.body.button));
  List.deleteOne({listName: requestedList},(err)=>{
    if (err) {
      res.render('error',{ err:err });
      console.error(err);
    } else {
      res.redirect('/'+_.kebabCase(defaultListName));
    }
  });
});

app.listen(port, () => log('Server listening at: ', 'http://localhost:' + port + '/'));


/**
 * log - colorfull console.log() for "description: object" style logging
 *
 * @param  {string} msg description of the object
 * @param  {any}    obj will be logged using util.inspect()
 * @return {undefined}
 */
function log(msg, obj) {
  if (typeof obj === 'undefined') {
    return console.log('\x1b[36m' + msg + '\x1b[0m');
  }
  return console.log('\x1b[36m' + msg + '\x1b[0m' +
    util.inspect(obj, {
      colors: true
    }));
}
