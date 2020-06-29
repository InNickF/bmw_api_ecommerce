import dotenv from 'dotenv'
import Consumer from 'sqs-consumer'
import { AmazonWebServices } from '../server/services/aws'
import path from 'path'
import getParameterValue from '../server/functions/get-parameter-value'
import * as app from '../server/server'
import registerLog from '../server/functions/register-log'

const pathEnv = path.resolve(__dirname, '../.env')

dotenv.config({
  path: pathEnv
})

// obtengo las variables necesaria para amazon
const awsRegion = process.env.AWS_REGION
const awsAccessKeyId = process.env.AWS_SQS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SQS_SECRET_ACCESS_KEY

// creo la instancia de amazon
const awsInstance = new AmazonWebServices(awsRegion, awsAccessKeyId, awsSecretAccessKey)

const awsQueueName = process.env.AWS_QUEUE_NAME
awsInstance.getQueueUrl(awsQueueName)
  .then(url => {
    console.log('Consumer ready')
    const consumer = Consumer.create({
      queueUrl: url,
      handleMessage: async (message, done) => {
        const { MessageId: messageId, Body } = message
        console.log('message', messageId)
        const parsedBody = JSON.parse(Body)

        // obtengo el codigo del proceso
        let parameterName = 'PROCESO_FILL_AG'
        let processFA
        try {
          processFA = await getParameterValue(parameterName)
        } catch (error) {
          throw error
        }

        const { process } = parsedBody

        switch (process) {
          case processFA:
            let response

            // gestiono las series
            const { VehicleSerie } = app.models
            try {
              response = await VehicleSerie.handleSeriesAutogermana()
            } catch (error) {
              throw error
            }

            try {
              await registerLog(processFA, `VehicleSerie: ${JSON.stringify(response)}`, messageId, false)
            } catch (error) {
              throw error
            }

            // gestiono los modelos
            const { VehicleModel } = app.models
            try {
              response = await VehicleModel.handleModelsAutogermana()
            } catch (error) {
              throw error
            }

            try {
              await registerLog(processFA, `VehicleModel: ${JSON.stringify(response)}`, messageId, false)
            } catch (error) {
              throw error
            }

            // gestiono las carrocerias
            const { VehicleBodyWork } = app.models
            try {
              response = await VehicleBodyWork.handleVehicleBodyWorksAutoGermana()
            } catch (error) {
              throw error
            }

            try {
              await registerLog(processFA, `VehicleBodyWork: ${JSON.stringify(response)}`, messageId, false)
            } catch (error) {
              throw error
            }

            // gestiono las categorias
            const { ProductCategory } = app.models
            try {
              /* response = await ProductCategory.handleCategoriesAutogermana() */
            } catch (error) {
              throw error
            }

            try {
              await registerLog(processFA, `ProductCategory: ${JSON.stringify(response)}`, messageId, false)
            } catch (error) {
              throw error
            }

            // gestiono las marcas de los vehiculos
            const { VehicleBrand } = app.models
            try {
              /* response = await VehicleBrand.handleVehicleBrandsAutoGermana() */
            } catch (error) {
              throw error
            }

            try {
              await registerLog(processFA, `VehicleBrand: ${JSON.stringify(response)}`, messageId, false)
            } catch (error) {
              throw error
            }

            const { SkuVariation } = app.models
            try {
              // response = await SkuVariation.deleteAll({})
              console.log("borro")
              response = await SkuVariation.destroyAll()
            } catch (error) {
              throw error
            }

            try {
              await registerLog(processFA, `SkuVarition: ${JSON.stringify(response)}`, messageId, false)
            } catch (error) {
              throw error
            }

            // gestiono los productos, variaciones y tiendas
            const { Product } = app.models
            try {
              /* response = await Product.handleProductsAutogermana(0) */
            } catch (error) {
              throw error
            }

            try {
              /* await registerLog(processFA, `Product: ${JSON.stringify(response)}`, messageId, false) */
            } catch (error) {
              throw error
            }
            done()
            break
          default:
            break
        }
      },
      sqs: new awsInstance.AWS.SQS()
    })
    consumer.on('error', (err) => {
      console.log(err.message)
    })
    consumer.start()
  })
  .catch(err => {
    console.log(err)
  })
