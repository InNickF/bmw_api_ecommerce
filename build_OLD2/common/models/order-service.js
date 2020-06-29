
module.exports = function (Orderservice) {
  const orderserviceParam = Orderservice
  orderserviceParam.validatesPresenceOf('price', {
    message: {
      labels: 'El precio del servicio es requerido',
      field: 'The price is required'
    }
  })
  orderserviceParam.validatesPresenceOf('serviceProductId', {
    message: {
      labels: 'La campo servicio del producto es requerido',
      field: 'The serviceProductId is required'
    }
  })
  orderserviceParam.validatesPresenceOf('orderId', {
    message: {
      labels: 'La orden de servicio no esta asociado a ninguna orden',
      field: 'The orderId is required'
    }
  })
}
