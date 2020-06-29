
module.exports = function (Codecoupon) {
  const codecouponParam = Codecoupon
  codecouponParam.validatesPresenceOf('code', {
    message: {
      labels: 'El código del cupón es requerido',
      field: 'The code is required'
    }
  })
  codecouponParam.validatesPresenceOf('value', {
    message: {
      labels: 'El valor del código del cupón es requerido',
      field: 'The value is required'
    }
  })

  codecouponParam.validatesUniquenessOf('code', {
    message: {
      labels: 'El código ya existe',
      field: 'The code already exists'
    }
  })
  codecouponParam.validatesLengthOf('code', {
    min: 3,
    max: 10,
    message: {
      min: {
        labels: 'El código debe tener mínimo 3 caracteres',
        field: 'The code must have at least 3 characters'
      },
      max: {
        labels: 'El código debe tener máximo 10 caracteres',
        field: 'The code must have a maximum of 10 characters'
      }
    }
  })
}
