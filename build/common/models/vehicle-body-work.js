import * as autogermanaIntegration from '../../integrations/autogermana'
import throat from 'throat'

export default function (vehicleBodyWork) {
  const vehicleBodyWorkParam = vehicleBodyWork

  vehicleBodyWorkParam.handleVehicleBodyWorksAutoGermana = async () => {
    let vehicleBodyWorksFromAG
    try {
      vehicleBodyWorksFromAG = await autogermanaIntegration.getBodyWorks()
    } catch (error) {
      throw error
    }

    // resuelvo las
    const results = await Promise.all(vehicleBodyWorksFromAG.map(
      throat(1, async vehicleBodyWork => {
        // creo el objeto
        const vehicleBodyWorkObj = {
          name: vehicleBodyWork.Carroceria
        }

        // creo la instancia
        let vehicleBodyWorkInstance
        try {
          vehicleBodyWorkInstance = await vehicleBodyWorkParam.findOrCreate({where: vehicleBodyWorkObj}, vehicleBodyWorkObj)
        } catch (error) {
          return error
        }

        return vehicleBodyWorkInstance
      })
    ))

    const instances = results.map(item => item[0]).filter(item => !(item instanceof Error))
    const errors = results.filter(item => item instanceof Error)
    return {
      processed: instances.length,
      errors
    }
  }
  vehicleBodyWorkParam.remoteMethod('handleVehicleBodyWorksAutoGermana', {
    http: {
      verb: 'post',
      path: '/handle-vehicle-body-works-auto-germana'
    },
    returns: {
      arg: 'data',
      type: 'Object',
      root: true
    }
  })
}
