
import slug from 'slug'
import * as Util from '../../server/utils'
import path from 'path'
import {uploadFile} from '../../server/functions/upload-file'

module.exports = function (Event) {
  const eventParam = Event

  eventParam.observe('before save', async (ctx, next) => {
    if (ctx.isNewInstance) {
      ctx.instance.slug = slug(ctx.instance.name.toLowerCase())
    }
    next()
  })

  eventParam.validatesPresenceOf('name', {
    message: {
      labels: 'El campo nombre es requerido',
      field: 'The name is required'
    }
  })
  eventParam.validatesUniquenessOf('name', {
    message: {
      labels: 'El nombre ya existe',
      field: 'The name already exists'
    }
  })
  eventParam.validatesPresenceOf('description', {
    message: {
      labels: 'La descripción es requerido',
      field: 'The description is required'
    }
  })
  eventParam.validatesPresenceOf('address', {
    message: {
      labels: 'La dirección es requerido',
      field: 'The address is required'
    }
  })
  eventParam.validatesPresenceOf('startAt', {
    message: {
      labels: 'La fecha de inicio es requerido',
      field: 'The startAt is required'
    }
  })
  eventParam.validatesPresenceOf('endAt', {
    message: {
      labels: 'La fecha de finalización es requerido',
      field: 'The endAt is required'
    }
  })
  eventParam.validatesPresenceOf('place', {
    message: {
      labels: 'El lugar del evento es requerido',
      field: 'The place is required'
    }
  })
  eventParam.validatesPresenceOf('slug', {
    message: {
      labels: 'El campo slug es requerido',
      field: 'The slug is required'
    }
  })

  /**
   * Función para crear la instancia con su respectivo archivo
   *
   * @param {object} req objeto request
   * @returns {object} imageSlider instance
   */
  eventParam.createWithFile = async req => {
    // Obtengo la data del formulario
    let formData
    try {
      formData = await Util.getFormData(req)
    } catch (error) {
      throw error
    }

    // Obtengo campos
    const {fields} = formData
    const obj = {}
    for (const key in fields) {
      obj[key] = fields[key]
    }
    obj.image = '-'

    // Creo la instancia
    let imageEventInstance = null
    try {
      imageEventInstance = await eventParam.create(obj)
    } catch (error) {
      throw error
    }

    // Obtengo el file
    const {files} = formData
    let file
    for (const key in files) {
      file = files[key]
    }

    // Valido que tenga el file
    if (file) {
      // Armo la ruta de destino
      const ext = path.extname(file.name)
      const destinationPath = `admin/images/events/${imageEventInstance.id}${ext}`

      // Subo el archivo
      let location
      try {
        location = await uploadFile(file.path, destinationPath)
      } catch (error) {
        throw error
      }

      // Actualizo la instancia
      try {
        await imageEventInstance.updateAttributes({image: location})
      } catch (error) {
        throw error
      }
    }

    return imageEventInstance
  }
  eventParam.remoteMethod('createWithFile', {
    description: 'Crea la instancia con su respectivo archivo',
    accepts: {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    }, // pass the request object to remote method
    returns: {root: true, type: 'object'},
    http: {path: '/create-with-file', verb: 'post'}
  })

  eventParam.updateWithFile = async (id, req) => {
    // Busco la instancia
    let imageEventInstance
    try {
      imageEventInstance = await eventParam.findById(id)
    } catch (error) {
      throw error
    }

    if (!imageEventInstance) {
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
    const {fields} = formData
    const obj = {}
    for (const key in fields) {
      obj[key] = fields[key]
    }

    // Obtengo el file
    const {files} = formData
    let file
    for (const key in files) {
      file = files[key]
    }

    // Valido que tenga el file
    if (file) {
      // Armo la ruta de destino
      const destinationPath = `admin/images/events/${imageEventInstance.id}${file.name}`

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
      await imageEventInstance.updateAttributes(obj)
    } catch (error) {
      throw error
    }

    return imageEventInstance
  }
  eventParam.remoteMethod('updateWithFile', {
    description: 'Actualiza la instancia con su respectivo archivo',
    accepts: [
      {
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
    returns: {root: true, type: 'object'},
    http: {path: '/:id/update-with-file', verb: 'patch'}
  })
}
