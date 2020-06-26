import * as autogermanaIntegration from '../../integrations/autogermana'
import throat from 'throat'

// eslint-disable
const s3tree = require('s3-tree')
const aws = require('aws-sdk')

module.exports = function (VehicleModel) {
  const vehicleModelParam = VehicleModel

  vehicleModelParam.validatesPresenceOf('name', {
    message: 'El campo name es requerido'
  })

  // vehicleModelParam.createdModels = async function (body, cb) {
  vehicleModelParam.handleModelsAutogermana = async () => {
    let modelsAutoGermana = null
    try {
      modelsAutoGermana = await autogermanaIntegration.getModels()
    } catch (error) {
      throw (error)
    }

    aws.config.update({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    })

    const s3 = new aws.S3({apiVersion: '2006-03-01'})

    const generator = s3tree({bucket: 'autogermana', s3})

    let tree
    try {
      tree = await generator.generate('/modelos/')
    } catch (error) {
      throw error
    }

    // proceso para la gestion de los modelos
    const results = await Promise.all(modelsAutoGermana.map(
      throat(1, async modelo => {
        const {Brand} = vehicleModelParam.app.models
        let brandInstance
        try {
          brandInstance = await Brand.findOne({where: {code: modelo.Marca}})
        } catch (error) {
          return error
        }

        // valido
        if (!brandInstance) {
          return new Error(`La marca ${modelo.Marca}, no existe`)
        }

        // busco la serie
        const {VehicleSerie} = vehicleModelParam.app.models
        let vehicleSerieInstance
        try {
          vehicleSerieInstance = await VehicleSerie.findOne({
            where: {name: modelo.Serie, brandId: brandInstance.id}
          })
        } catch (error) {
          return error
        }

        // valido
        if (!vehicleSerieInstance) {
          return new Error(`La serie con el nombre ${modelo.Serie} para la marca ${modelo.Marca}, no existe.`)
        }

        let image = 'https://autogermana.s3-us-west-1.amazonaws.com/no-photo.png'
        let hasImage = false
        for (let key in tree) {
          if (key === `${modelo.Modelo}.WEBP`) {
            hasImage = true
            image = `https://autogermana.s3-us-west-1.amazonaws.com/modelos/${modelo.Modelo}.WEBP`
          }
        }

        // defino el objeto
        const vehicleModelObject = {
          name: modelo.Modelo,
          vehicleSerieId: vehicleSerieInstance.id,
          image: hasImage ? image : 'https://autogermana.s3-us-west-1.amazonaws.com/no-photo.png'
        }

        // encuentro o creo el modelo
        let vehicleModelResult
        try {
          vehicleModelResult = await vehicleModelParam.findOrCreate({
            where: {name: vehicleModelObject.name, vehicleSerieId: vehicleModelObject.vehicleSerieId}
          }, vehicleModelObject)
        } catch (error) {
          return error
        }

        // asigno a la instancia
        const vehicleModelInstance = vehicleModelResult[0]

        // si existe entonces lo actualizo
        if (!vehicleModelResult[1]) {
          try {
            await vehicleModelInstance.updateAttributes({vehicleModelObject})
          } catch (error) {
            return error
          }
        }

        return vehicleModelInstance
      })
    ))

    const instances = results.filter(item => !(item instanceof Error))
    const errors = results.filter(item => item instanceof Error).map(item => item.message)

    return {
      processed: instances.length,
      errors
    }
  }
  vehicleModelParam.remoteMethod('handleModelsAutogermana', {
    http: {
      verb: 'post',
      path: '/handle-models-autogermana'
    },
    returns: {
      arg: 'data',
      type: 'Object',
      root: true
    }
  })
}
