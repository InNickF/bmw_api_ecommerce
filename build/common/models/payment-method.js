
module.exports = function (Paymentmethod) {
  const paymentmethodParam = Paymentmethod
  paymentmethodParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  paymentmethodParam.validatesPresenceOf('code', {
    message: {
      labels: 'El campo código es requerido',
      field: 'The code is required'
    }
  })
  paymentmethodParam.validatesUniquenessOf('name', {
    message: {
      labels: 'El nombre ya existe',
      field: 'The name already exists'
    }
  })
  paymentmethodParam.validatesUniquenessOf('code', {
    message: {
      labels: 'El código ya existe',
      field: 'The code already exists'
    }
  })
  paymentmethodParam.validatesLengthOf('code', {
    min: 3,
    max: 8,
    message: {
      min: {
        labels: 'El código debe tener mínimo 3 caracteres',
        field: 'The code must have at least 3 characters'
      },
      max: {
        labels: 'El código debe tener máximo 8 caracteres',
        field: 'The code must have a maximum of 8 characters'
      }
    }
  })
}
