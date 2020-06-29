import * as autogermanaIntegration from '../../integrations/autogermana'

module.exports = function (Vehicle) {
  const vehicleParam = Vehicle
  /*
  vehicleParam.validatesPresenceOf('plate', {
    message: {
      labels: 'El campo placa es requerido',
      field: 'The plate is required'
    }
  })
  vehicleParam.validatesUniquenessOf('plate', {
    message: {
      labels: 'La placa ya existe',
      field: 'The plate already exists'
    }
  })
  vehicleParam.validatesLengthOf('plate', {
    min: 3,
    max: 10,
    message: {
      min: {
        labels: 'La placa debe tener mínimo 3 caracteres',
        field: 'The plate must have at least 3 characters'
      },
      max: {
        labels: 'La placa debe tener máximo 10 caracteres',
        field: 'The plate must have a maximum of 10 characters'
      }
    }
  })
  */
  vehicleParam.validatesPresenceOf('chassis', {
    message: {
      labels: 'El campo chassis es requerido',
      field: 'The chassis is required'
    }
  })
  vehicleParam.validatesUniquenessOf('chassis', {
    message: {
      labels: 'El chassis ya existe',
      field: 'The chassis already exists'
    }
  })
  vehicleParam.validatesLengthOf('chassis', {
    min: 3,
    max: 20,
    message: {
      min: {
        labels: 'El chassis debe tener mínimo 3 caracteres',
        field: 'The chassis must have at least 3 characters'
      },
      max: {
        labels: 'El chassis debe tener máximo 20 caracteres',
        field: 'The chassis must have a maximum of 20 characters'
      }
    }
  })

  // vehicleParam.createdVehicle = async function (body, cb) {
  vehicleParam.createdVehicle = async body => {
    const {
      VehicleBrand,
      VehicleModel,
      VehicleSerie
    } = vehicleParam.app.models

    let vehicle = null
    try {
      vehicle = await autogermanaIntegration.getVehicle(body)
    } catch (error) {
      throw error
    }

    // valido
    if (vehicle.length === 0) {
      throw new Error(`No se encontro informacion del vehiculo en autogermana. ${vehicle.length}`)
    }

    if (vehicle.length !== 0) {
      let brand = null
      try {
        brand = await VehicleBrand.findOne({
          where: {
            name: vehicle[0].Codigomarca
          }
        })
      } catch (error) {
        throw error
      }

      let model = null
      try {
        model = await VehicleModel.findOne({
          where: {
            name: vehicle[0].Desmodelo
          }
        })
      } catch (error) {
        throw error
      }

      let vehicleSerie = null
      try {
        vehicleSerie = await VehicleSerie.findOne({
          where: {
            name: vehicle[0].Serie
          }
        })
      } catch (error) {
        throw error
      }

      // Crea el vehiculo
      if (body.created) {
        // Busca el vehiculo
        let vehicleInstance = null
        try {
          vehicleInstance = await vehicleParam.findOne({
            where: {
              chassis: vehicle[0].VIN,
              plate: vehicle[0].Placa,
              brandId: body.brandId
            }
          })
        } catch (error) {
          throw error
        }

        if (vehicleInstance === null) {
          try {
            await vehicleParam.create({
              chassis: vehicle[0].VIN,
              plate: vehicle[0].Placa,
              userId: body.userId,
              vehicleTypeId: 2,
              vehicleBrandId: brand ? brand.id : 0,
              vehicleSerieId: vehicleSerie ? vehicleSerie.id : 0,
              vehicleModelId: model ? model.id : 0,
              model: vehicle[0].Modelo,
              brandId: body.brandId
            })
          } catch (error) {
            throw error
          }
        }
      }

      let result = null
      if (body.created) {
        result = {
          vehicle: vehicle[0],
          brand: brand,
          model: model,
          vehicleSerie: vehicleSerie,
          created: true
        }
      } else {
        result = {
          vehicle: vehicle[0],
          brand: brand,
          model: model,
          vehicleSerie: vehicleSerie
        }
      }

      return result
    } else {
      const result = {}
      result.message = 'Vehiculo no encontrado'
      return result
    }
  }
  vehicleParam.remoteMethod(
    'createdVehicle', {
      accepts: {
        arg: 'body',
        type: 'Object',
        description: '{ chassis: "WBA8A1104GK357102", userId: 2, created: true }'
      },
      http: {
        verb: 'post',
        path: '/autogermana/createdVehicle'
      },
      returns: {
        arg: 'data',
        type: 'Object'
      }
    }
  )

  // Consultar informacion del vehiculo desde el servicio con el chasis
  vehicleParam.findVehicle = async function (body, cb) {
    let vehicle = null
    try {
      vehicle = await autogermanaIntegration.getVehicle(body)
    } catch (error) {
      return cb(error)
    }
    cb(null, vehicle[0])
  }
  vehicleParam.remoteMethod(
    'findVehicle', {
      accepts: {
        arg: 'body',
        type: 'Object'
      },
      http: {
        verb: 'get',
        path: '/autogermana/findVehicle'
      },
      returns: {
        arg: 'data',
        type: 'Object'
      }
    }
  )

  vehicleParam.getReferencesForChassis = async function (body, cb) {
    const {
      VehicleBrand,
      VehicleSerie,
      Product
    } = vehicleParam.app.models

    // Busco informacion del vehiculo o de la parte
    let parts = null
    try {
      if (body.chassis) {
        parts = await autogermanaIntegration.getReferences(body)
        parts.chassis = true
      } else if (body.reference) {
        parts = await autogermanaIntegration.getReferences(body)
        parts.reference = true
      }
    } catch (error) {
      return cb(error)
    }

    // Busca el vehiculo
    let vehicleInstance = null
    try {
      vehicleInstance = await vehicleParam.findOne({
        where: {
          chassis: body.id
        }
      })
    } catch (error) {
      return cb(error)
    }

    // Busco marca, modelo y linea del vehiculo si no existe
    if (vehicleInstance === null) {
      let brand = null
      try {
        brand = await VehicleBrand.findOne({
          where: {
            name: parts[0].Codigomarca
          }
        })
      } catch (error) {
        return cb(error)
      }

      let vehicleSerie = null
      try {
        vehicleSerie = await VehicleSerie.findOne({
          where: {
            name: parts[0].Serie
          }
        })
      } catch (error) {
        return cb(error)
      }

      // Crea el vehiculo
      if (body.created) {
        if (vehicleInstance === null) {
          try {
            await vehicleParam.create({
              chassis: parts[0].VIN,
              plate: parts[0].Placa,
              userId: body.userId,
              vehicleTypeId: 2,
              vehicleBrandId: brand.id,
              vehicleSerieId: vehicleSerie.id,
              model: parts[0].Modelo
            })
          } catch (error) {
            return cb(error)
          }
        }
      }
    }

    let arrayReferences = []
    parts.splice(body.skip, body.limit).map(async part => {
      await arrayReferences.push(part.Referencia)
    })

    // Buscar referencias que le sirven a este chassis
    let product = null
    try {
      product = await Product.find({
        where: {
          brandId: body.brandId,
          active: true,
          sku: {
            inq: arrayReferences
          },
          order: body.order
        },
        include: ['imageProducts']
      })
    } catch (error) {
      return cb(error)
    }

    const result = {}
    result.vehicle = vehicleInstance
    result.references = arrayReferences
    result.products = product
    result.count = product.length
    cb(null, result)
  }
  vehicleParam.remoteMethod(
    'getReferencesForChassis', {
      accepts: {
        arg: 'body',
        type: 'Object',
        require: true,
        description: '{ chassis: true, id: "WBA8A1104GK357102", userId: 2, created: true, , "limit": 100, "skip": 1  }'
      },
      http: {
        verb: 'get',
        path: '/autogermana/getReferencesForChassis'
      },
      returns: {
        arg: 'data',
        type: 'Object'
      }
    }
  )

  // Consultar informacion del vehiculo desde el servicio con el chasis
  vehicleParam.getReferencesForVehicle = async function (body, cb) {
    let vehicle = null
    try {
      vehicle = await vehicleParam.findOne({
        where: {
          model: body.model
          // Serie: body.Serie
          // Modelo body.model
        }
      })
    } catch (error) {
      return cb(error)
    }

    cb(null, vehicle)
  }
  vehicleParam.remoteMethod(
    'getReferencesForVehicle', {
      accepts: {
        arg: 'body',
        type: 'Object'
      },
      http: {
        verb: 'get',
        path: '/autogermana/getReferencesForVehicle'
      },
      returns: {
        arg: 'data',
        type: 'Object'
      }
    }
  )

  vehicleParam.getReferences = async function (body, cb) {
    const {
      Vehicle,
      Product
    } = vehicleParam.app.models

    // Busco informacion del vehiculo o de la parte
    let parts = null
    try {
      if (body.reference) {
        parts = await autogermanaIntegration.getReferences(body)
        parts.reference = true
      }
    } catch (error) {
      return cb(error)
    }

    // Buscar la referencia
    let referenceInstance = null
    try {
      referenceInstance = await Product.findOne({
        where: {
          sku: body.id
        }
      })
    } catch (error) {
      return cb(error)
    }

    // Buscar referencias que le sirven a este chassis ESTOY AQUI
    const vehicles = parts.map(async part => {
      let vehicle = null
      try {
        vehicle = await Vehicle.findOne({
          where: {
            chassis: part.VIN
          }
        })
      } catch (error) {
        return cb(error)
      }
      return vehicle || part
    })

    const result = {}
    result.reference = referenceInstance
    result.vehicles = await Promise.all(vehicles)

    cb(null, result)
  }
  vehicleParam.remoteMethod(
    'getReferences', {
      accepts: {
        arg: 'body',
        type: 'Object',
        require: true,
        description: '{ reference: true, id: "34112450469"}'

      },
      http: {
        verb: 'get',
        path: '/autogermana/getReferences'
      },
      returns: {
        arg: 'data',
        type: 'Object'
      }
    }
  )
}
