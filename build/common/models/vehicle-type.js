
module.exports = function (Vehicletype) {
  const vehicletypeParam = Vehicletype
  vehicletypeParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  vehicletypeParam.validatesUniquenessOf('name', {
    message: {
      labels: 'El nombre ya existe',
      field: 'The name already exists'
    }
  })
  vehicletypeParam.validatesLengthOf('name', {
    min: 3,
    max: 20,
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
}
