
module.exports = function (Serviceproduct) {
  const serviceproductParam = Serviceproduct
  serviceproductParam.validatesPresenceOf('price', {
    message: {
      labels: 'El campo precio es requerido',
      field: 'The price is required'
    }
  })
  serviceproductParam.validatesPresenceOf('serviceId', {
    message: {
      labels: 'El campo servicio es requerido',
      field: 'The serviceId is required'
    }
  })
  serviceproductParam.validatesPresenceOf('productId', {

    message: {
      labels: 'El campo producto es requerido',
      field: 'The productId is required'
    }
  })
}
