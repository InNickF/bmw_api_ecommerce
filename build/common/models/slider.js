import * as Util from '../../server/utils'
import path from 'path'
import {uploadFile} from '../../server/functions/upload-file'

module.exports = function (Slider) {
  const sliderParam = Slider
  sliderParam.validatesPresenceOf('link', {
    message: {
      labels: 'El campo enlace es requerido',
      field: 'The link is required'
    }
  })
  sliderParam.validatesPresenceOf('image', {
    message: {
      labels: 'El imagen nombre es requerido',
      field: 'The image is required'
    }
  })
  /**
   * Función para crear la instancia con su respectivo archivo
   *
   * @param {object} req objeto request
   * @returns {object} imageSlider instance
   */
  sliderParam.createWithFile = async req => {
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
    let imageSliderInstance = null
    try {
      imageSliderInstance = await sliderParam.create(obj)
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
      const destinationPath = `admin/images/sliders/${imageSliderInstance.id}${ext}`

      // Subo el archivo
      let location
      try {
        location = await uploadFile(file.path, destinationPath)
      } catch (error) {
        throw error
      }

      // Actualizo la instancia
      try {
        await imageSliderInstance.updateAttributes({image: location})
      } catch (error) {
        throw error
      }
    }

    return imageSliderInstance
  }
  sliderParam.remoteMethod('createWithFile', {
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

  sliderParam.updateWithFile = async (id, req) => {
    // Busco la instancia
    let imageSliderInstance
    try {
      imageSliderInstance = await sliderParam.findById(id)
    } catch (error) {
      throw error
    }

    if (!imageSliderInstance) {
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
      const destinationPath = `admin/images/sliders/${imageSliderInstance.id}${file.name}`

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
      await imageSliderInstance.updateAttributes(obj)
    } catch (error) {
      throw error
    }

    return imageSliderInstance
  }
  sliderParam.remoteMethod('updateWithFile', {
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
