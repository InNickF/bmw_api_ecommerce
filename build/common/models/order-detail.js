
module.exports = function (Orderdetail) {
  const orderdetailParam = Orderdetail

  orderdetailParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  orderdetailParam.validatesPresenceOf('quantity', {
    message: {
      labels: 'El campo cantidad es requerido',
      field: 'The quantity is required'
    }
  })
  orderdetailParam.validatesPresenceOf('price', {
    message: {
      labels: 'El campo precio es requerido',
      field: 'The price is required'
    }
  })
  orderdetailParam.validatesPresenceOf('image', {
    message: {
      labels: 'El campo imagen es requerido',
      field: 'The image is required'
    }
  })
  orderdetailParam.validatesPresenceOf('taxes', {
    message: {
      labels: 'El campo impuesto es requerido',
      field: 'The taxes is required'
    }
  })
  orderdetailParam.validatesPresenceOf('sku', {
    message: {
      labels: 'El campo sku es requerido',
      field: 'The sku is required'
    }
  })
  orderdetailParam.validatesPresenceOf('orderId', {
    message: {
      labels: 'El campo orden es requerido',
      field: 'The orderId is required'
    }
  })
  orderdetailParam.validatesPresenceOf('productId', {
    message: {
      labels: 'El campo producto es requerido',
      field: 'The productId is required'
    }
  })
}
