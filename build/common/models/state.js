
module.exports = function (State) {
  const stateParam = State
  stateParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  stateParam.validatesUniquenessOf('name', {
    message: {
      labels: 'El nombre ya existe',
      field: 'The name already exists'
    }
  })
  stateParam.validatesLengthOf('name', {
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
  stateParam.validatesPresenceOf('code', {
    message: {
      labels: 'El campo código es requerido',
      field: 'The code is required'
    }
  })
  stateParam.validatesUniquenessOf('code', {
    message: {
      labels: 'El código ya existe',
      field: 'The code already exists'
    }
  })
  stateParam.validatesLengthOf('code', {
    min: 2,
    max: 5,
    message: {
      min: {
        labels: 'El código debe tener mínimo 2 caracteres',
        field: 'The code must have at least 2 characters'
      },
      max: {
        labels: 'El código debe tener máximo 5 caracteres',
        field: 'The code must have a maximum of 5 characters'
      }
    }
  })
  stateParam.validatesPresenceOf('countryId', {
    message: {
      labels: 'El campo país es requerido',
      field: 'The countryId is required'
    }
  })
}
