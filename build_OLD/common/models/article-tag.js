
module.exports = function (Articletag) {
  const articletagParam = Articletag
  articletagParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
}
