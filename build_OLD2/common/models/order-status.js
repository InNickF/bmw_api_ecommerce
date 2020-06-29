
module.exports = function (orderStatus) {
  const orderStatusParam = orderStatus
  orderStatusParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  orderStatusParam.validatesUniquenessOf('name', {
    message: {
      labels: 'El nombre ya existe',
      field: 'The name already exists'
    }
  })
  orderStatusParam.validatesLengthOf('name', {
    min: 3,
    max: 10,
    message: {
      min: {
        labels: 'El nombre debe tener mínimo 3 caracteres',
        field: 'The name must have at least 3 characters'
      },
      max: {
        labels: 'El nombre debe tener máximo 10 caracteres',
        field: 'The name must have a maximum of 10 characters'
      }
    }
  })
  orderStatusParam.validatesPresenceOf('code', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  orderStatusParam.validatesUniquenessOf('code', {
    message: {
      labels: 'El código ya existe',
      field: 'The code already exists'
    }
  })
}
