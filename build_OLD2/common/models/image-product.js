import * as Util from '../../server/utils'
import path from 'path'
import * as app from '../../server/server'
import {uploadFile} from '../../server/functions/upload-file'

module.exports = function (Imageproduct) {
  const imageproductParam = Imageproduct
  imageproductParam.validatesPresenceOf('productId', {
    message: {
      labels: 'El campo producto es requerido',
      field: 'The productId is required'
    }
  })

  /**
   * Función para crear la instancia con su respectivo archivo
   *
   * @param {object} req objeto request
   * @returns {object} imageProduct instance
   */
  imageproductParam.createWithFile = async req => {
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
      if (key === 'productId') {
        const {Product} = app.models
        let product = null
        product = await Product.findOne({
          where: {
            sku: fields[key]
          }
        })
        obj[key] = product.id
      } else {
        obj[key] = fields[key]
      }
    }
    obj.image = '-'

    // Creo la instancia
    let imageProductInstance = null
    try {
      imageProductInstance = await imageproductParam.create(obj)
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
      const destinationPath = `image-products/${imageProductInstance.id}${ext}`

      // Subo el archivo
      let location
      try {
        location = await uploadFile(file.path, destinationPath)
      } catch (error) {
        throw error
      }

      // Actualizo la instancia
      try {
        await imageProductInstance.updateAttributes({image: location})
      } catch (error) {
        throw error
      }
    }

    return imageProductInstance
  }
  imageproductParam.remoteMethod('createWithFile', {
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

  imageproductParam.updateWithFile = async (id, req) => {
    // Busco la instancia
    let imageProductInstance
    try {
      imageProductInstance = await imageproductParam.findById(id)
    } catch (error) {
      throw error
    }

    if (!imageProductInstance) {
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
      const destinationPath = `image-products/${imageProductInstance.id}${file.name}`

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
      await imageProductInstance.updateAttributes(obj)
    } catch (error) {
      throw error
    }

    return imageProductInstance
  }
  imageproductParam.remoteMethod('updateWithFile', {
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
