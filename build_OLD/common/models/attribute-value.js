
module.exports = function (Attributevalue) {
  const attributevalueParam = Attributevalue
  attributevalueParam.validatesPresenceOf('value', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The value is required'
    }
  })
  attributevalueParam.validatesPresenceOf('productId', {
    message: {
      labels: 'El atributo no esta relacionado con un producto',
      field: 'The productId is required'
    }
  })
}
