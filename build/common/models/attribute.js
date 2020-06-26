
module.exports = function (Attribute) {
  const attributeParam = Attribute
  attributeParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
}
