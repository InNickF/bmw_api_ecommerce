module.exports = function (Address) {
  const addressParam = Address

  addressParam.observe('before save', async (ctx, next) => {
    if (ctx.isNewInstance) {
      if (ctx.instance.isDefault) {
        await addressParam.updateAll({
          userId: ctx.instance.userId
        }, {
          isDefault: false
        })
      }
    } else {
      if (ctx.instance) {
        if (ctx.instance.isDefault) {
          await addressParam.updateAll({
            userId: ctx.instance.userId
          }, {
            isDefault: false
          })
        }
      }
    }
    next()
  })

  addressParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  addressParam.validatesPresenceOf('userId', {
    message: {
      labels: 'El campo usuario es requerido',
      field: 'The user is required'
    }
  })
  addressParam.validatesPresenceOf('cityId', {
    message: {
      labels: 'El campo ciudad es requerido',
      field: 'The city is required'
    }
  })
  addressParam.validatesLengthOf('name', {
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
  addressParam.validatesPresenceOf('value', {
    message: {
      labels: 'El campo direccion es requerido',
      field: 'The value is required'
    }
  })
  addressParam.validatesPresenceOf('phone', {
    message: {
      labels: 'El campo telefono es requerido',
      field: 'The value is required'
    }
  })
}
