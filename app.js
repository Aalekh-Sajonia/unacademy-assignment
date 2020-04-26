const express = require('express');
const bodyParser = require("body-parser");
const ejs = require("ejs");
const map = require('sorted-map');
const fs =  require('fs');
const cron = require('node-cron');

var app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(bodyParser.json({
  extended: true
}));

// store in datastore

const writeFile = () => {
  let temp = {};

  Object.keys(data).forEach(ele => {
    if(data.circular[ele])
    {
      let d = data[ele].slice(0,data[ele].length);
      console.log(d);
      temp[ele] = d;
    }
    else
    {
      temp[ele] = data[ele];
    }
  })
  // let t = [{key:1,val:"asd"},
            // {key:2,val:"adasd"}];
  console.log(temp);
  fs.writeFile('data.json', JSON.stringify(temp) ,() => console.log('done'));
}

//cron job

cron.schedule("* * * * *", writeFile);

// all datastore

let data = {
  circular: {}
};

let timerHandler = {

};

const secret = "xYhJkL7*98AJK"; //all expired key will get this

//all functions

const repopulate = () => {
  let temp = JSON.parse(fs.readFileSync('data.json'));
  data = {
    ...temp
  };
  Object.keys(temp.circular).forEach(ele => {
    data[ele] = new map();
    // console.log(temp[ele][0].key);
    temp[ele].forEach(e => {
      // console.log(e.value);
      data[ele].set(e.key,e.value);
    })
  })
  console.log(data);
}

repopulate();

const getMethod = (key) => {
  if(data[key] === secret)
  {
    return false;
  }
  return data[key];
}

const expire = (time,key) => {
  if(!data[key])
  {
    return 0;
  }
  if(time < 0)
  {
    delete data[key];
    delete timerHandler[key];
  }
  else
  {
    if(timerHandler[key])
    {
      clearTimeout(timerHandler[key]);
    }
    let t = setTimeout(() => { data[key] = secret },time);
    timerHandler[key] = t;
    console.log("here");
  }
  // console.log(data);
  return "1";
}

const setMethod = (arr) => {
    console.log(arr);

    if(arr.length > 5)
    {
      return false;
    }

    if(arr.length === 3)
    {
      data[arr[1]] = arr[2];
      return true;
    }

    if(arr[3] === 'NX' || arr[3] === 'nx')
    {
      if(data[arr[1]])
      {
        return false;
      }
      data[arr[1]] = arr[2];
      return true;
    }

    if(arr[3] === 'XX' || arr[3] === 'xx')
    {
      if(data[arr[1]])
      {
        data[arr[1]] = arr[2];
        return true;
      }
      return false;
    }

    if(arr[3] === 'PX' || arr[3] === 'px')
    {
      data[arr[1]] = arr[2];
      expire(parseInt(arr[4]),arr[1]);
      return true;
    }

    if(arr[3] === 'EX' || arr[3] === 'ex')
    {
      data[arr[1]] = arr[2];
      expire(parseInt(arr[4])*1000,arr[1]);
      return true;
    }

    return false;
}

const addItemsToMap = (query) => {
  for(let i = 3;i<query.length;i+=2)
  {
    data[query[1]].set(query[i],parseInt(query[i-1]));
  }
}

const zadd = (query) => {
  if(!data[query[1]])
  {
    data[query[1]] = new map();
    data.circular[query[1]] = true;
  }
  addItemsToMap(query);
  console.log(data);
  return true;
}

const zrank = (query) => {
  if(data[query[1]])
  {
    return data[query[1]].rank(query[2]);
  }
  return false;
}

const zrange = (query) => {
  if(query.length > 5)
  {
    return false;
  }
  let ans;
  if(data[query[1]])
  {
    let left = parseInt(query[2]);
    let right = parseInt(query[3]);

    if(left < 0)
    {
      left = data[query[1]].length + left;
    }
    if(right < 0)
    {
      right = data[query[1]].length + right + 1;
    }
    if(left < right)
    {
      ans = data[query[1]].slice(left,right);
      if(query.length === 5)
      {
        if(query[4] === 'WITHSCORES')
        {
          return ans;
        }
      }
      else
      {
        let noScore = [];
        ans.forEach(ele => {
          noScore.push({
            key: ele.key
          })
        })
        return noScore;
      }
    }
  }
  return false;
}

const query = (data) => {
    let temp = data.split("\"");
    console.log(temp);
    let content;
    if(temp.length === 1)
    {
      content = temp[0].trim().split(" ");
    }
    else
    {
      content = [...temp[0].trim().split(" "),temp[1],...temp[2].trim().split(" ")];
      if(content[0] === 'ZADD')
      {
        content = [];
        temp.forEach(ele => {
          ele.trim().split(" ").forEach(ele => {
            content.push(ele);
          })
        })
        content.pop();
      }
    }
    console.log("content",content);
    if(content.length <= 1)
    {
      return "wrong";
    }

    if(content[0] === 'GET')
    {
      if(getMethod(content[1]))
      {
        return getMethod(content[1]);
      }
      else
      {
        return 'nil';
      }
    }

    if(content[0] === 'SET')
    {
      if(content.length === 4 && content[3] !== 'NX' && content[3] !== 'XX')
      {
        content.pop();
      }
      if(setMethod(content))
      {
        return 'OK';
      }
      else
      {
        return 'nil';
      }
    }

    if(content[0] === 'EXPIRE')
    {
      console.log(content.length);
      if(content.length !== 3)
      {
        return "wrong";
      }
      else
      {
        return expire(parseInt(content[2]),content[1]);
      }
    }

    if(content[0] === 'ZADD')
    {
      if(zadd(content))
      {
        return '1';
      }
      else
      {
        return '0';
      }
    }

    if(content[0] === 'ZRANK')
    {
      let ans = zrank(content);
      if(ans === -1)
      {
        return 'nil';
      }
      else
      {
        return ans;
      }
    }

    if(content[0] === 'ZRANGE')
    {
      let ans = zrange(content);
      if(ans)
      {
        return ans;
      }
      else
      {
        return 'nil';
      }
    }
    return "wrong";
}

// all requests

app.get('/', (req, res) => {
  res.render('submit');
  writeFile();
});

app.post('/query', (req,res) => {
  // console.log(req.body);
  let result = query(req.body.query);
  console.log(result);
  let jsonSent = {
    result: result
  }
  res.send(JSON.stringify(jsonSent));
})

app.listen(3000, () => {
  console.log('app listening on port 3000!');
});
