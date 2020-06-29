import * as Util from '../../server/utils'
import path from 'path'
import {uploadFile} from '../../server/functions/upload-file'
import * as autogermanaIntegration from '../../integrations/autogermana'
import throat from 'throat'

module.exports = function (Vehiclebrand) {
  const vehiclebrandParam = Vehiclebrand

  vehiclebrandParam.handleVehicleBrandsAutoGermana = async () => {
    let vehicleBrandsFromAG
    try {
      vehicleBrandsFromAG = await autogermanaIntegration.getVehicleBrands()
    } catch (error) {
      throw error
    }

    // resuelvo las
    const results = await Promise.all(vehicleBrandsFromAG.map(
      throat(1, async vehicleBrand => {
        // creo el objeto
        const vehicleBrandObj = {
          code: vehicleBrand.Codigo,
          name: vehicleBrand.Marca

        }

        // creo la instancia
        let vehicleBrandInstance
        try {
          vehicleBrandInstance = await vehiclebrandParam.findOrCreate({where: vehicleBrandObj}, vehicleBrandObj)
        } catch (error) {
          return error
        }

        return vehicleBrandInstance
      })
    ))

    const instances = results.map(item => item[0]).filter(item => !(item instanceof Error))
    const errors = results.filter(item => item instanceof Error)
    return {
      processed: instances.length,
      errors
    }
  }
  vehiclebrandParam.remoteMethod('handleVehicleBrandsAutoGermana', {
    http: {
      verb: 'get',
      path: '/autogermana/createdBrands'
    },
    returns: {
      arg: 'data',
      type: 'Object'
    }
  }
  )

  /**
   * Función para crear la instancia con su respectivo archivo
   *
   * @param {object} req objeto request
   * @returns {object} imageVehicleBrand instance
   */
  vehiclebrandParam.createWithFile = async req => {
    // Obtengo la data del formulario
    let formData
    try {
      formData = await Util.getFormData(req)
    } catch (error) {
      throw error
    }

    // Obtengo campos
    const {
      fields
    } = formData
    const obj = {}
    for (const key in fields) {
      obj[key] = fields[key]
    }
    obj.image = '-'

    // Creo la instancia
    let imageVehicleBrandInstance = null
    try {
      imageVehicleBrandInstance = await vehiclebrandParam.create(obj)
    } catch (error) {
      throw error
    }

    // Obtengo el file
    const {
      files
    } = formData
    let file
    for (const key in files) {
      file = files[key]
    }

    // Valido que tenga el file
    if (file) {
      // Armo la ruta de destino
      const ext = path.extname(file.name)
      const destinationPath = `admin/images/vehicle-brands/${imageVehicleBrandInstance.id}${ext}`

      // Subo el archivo
      let location
      try {
        location = await uploadFile(file.path, destinationPath)
      } catch (error) {
        throw error
      }

      // Actualizo la instancia
      try {
        await imageVehicleBrandInstance.updateAttributes({
          image: location
        })
      } catch (error) {
        throw error
      }
    }

    return imageVehicleBrandInstance
  }
  vehiclebrandParam.remoteMethod('createWithFile', {
    description: 'Crea la instancia con su respectivo archivo',
    accepts: {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    }, // pass the request object to remote method
    returns: {
      root: true,
      type: 'object'
    },
    http: {
      path: '/create-with-file',
      verb: 'post'
    }
  })

  vehiclebrandParam.updateWithFile = async (id, req) => {
    // Busco la instancia
    let imageVehicleBrandInstance
    try {
      imageVehicleBrandInstance = await vehiclebrandParam.findById(id)
    } catch (error) {
      throw error
    }

    if (!imageVehicleBrandInstance) {
      throw new Error(`No existe la instancia con el id ${id}`)
    }

    // Obtengo la data del formulario
    let formData = null
    try {
      formData = await Util.getFormData(req)
    } catch (error) {
      throw error
    }

    // Obtengo campos
    const {
      fields
    } = formData
    const obj = {}
    for (const key in fields) {
      obj[key] = fields[key]
    }

    // Obtengo el file
    const {
      files
    } = formData
    let file
    for (const key in files) {
      file = files[key]
    }

    // Valido que tenga el file
    if (file) {
      // Armo la ruta de destino
      const destinationPath = `admin/images/vehicle-brands/${imageVehicleBrandInstance.id}${file.name}`

      // Subo el archivo
      let location
      try {
        location = await uploadFile(file.path, destinationPath)
      } catch (error) {
        throw error
      }

      obj.image = location
    }

    // Actualizo la instancia
    try {
      await imageVehicleBrandInstance.updateAttributes(obj)
    } catch (error) {
      throw error
    }

    return imageVehicleBrandInstance
  }
  vehiclebrandParam.remoteMethod('updateWithFile', {
    description: 'Actualiza la instancia con su respectivo archivo',
    accepts: [{
      arg: 'id',
      type: 'number',
      required: true
    }, // id del de la imagen del banner
    {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    } // pass the request object to remote method
    ],
    returns: {
      root: true,
      type: 'object'
    },
    http: {
      path: '/:id/update-with-file',
      verb: 'patch'
    }
  })
}
