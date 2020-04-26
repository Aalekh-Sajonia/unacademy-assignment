console.log("hellow");
const requestURL = 'http://localhost:3000/query';

let button = document.getElementById("queryBtn");
let input = document.getElementById("secret");
let result  = document.getElementById("result");

let data = {
  query: ""
}

button.addEventListener('click',(event) => {
  console.log("clicked");
  event.preventDefault();
  data.query = input.value.trim();
  postQuery(data);
  console.log("async");
});

async function postQuery(query) {
  try {
    const response = await fetch(requestURL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(query)
    });
    let finalData = await response.json();
    console.log(finalData);
    result.innerHTML = JSON.stringify(finalData);
    console.log("SuccessHere");
  } catch(err) {
    console.log(err);
  }
}
