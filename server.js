const express = require('express')
const path = require('path')
const app = express()
const port = 3000

app.set('views', path.join(__dirname, '.'));
app.set('view engine', 'ejs');

app.use(`/public`, express.static('public'));

app.get('/', (req, res) => {
  res.render('./index');
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
