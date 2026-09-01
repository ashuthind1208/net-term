import app from './server/index.js'

const port = Number(process.env.PORT || 3000)

app.listen(port, () => console.log(`Net Term Solutions listening on port ${port}`))
