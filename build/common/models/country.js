
module.exports = function (Country) {
  const countryParam = Country
  countryParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  countryParam.validatesUniquenessOf('name', {
    message: {
      labels: 'El nombre ya existe',
      field: 'The name already exists'
    }
  })
  countryParam.validatesLengthOf('name', {
    min: 3,
    max: 15,
    message: {
      min: {
        labels: 'El nombre debe tener mínimo 3 caracteres',
        field: 'The name must have at least 3 characters'
      },
      max: {
        labels: 'El nombre debe tener máximo 15 caracteres',
        field: 'The name must have a maximum of 15 characters'
      }
    }
  })
  countryParam.validatesPresenceOf('code', {
    message: {
      labels: 'El campo código es requerido',
      field: 'The code is required'
    }
  })
  countryParam.validatesUniquenessOf('code', {
    message: {
      labels: 'El código ya existe',
      field: 'The code already exists'
    }
  })
  countryParam.validatesLengthOf('code', {
    min: 2,
    max: 5,
    message: {
      min: {
        labels: 'El code debe tener mínimo 2 caracteres',
        field: 'The code must have at least 2 characters'
      },
      max: {
        labels: 'El code debe tener máximo 5 caracteres',
        field: 'The code must have a maximum of 5 characters'
      }
    }
  })
}
