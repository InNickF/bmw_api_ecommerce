
module.exports = function (Productmodel) {
  const productmodelParam = Productmodel

  productmodelParam.validatesPresenceOf('vehicleModelId', {
    message: {
      labels: 'El campo modelo del vehículo es requerido',
      field: 'The name is required'
    }
  })
  productmodelParam.validatesPresenceOf('productId', {
    message: {
      labels: 'El campo producto es requerido',
      field: 'The name is required'
    }
  })
}
