
module.exports = function (Motivator) {
  const motivatorParam = Motivator
  motivatorParam.validatesPresenceOf('userId', {
    message: {
      labels: 'El campo usuario es requerido ',
      field: 'The userId is required'
    }
  })
  motivatorParam.validatesPresenceOf('productCategoryId', {
    message: {
      labels: 'El campo categoría es requerido ',
      field: 'The productCategoryId is required'
    }
  })
}
