import * as autogermanaIntegration from '../../integrations/autogermana'
import throat from 'throat'

module.exports = function (VehicleSerie) {
  const vehicleSerieParam = VehicleSerie
  vehicleSerieParam.validatesPresenceOf('name', {
    message: 'El campo nombre es requerido'
  })

  vehicleSerieParam.handleSeriesAutogermana = async () => {
    let vehicleSeriesAutoGermana
    try {
      vehicleSeriesAutoGermana = await autogermanaIntegration.getSeries()
    } catch (error) {
      throw (error)
    }

    // proceso para manejar las series
    const results = await Promise.all(vehicleSeriesAutoGermana.map(
      throat(1, async serie => {
        // valido
        if (!serie.Marca) {
          return new Error('La marca es nula')
        }

        // busco la marca
        const {Brand} = vehicleSerieParam.app.models
        let brandInstance
        try {
          brandInstance = await Brand.findOne({where: {code: serie.Marca.trim()}})
        } catch (error) {
          throw error
        }

        // valido
        if (!brandInstance) {
          return new Error(`La marca con el codigo ${serie.Marca}, no existe.`)
        }

        // defino el objeto
        const serieObject = {
          name: serie.Serie,
          brandId: brandInstance.id
        }

        // encuentro o creo la serie
        let serieResult
        try {
          serieResult = await vehicleSerieParam.findOrCreate({where: serieObject}, serieObject)
        } catch (error) {
          return error
        }

        let serieInstance = serieResult[0]

        return serieInstance
      })
    ))

    const instances = results.filter(item => !(item instanceof Error))
    const errors = results.filter(item => item instanceof Error).map(item => item.message)

    return {
      processed: instances.length,
      errors
    }
  }
  vehicleSerieParam.remoteMethod('handleSeriesAutogermana', {
    http: {
      verb: 'post',
      path: '/handle-series-autogermana'
    },
    returns: {
      arg: 'data',
      type: 'Object',
      root: true
    }
  })
}
