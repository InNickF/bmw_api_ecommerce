
module.exports = function (server) {
  // Install a `/` route that returns server status
  let router = server.loopback.Router()
  router.get('/', server.loopback.status())
  server.use(router)
}
