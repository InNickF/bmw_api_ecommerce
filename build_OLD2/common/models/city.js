
module.exports = function (City) {
  const cityParam = City

  cityParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  cityParam.validatesUniquenessOf('name', {
    message: {
      labels: 'El nombre ya existe',
      field: 'The name already exists'
    }
  })
  cityParam.validatesLengthOf('name', {
    min: 3,
    max: 20,
    message: {
      min: {
        labels: 'El nombre debe tener mínimo 3 caracteres',
        field: 'The name must have at least 3 characters'
      },
      max: {
        labels: 'El nombre debe tener máximo 20 caracteres',
        field: 'The name must have a maximum of 20 characters'
      }
    }
  })
  cityParam.validatesPresenceOf('code', {
    message: {
      labels: 'El campo código es requerido',
      field: 'The code is required'
    }
  })
  cityParam.validatesUniquenessOf('code', {
    message: {
      labels: 'El código ya existe',
      field: 'The code already exists'
    }
  })
  cityParam.validatesLengthOf('code', {
    min: 3,
    max: 6,
    message: {
      min: {
        labels: 'El código debe tener mínimo 3 caracteres',
        field: 'The code must have at least 3 characters'
      },
      max: {
        labels: 'El código debe tener máximo 6 caracteres',
        field: 'The code must have a maximum of 6 characters'
      }
    }
  })
  cityParam.validatesPresenceOf('hasStore', {
    message: {
      labels: 'El campo ¿Es una tienda? es requerido',
      field: 'The hasStore is required'
    }
  })
}
