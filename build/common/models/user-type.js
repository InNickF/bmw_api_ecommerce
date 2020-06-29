
module.exports = function (UserType) {
  const userTypeParam = UserType
  userTypeParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  userTypeParam.validatesUniquenessOf('name', {
    message: {
      labels: 'El nombre ya existe',
      field: 'The name already exists'
    }
  })
  userTypeParam.validatesLengthOf('name', {
    min: 3,
    max: 15,
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
  userTypeParam.validatesPresenceOf('code', {
    message: {
      labels: 'El campo código es requerido',
      field: 'The code is required'
    }
  })
  userTypeParam.validatesUniquenessOf('code', {
    message: {
      labels: 'El código ya existe',
      field: 'The code already exists'
    }
  })
  userTypeParam.validatesLengthOf('code', {
    min: 3,
    max: 15,
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
