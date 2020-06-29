
module.exports = function (Articlecategory) {
  const articlecategoryParam = Articlecategory
  articlecategoryParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
}
