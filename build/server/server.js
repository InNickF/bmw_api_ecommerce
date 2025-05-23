const dotenv = require('dotenv')
const loopback = require('loopback')
const boot = require('loopback-boot')
const firebaseMiddleware = require('../server/middleware/firebase')

const app = (module.exports = loopback())

/* app.middleware('routes:before', firebaseMiddleware()) */

dotenv.config()

app.start = function () {
  // start the web server
  return app.listen(() => {
    console.log(process.env.NODE_ENV, process.env.MERCADOPAGO_HOOKS)
    app.emit('started')
    const baseUrl = app.get('url').replace(/\/$/, '')
    console.log('Web server listening at: %s', baseUrl)

    if (app.get('loopback-component-explorer')) {
      const explorerPath = app.get('loopback-component-explorer').mountPath
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath)
    }
  })
}

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, err => {
  if (err) {
    console.log(err)
    throw err
  }

  // start the server if `$ node server.js`
  if (require.main === module) {
    app.start()
  }
})
