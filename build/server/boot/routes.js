import path from 'path'
import * as Util from '../utils'
import { uploadFile } from '../functions/upload-file'
import bodyParser from 'body-parser'
import { AmazonWebServices } from '../services/aws'
import getParameterValue from '../functions/get-parameter-value'
import { obtenerValorGrabarRemesa, obtenerCosultarInformacion } from '../../integrations/tcc'
import { generateHtmlByEmailtemplate } from '../../server/functions/generate-html-by-email-template'
import { Mailer } from '../../server/services/mailer'
// import moment from 'moment'
import moment from 'moment-timezone'
import * as autogermanaIntegration from '../../integrations/autogermana'
moment.tz('America/Bogota')
const integrationZonaPago = require('../../integrations/zona_virtual')
const idTiendaZonaVirtual = process.env.ZONA_VIRTUAL_API_ID_TIENDA
const claveZonaVirtual = process.env.ZONA_VIRTUAL_API_CLAVE
const passTcc = process.env.PASSW_TCC
const emailIncadeaError = process.env.EMAIL_INCADEA_ERROR
import { incadeaError, smsOrderOnRoute, smsOrderDelivered } from '../../integrations/mail/index';

module.exports = app => {
  app.use(
    bodyParser.json({
      limit: '100kb'
    })
  )

  // ?[model]=Article&[ids]=53&[ids]=52
/*   app.get('/destroy-all', (req, res) => {
    const model = app.models[app.models]
    req.query.ids.map((item) => {
      model.destroyAll({
        id: item
      })
    })
    const result = {
      message: 'Los ids fueron eliminados',
      model: req.query.model,
      ids: req.query.ids
    }
    res.send(result)
  }) */

  app.post('/api/upload', async (req, res, next) => {
    // Obtengo los attributos
    let formData

    try {
      formData = await Util.getFormData(req)
    } catch (error) {
      return next(error.message)
    }

    if (!formData.fields['path']) {
      let error = new Error('path key is missing')
      return next(error.message)
    }

    let pathToS3 = formData.fields['path']

    let locations = []
    for (const key in formData.files) {
      const file = formData.files[key]
      let location
      try {
        location = await uploadFile(file.path, `${pathToS3}/${file.name}`)
      } catch (error) {
        return next(error.message)
      }

      locations.push(location)
    }
    return res.status(200).send(locations)
  })

  app.get('/payment-confirmation', (req, res) => {
    return res.sendFile(path.join(__dirname, '../../views/payment-confirmation/index.html'))
  })
  app.get('/sorry-page', (req, res) => {
    return res.sendFile(path.join(__dirname, '../../views/sorry-page/index.html'))
  })

  //  SINCRONIZACION DE PRODUCTOS CRON JOB

  app.post('/api/fill-from-autogermana', async (req, res, next) => {
    req.setTimeout(0)

    // obtengo las variables necesaria para amazon
    const awsRegion = process.env.AWS_REGION
    const awsAccessKeyId = process.env.AWS_SQS_ACCESS_KEY_ID
    const awsSecretAccessKey = process.env.AWS_SQS_SECRET_ACCESS_KEY

    // creo la instancia de amazon
    const awsInstance = new AmazonWebServices(awsRegion, awsAccessKeyId, awsSecretAccessKey)

    // Obtengo la url del queue
    const awsQueueName = process.env.AWS_QUEUE_NAME
    let queueUrl
    try {
      queueUrl = await awsInstance.getQueueUrl(awsQueueName)
      console.log(queueUrl)
    } catch (error) {
      return next(error)
    }

    // obtengo el codigo del proceso
    let parameterName = 'PROCESO_FILL_AG'
    let processFA
    try {
      processFA = await getParameterValue(parameterName)
    } catch (error) {
      return next(error)
    }

    // armo el objeto para el mensaje
    const objMessage = {
      process: processFA,
      data: {}
    }

    // armo el string value
    const message = JSON.stringify(objMessage)

    // armo los parametros para la creacion del mensaje
    const params = {
      QueueUrl: queueUrl,
      MessageBody: message
    }

    // creo el mensaje
    let messageId
    try {
      messageId = await awsInstance.sendMessage(params)
    } catch (error) {
      return next(error)
    }

    return res.status(200).send(messageId)
  })

  // -----------------------------------------------------------------------

  app.get('/api/order-tracking', async (req, res, next) => {
    req.setTimeout(0)
    console.log('-------------------- order-tracking started ------------------------')

    let countMessagesSended = 0
    let countOrdersStatusUpdated = 0
    let ordersWasUpdatedToCancelled = 0
    // obtengo los codigos para consultar los estados
    const parameterName = 'CODIGOS_ESTADOS_ORDEN_TRACKING'
    let codesOrderStaus
    try {
      codesOrderStaus = await getParameterValue(parameterName)
      codesOrderStaus = codesOrderStaus.split(',')
    } catch (error) {
      return next(error)
    }

    // obtengo los ids de los estados de la orden
    const { OrderStatus } = app.models
    let orderStatusIds
    try {
      orderStatusIds = await OrderStatus.find({ fields: { id: true }, where: { code: { inq: codesOrderStaus } } })
      orderStatusIds = orderStatusIds.map(item => item.id)
    } catch (error) {
      return next(error)
    }

    const { Order } = app.models
    let ordersToValidate
    try {
      ordersToValidate = await Order.find({ where: { orderStatusId: { inq: orderStatusIds } } })
    } catch (error) {
      return next(error)
    }

    let minDaysToCancelOrderOnTCCError;
    let statusCancelledId;
    try {
      const { Config } = app.models;
      const configKey = 'MIN_DAYS_TO_CANCEL_ORDER_ON_TCC_ERROR';
      const minDaysConfig = await Config.findOne({ where: { key: configKey } });
      minDaysToCancelOrderOnTCCError = minDaysConfig ? JSON.parse(minDaysConfig.value) : null;
      minDaysToCancelOrderOnTCCError = minDaysToCancelOrderOnTCCError ? minDaysToCancelOrderOnTCCError.minDays : -10;
      const statusCancelled = await OrderStatus.findOne({ where: { code: 'CANCELADA' } })
      statusCancelledId = statusCancelled.id
    } catch (error) {
      return error
    }

    const results = await Promise.all(ordersToValidate.map(async order => {
      // valido
      if (!order.delivery || order.delivery === '0') {
        return new Error(`La orden ${order.id}, no tiene delivery`)
      }

      // obtengo el estado de la orden
      let orderStatusFromOrder
      try {
        orderStatusFromOrder = await order.orderStatus.get()
      } catch (error) {
        return error
      }

      // valido
      if (!orderStatusFromOrder) {
        return new Error(`La orden ${order.id}, no cuenta con estado`)
      }

      let orderDetailInstances = null
      try {
        orderDetailInstances = await order.orderDetails.find()
      } catch (error) {
        throw error
      }

      // valido
      if (!orderDetailInstances) {
        throw new Error(`La orden con id ${order.id}, no existe detalles`)
      }

      const productsVolumes = await Promise.all(orderDetailInstances.map(async (item) => {
        let product = null
        try {
          product = await item.product.get()
        } catch (error) {
          throw error
        }
        return product
      }))

      const weightVolume = productsVolumes.map(item => {
        return item ? item.weightVolume : 0
      }).reduce((pre, cur) => pre + cur, 0)
      const weightVolumeK = weightVolume / 1000.0

      let unidadDeNEgocio = null
      if (weightVolumeK < 5.1 && order.total <= 3511208) {
        unidadDeNEgocio = 2
      } else if (weightVolumeK >= 5.1) {
        unidadDeNEgocio = 1
      } else {
        unidadDeNEgocio = 1
      }

      const parameters = {
        RemesaUEN: {
          numeroremesa: order.delivery,
          unidadnegocio: unidadDeNEgocio
        }
      }

      // consulto la informacion de la remesa
      let response
      try {
        response = await obtenerCosultarInformacion(parameters)
      } catch (error) {
        return error
      }

      const { Respuesta = undefined, Mensaje } = response

      // valido
      if (Respuesta === undefined) {
        return new Error('No se puede obtener Respuesta de TCC.')
      }

      // valido
      if (Respuesta === -99) {
        return new Error(Mensaje)
      }

      // obtengo el estado de tcc
      let tccStatus;
      let difference;
      try {
        const arrayLength = response.remesasrespuesta.RemesaEstados[0].listaestados.Estado.length
        tccStatus = response.remesasrespuesta.RemesaEstados[0].listaestados.Estado[arrayLength - 1].codigo
      } catch (error) {
        let wasUpdated = false;
        if (order.sendDate) {
          // Verify if we need to updated to cancelled this order
          let sendDate = moment(order.sendDate, "YYYY-MM-DD HH:mm:ss");
          let today = moment().format("YYYY-MM-DD HH:mm:ss");
          difference = sendDate.diff(today, "days");
          if (difference < minDaysToCancelOrderOnTCCError) {
            ordersWasUpdatedToCancelled += 1
            console.log(difference);
            await order.updateAttributes({ orderStatusId: statusCancelledId })
            console.log('---------------- Order updated to status cancelled ----------------')
            console.log(order.id)
            console.log('--------------------------------------------------------------------')
            wasUpdated = true
          }
        }

        return new Error(`Order: ${order.id}
         Error:
         ${error}
         Response by TCC:
         ${JSON.stringify(response)}
         Parameters: ${JSON.stringify(parameters)}
         ${wasUpdated ? 'This order was updated to status cancelled' : 'This order was not updated to status cancelled'}
         ${difference ? `Difference after send day is: ${difference}` : `This order don't have send date.`}
         `)
      }

      // obtengo los estados de las ordenes para validar
      let orderStatusesToValidate = []
      try {
        orderStatusesToValidate = await OrderStatus.find({ where: { tccIdentifier: { neq: null } } })
      } catch (error) {
        throw error
      }

      // obtengo el estado para actualizar la orden
      let orderStatusToUpdate
      for (const orderStatus of orderStatusesToValidate) {
        const tccStatuses = orderStatus.tccIdentifier.split('|')
        if (tccStatuses.includes(tccStatus)) {
          orderStatusToUpdate = orderStatus
          break
        }
      }

      // valido
      if (!orderStatusToUpdate) {
        return new Error(`Para la orden ${order.id}-${order.delivery}, El estado de TCC ${tccStatus}, no se encuentra controlado`)
      }

      if (orderStatusToUpdate.id === 6 && order.orderStatusId !== 6) {
        let userInstance = null
        try {
          userInstance = await order.user.get()
        } catch (error) {
          throw error
        }

        const smsOrderOnRouteEventName = (brandId) => {
          switch (brandId) {
            case 1:
              return "sms_numero_guia_motorrad";

            case 2:
              return "sms_numero_guia_mini";

            case 3:
              return "sms_numero_guia_bmw";
          }
        }

        const smsOrderOnRouteData = {
          email: userInstance.email,
          eventName: smsOrderOnRouteEventName(userInstance.brandId),
          attributes: {
            email: userInstance.email,
            smsGuideNumber: order.delivery
          }
        };
        // try {
          // console.log(await smsOrderOnRoute(smsOrderOnRouteData))
        // } catch (error) {
          // console.log(error)
        // }
        countMessagesSended += 1
        console.log('------------------ SMS order on Route ------------------------------')
        console.log(order.id)
        console.log('--------------------------------------------------------------------')

      }

      if (orderStatusToUpdate.id === 7 && order.orderStatusId !== 7) {
        let userInstance = null
        try {
          userInstance = await order.user.get()
        } catch (error) {
          throw error
        }

        const smsOrderDeliveredEventName = (brandId) => {
          switch (brandId) {
            case 1:
              return "encuesta_motorrad";

            case 2:
              return "encuesta_bmw";

            case 3:
              return "encuesta_bmw";
          }
        }

        const smsOrderDeliveredData = {
          email: userInstance.email,
          eventName: smsOrderDeliveredEventName(userInstance.brandId),
          attributes: {
            email: userInstance.email,
          }
        };
        // try {
          // console.log(await smsOrderDelivered(smsOrderDeliveredData))
        // } catch (error) {
          // console.log(error)
        // }
        countMessagesSended += 1
        console.log('------------------ SMS order delivered -----------------------------')
        console.log(order.id)
        console.log('--------------------------------------------------------------------')
      }

      // actualizo el estado de la orden
      if (orderStatusToUpdate.id !== order.orderStatusId) {
        try {
          await order.updateAttributes({ orderStatusId: orderStatusToUpdate.id })
          countOrdersStatusUpdated += 1
          console.log('--------------------- Order status updated -------------------------')
          console.log(order.id)
          console.log(orderStatusToUpdate.code)
          console.log('--------------------------------------------------------------------')
        } catch (error) {
          return error
        }
      }
      return order
    }))

    const instances = results.filter(item => !(item instanceof Error)).map(item => item.id)
    const errors = results.filter(item => item instanceof Error).map(error => error.message)

    const response = {
      messagesStatus: countMessagesSended ? `${countMessagesSended} message(s) was sended` : 'No messages were sent',
      ordersStatus: countOrdersStatusUpdated ? `${countOrdersStatusUpdated} order(s) status was updated` : 'No orders status were update',
      orderStatusUpdatedToCancelled: ordersWasUpdatedToCancelled ? `${ordersWasUpdatedToCancelled} order(s) was updated to cancelled` : 'No orders were updated to status cancelled',
      ordersProcessed: instances ? instances : 'No orders were processed',
      errorsQuantity: errors.length,
      errors: errors ? errors : 'No errors were throw'
    }

    countMessagesSended ? console.log(`${countMessagesSended} message(s) was sended`) : console.log('Any message was sended')
    countOrdersStatusUpdated ? console.log(`${countOrdersStatusUpdated} order(s) status was updated`) : console.log('Any order status was updated')
    console.log('-------------------- order-tracking finished -----------------------')
    return res.status(200).send(response)
  })

  app.put('/api/order-payments', async (req, res, next) => {
    req.setTimeout(0)

    // obtengo los codigos para consultar los estados
    const parameterName = 'CODIGOS_ESTADOS_ORDEN_PENDIENTE'
    let codesOrderStaus
    try {
      codesOrderStaus = await getParameterValue(parameterName)
      codesOrderStaus = codesOrderStaus.split(',')
    } catch (error) {
      return next(error)
    }

    // obtengo los ids de los estados de la orden
    const { OrderStatus } = app.models
    let orderStatusIds
    try {
      orderStatusIds = await OrderStatus.find({ fields: { id: true }, where: { code: { inq: codesOrderStaus } } })
      orderStatusIds = orderStatusIds.map(item => item.id)
    } catch (error) {
      return next(error)
    }

    // Busco las ordenes con este estado
    const { Order } = app.models
    const minuteOrder = moment().subtract(7, 'minute')
    let ordersToValidate
    try {
      ordersToValidate = await Order.find({ where: { orderStatusId: { inq: orderStatusIds }, updatedAt: { lt: minuteOrder } } })
    } catch (error) {
      return next(error)
    }

    // Proceso las ordenes
    await Promise.all(ordersToValidate.map(async order => {
      // obtengo el estado de la orden
      let orderStatusFromOrder
      try {
        orderStatusFromOrder = await order.orderStatus.get()
      } catch (error) {
        return error
      }

      // valido
      if (!orderStatusFromOrder) {
        return new Error(`La orden ${order.id}, no cuenta con estado`)
      }

      let paymentsOrder
      try {
        paymentsOrder = await order.payments.find()
      } catch (error) {
        return error
      }

      // valido
      if (!paymentsOrder || paymentsOrder.length === 0) {
        return new Error(`La orden ${order.id}, no tiene pagos iniciados`)
      }

      const payments = paymentsOrder[paymentsOrder.length - 1]

      // console.log(`Numero orden: ${order.id} con estado ${orderStatusFromOrder.name} con pagos: ${paymentsOrder.length} orden:  ${payments.uuid}`)

      let parametersVerificarPago = {
        str_id_pago: payments.uuid,
        int_id_tienda: idTiendaZonaVirtual,
        str_id_clave: claveZonaVirtual
      }

      // Verifico el pago
      let response
      try {
        response = await integrationZonaPago.verificarPago(parametersVerificarPago)
      } catch (error) {
        throw error
      }

      // valido
      if (!response) {
        return new Error('No se puede obtener Respuesta de zona virtual.')
      }

      if (response.Contador_Pagos !== 0) {
        // obtengo los estados de las ordenes para validar
        let orderStatusesToValidate = []
        try {
          orderStatusesToValidate = await OrderStatus.find({ where: { paymentPlatformCode: { neq: null } } })
        } catch (error) {
          throw error
        }

        const estadoPago = response.res_pagos_v3[0].int_estado_pago
        const transactionCode = response.res_pagos_v3[0].str_codigo_transaccion

        // obtengo el estado para actualizar la orden
        let orderStatusToUpdate
        for (const orderStatus of orderStatusesToValidate) {
          const codeStatuses = orderStatus.paymentPlatformCode.split('|')
          if (codeStatuses.includes(estadoPago.toString())) {
            orderStatusToUpdate = orderStatus
            break
          }
        }

        // valido
        if (!orderStatusToUpdate) {
          return new Error(`El estado con codigo ${response.res_pagos_v3[0].int_estado_pago}, no existe`)
        }

        if (orderStatusToUpdate.code === 'PAGO_APROBADO') {
          let orderDetails = []
          try {
            orderDetails = await order.orderDetails.find()
          } catch (error) {
            throw error
          }

          // obtengo el usuario de la orden
          let userInstance
          try {
            userInstance = await order.user.get()
          } catch (error) {
            throw error
          }

          // obtengo la direccion de la orden
          let addressInstance
          try {
            addressInstance = await order.address.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!addressInstance) {
            throw new Error('La dirección de la orden, no existe.')
          }

          // Obtengo la ciudad de la dirección
          let cityInstance
          try {
            cityInstance = await addressInstance.city.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!cityInstance) {
            throw new Error('La ciudad de la direccion no existe.')
          }

          // obtengo el estado del pago verificado
          let idClientePagoVerificado = response.res_pagos_v3[0].str_id_cliente
          let valorPagoVerificado = response.res_pagos_v3[0].dbl_valor_pagado

          // valido
          if (order.total !== valorPagoVerificado) {
            throw new Error('El total a pagar de la orden no es igual al del la confirmado')
          }

          if (userInstance.identification !== idClientePagoVerificado) {
            throw new Error('La identificación del usuario no es igual a la del pago confirmado')
          }

          if (orderStatusToUpdate.code !== 'PAGO_APROBADO') {
            throw new Error('La orden no fue aprobada')
          }

          const productInstances = []
          for (const orderDetailInstance of orderDetails) {
            let productInstance
            try {
              productInstance = await orderDetailInstance.product.get()
              productInstance.quantity = orderDetailInstance.quantity
            } catch (error) {
              throw error
            }

            // obtengo la image
            let imageInstance = []
            try {
              imageInstance = await productInstance.imageProducts.find()
            } catch (error) {
              throw error
            }

            let skuVariations = []
            try {
              skuVariations = await productInstance.skuVariations.find()
            } catch (error) {
              throw error
            }

            let skuChildrenVariations
            try {
              skuChildrenVariations = await productInstance.skuChildren.get()
            } catch (error) {
              throw error
            }

            productInstance.isLifeStyle = false
            if (skuVariations.length > 0) {
              productInstance.isLifeStyle = true
              productInstance.color = skuVariations[0] ? skuVariations[0].color : skuChildrenVariations.color
              productInstance.size = skuVariations[0] ? skuVariations[0].size : skuChildrenVariations.size
            }

            if (imageInstance.length < 1) {
              productInstance.imageUrl = 'https://autogermana.s3.amazonaws.com/no%20-foto.png'
            } else {
              productInstance.imageUrl = imageInstance[0].image
            }
            productInstances.push(productInstance)
          }

          let codeCoupon
          try {
            codeCoupon = await order.codeCoupon.get()
          } catch (error) {
            throw error
          }

          const productsToIncadea = productInstances.map(product => (
            {
              id: product.id,
              sku: product.sku,
              name: product.name,
              storeId: order.storeId,
              storeName: 'ECOMM-BO',
              quantity: product.quantity,
              priceWithTax: order.codeCouponId ? codeCoupon.isPercentage ? product.priceWithTax - ((product.priceWithTax * codeCoupon.value) / 100) : product.priceWithTax : product.priceWithTax,
              priceWithoutTax: order.codeCouponId ? codeCoupon.isPercentage ? product.priceWithoutTax - ((product.priceWithoutTax * codeCoupon.value) / 100) : product.priceWithoutTax : product.priceWithoutTax,
              imageUrl: product.imageUrl,
              price: product.priceWithTax - (product.priceWithTax - product.priceWithoutTax),
              color: product.color,
              size: product.size,
              isLifeStyle: product.isLifeStyle
            })
          )

          // Precio del servicio tcc
          productsToIncadea.push({
            id: 1,
            sku: '280505001',
            name: 'Envio Ecommerce',
            storeId: 1,
            storeName: 'ECOMM-BO',
            quantity: 1,
            priceWithTax: order.priceDelivery,
            priceWithoutTax: order.priceDelivery,
            imageUrl: 'tcc.png'
          })

          if (order.codeCouponId) {
            if (!codeCoupon.isPercentage) {
              productsToIncadea.push({
                id: 1,
                sku: '280505001',
                name: 'Coupon de descuento',
                storeId: 1,
                storeName: 'ECOMM-BO',
                quantity: 1,
                priceWithTax: codeCoupon.value * -1,
                priceWithoutTax: codeCoupon.value * -1,
                imageUrl: 'zv.png'
              })
            }
          }

          const incadeOrderObj = {
            id: order.id,
            docType: 0,
            identification: userInstance.identification,
            firstName: userInstance.firstName,
            lastName: userInstance.lastName,
            city: cityInstance.name,
            address: addressInstance.value,
            phone: addressInstance.phone,
            email: userInstance.email,
            total: order.total,
            producto: productsToIncadea
          }

          // Envio orden a incadea
          console.log('Confirmacion de pago solo si no tiene antes de generar incadea')
          console.log(order)

          let incadeaOrder
          if (order.incadeaOrderId === '0' && order.delivery === '0') {
            console.log('--------------Entro aqui---------------------')
            try {
              incadeaOrder = await autogermanaIntegration.createdOrder(incadeOrderObj)
            } catch (error) {
              throw (error)
            }
            console.log(incadeaOrder)

            if (incadeaOrder) {
              // actualizo el estado de la orden a aprobado, dismunuyo la intencion de compra y el inventario
              try {
                await order.updateAttributes({ orderStatusId: orderStatusToUpdate.id, incadeaOrderId: incadeaOrder.respuesta_TSQL, sendDate: moment().tz('America/Bogota').format('YYYY-MM-DD'), transactionCode: transactionCode })
              } catch (error) {
                return error
              }
            }
          }

          // valido
          if (!order) {
            throw new Error(`La orden con id ${order.id}, no existe`)
          }

          // valido
          if (!orderDetails) {
            throw new Error(`La orden con id ${order.id}, no existe detalles`)
          }

          let userInstanceTcc = null
          try {
            userInstanceTcc = await order.user.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!userInstanceTcc) {
            throw new Error(`La orden con id ${order.id}, no le pertenece a un usuario`)
          }

          let brandInstance = null
          try {
            brandInstance = await order.brand.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!brandInstance) {
            throw new Error(`La orden con id ${order.id}, no pertenece a una marca`)
          }

          let cityAddressInatance = null
          try {
            cityAddressInatance = await addressInstance.city.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!cityAddressInatance) {
            throw new Error(`La orden con id ${order.id}, no tiene una ciudad`)
          }

          let stateAddressInstance = null
          try {
            stateAddressInstance = await cityAddressInatance.state.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!stateAddressInstance) {
            throw new Error(`La ciudad de la orden con id ${order.id}, no tiene un estado`)
          }

          let storeInstance = null
          try {
            storeInstance = await order.store.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!storeInstance) {
            throw new Error(`La orden con id ${order.id}, no tiene una tienda asociada`)
          }

          let cityStoreInstance = null
          try {
            cityStoreInstance = await storeInstance.city.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!cityStoreInstance) {
            throw new Error(`La tienda de la orden con id ${order.id}, no tiene una tienda ciudad asociada`)
          }

          let stateStoreInstance = null
          try {
            stateStoreInstance = await cityStoreInstance.state.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!stateStoreInstance) {
            throw new Error(`La tienda de la orden con id ${order.id}, con la ciudad ${cityStoreInstance.name} no tiene un estado relacionado`)
          }

          const products = await Promise.all(orderDetails.map(async (item) => {
            let ProductInstanDetail = null
            try {
              ProductInstanDetail = await item.product.get()
            } catch (error) {
              throw error
            }

            const weightVolumeK = ProductInstanDetail.weightVolume / 1000.0
            // const weightVolumeK = (weightVolume / 1000.0).toFixed(2).replace(".", ",")

            let product = {
              tipounidad: 'TIPO_UND_PAQ',
              claseempaque: 'CLEM_MEDIANA',
              kilosreales: weightVolumeK, // PENDIENTE
              largo: 0,
              alto: 0,
              ancho: 0,
              pesovolumen: weightVolumeK,
              valormercancia: item.price,
              codigobarras: null,
              unidadesinternas: item.quantity // PENDIENTE
            }
            return product
          }))

          console.log(products)

          const productsVolumes = await Promise.all(orderDetails.map(async (item) => {
            let product = null
            try {
              product = await item.product.get()
            } catch (error) {
              throw error
            }
            return product
          }))

          const weightVolume = productsVolumes.map(item => item.weightVolume).reduce((pre, cur) => pre + cur, 0)

          const weightVolumeK = weightVolume / 1000.0

          let unidadDeNEgocio = null
          let cuentaAut = null
          if (weightVolumeK < 5.1 && order.total <= 1185000) {
            unidadDeNEgocio = 2
            cuentaAut = 5132001
          } else if (weightVolumeK >= 5.1 && weightVolumeK < 15.0) {
            unidadDeNEgocio = 1
            cuentaAut = 1759405
          } else {
            unidadDeNEgocio = 1
            cuentaAut = 1759405
          }

          const parameters = {
            despacho: {
              clave: passTcc,
              solicitudrecogida: {},
              unidadnegocio: unidadDeNEgocio,
              fechadespacho: moment().format('YYYY-MM-DD'),
              cuentaremitente: cuentaAut,
              tipoidentificacionremitente: 'NIT',
              identificacionremitente: 860509514,
              primernombreremitente: 'AUTOGERMANA',
              segundonombreremitente: null,
              primerapellidoremitente: null,
              razonsocialremitente: 'AUTOGERMANA',
              naturalezaremitente: 'N',
              direccionremitente: 'carrera 45 # 197-35',
              contactoremitente: null,
              emailremitente: 'johan.rios@autogermana.com.co',
              telefonoremitente: '3202572769',
              ciudadorigen: 11001000, // `${stateStoreInstance.code}${cityStoreInstance.code}000`,
              tipoidentificaciondestinatario: userInstanceTcc.docType,
              identificaciondestinatario: userInstanceTcc.identification,
              primernombredestinatario: userInstanceTcc.firstName,
              segundonombredestinatario: null,
              primerapellidodestinatario: userInstanceTcc.lastName,
              naturalezadestinatario: 'N',
              direcciondestinatario: addressInstance.value,
              contactodestinatario: 'CONTACTO DESTINO',
              telefonodestinatario: userInstanceTcc.phone,
              ciudaddestinatario: `${stateAddressInstance.code}${cityAddressInatance.code}000`,
              totalpeso: null,
              totalpesovolumen: null,
              totalvalormercancia: order.total - order.priceDelivery,
              observaciones: `Pedidos ${order.incadeaOrderId} por valor de ${order.total}`,
              // unidad: products,
              unidad: {
                tipounidad: 'TIPO_UND_PAQ',
                claseempaque: 'CLEM_MEDIANA',
                kilosreales: weightVolumeK < 1 ? 1 : weightVolumeK,
                largo: 0,
                alto: 0,
                ancho: 0,
                pesovolumen: weightVolumeK,
                valormercancia: order.total,
                codigobarras: null,
                unidadesinternas: 1
              },
              documentoreferencia: {
                tipodocumento: 'OC',
                numerodocumento: `OC-${order.id}`,
                fechadocumento: moment().format('YYYY-MM-DD')
              },
              generardocumentos: 'TRUE',
              tiposervicio: null,
              fuente: null
            }
          }

          // valido
          if (!parameters) {
            throw new Error('La peticion no contiene parametros')
          }

          // Ejecuto la integracion
          let responseTcc
          if (incadeaOrder && order.delivery === '0') {
            console.log('---- Confirmacion de pago Solo si no tiene --------------')
            console.log(order)
            try {
              responseTcc = await obtenerValorGrabarRemesa(parameters)
            } catch (error) {
              throw error
            }
            /* 
                        console.log('RespuestaTCC: ', responseTcc) */

            if (responseTcc.respuesta === '-1') {
              throw new Error(`Algo salio mal creando la remesa para el orden ${order.id}, en TCC.`)
            }

            // actualizo el estado de la orden a aprobado, dismunuyo la intencion de compra y el inventario
            try {
              // await order.updateAttributes({ orderStatusId: orderStatusToUpdate.id, incadeaOrderId: incadeaOrder.respuesta_TSQL, delivery: responseTcc.remesa, transactionCode: transactionCode })
              await order.updateAttributes({ delivery: responseTcc.remesa })
            } catch (error) {
              return error
            }

            if (incadeaOrder.respuesta_TSQL.split('-')[0] !== 'PVRE') {
              const parametersEmailIncadea = {
                user: userInstance,
                order: order
              }

              const eventName = (brandId) => {
                switch (brandId) {
                  case 1:
                    return 'autorespuesta_motorrad_3_incadea_error'

                  case 2:
                    return 'autorespuesta_mini_3_incadea_error'

                  case 3:
                    return 'autorespuesta_bmw_3_incadea_error'
                }
              }

              const data = {
                email: userInstance.email,
                eventName: eventName(userInstance.brandId),
                attributes: {
                  nCompra: order.uuid,
                  orderIncadeaID: order.incadeaOrderId
                }
              }

              await incadeaError(data)

              // const htmlIncadea = generateHtmlByEmailtemplate('incadea-error', parametersEmailIncadea)

              // // send the email
              // const mailerObject = new Mailer()
              // try {
              //   await mailerObject.sendMail([emailIncadeaError], htmlIncadea, 'Error creación pedido')
              // } catch (error) {
              //   throw error
              // }
            }

            productsToIncadea.splice(productsToIncadea.length - 1)
            if (codeCoupon) {
              if (!codeCoupon.isPercentage) {
                productsToIncadea.splice(productsToIncadea.length - 1)
              }
            }

            const { priceFormatter } = Util

            const parametersTcc = {
              user: userInstance,
              order: {
                ...order,
                delivery: order.delivery,
                id: order.id,
                subtotal: priceFormatter(order.subtotal),
                taxes: priceFormatter(order.taxes),
                priceDelivery: priceFormatter(order.priceDelivery),
                total: priceFormatter(order.total)
              },
              products: productsToIncadea.map(item => ({
                ...item,
                price: priceFormatter(item.price)
              })),
              address: addressInstance,
              city: cityInstance,
              discoun: { value: priceFormatter(codeCoupon ? codeCoupon.isPercentage ? (order.subtotal * codeCoupon.value / (100 - codeCoupon.value)) * -1 : codeCoupon.value : 0) }
            }

            const html = generateHtmlByEmailtemplate('order-succes', parametersTcc)

            // send the email
            const mailerObject = new Mailer()
            try {
              await mailerObject.sendMail([userInstance.email], html, 'Gracias por su compra!')
            } catch (error) {
              throw error
            }
          }

          // descuento el stock de los productos
          for (const detailInOrder of orderDetails) {
            // obtengo el producto asociado al detalle
            let productInstance
            try {
              productInstance = await detailInOrder.product.get()
            } catch (error) {
              throw error
            }

            // actualizo el producto
            try {
              await productInstance.updateAttributes({ stock: productInstance.stock - detailInOrder.quantity, intent: productInstance.intent - detailInOrder.quantity })
            } catch (error) {
              throw error
            }
          }
          // Y luego creo la orden en incadea, hago el descuento, acualizo intencion de compra y creo la orden en tcc
        } else if (orderStatusToUpdate.code === 'RECHAZADA') {
          let orderDetails = []
          try {
            orderDetails = await order.orderDetails.find()
          } catch (error) {
            throw error
          }

          // obtengo los productos asociados a cada detalle
          for (const orderDetailInstance of orderDetails) {
            let productInstance
            try {
              productInstance = await orderDetailInstance.product.get()
              productInstance.quantity = orderDetailInstance.quantity
            } catch (error) {
              throw error
            }

            // Actualizo intencion de compra
            try {
              await productInstance.updateAttributes({ intent: productInstance.intent - productInstance.quantity })
            } catch (error) {
              return error
            }
          }

          // valido
          if (orderDetails.length < 1) {
            throw new Error(`La orden ${order.id}, no tiene detalles.`)
          }

          // actualizo el estado de la orden a rechazado y aumento la intencion de compra
          try {
            await order.updateAttributes({ orderStatusId: orderStatusToUpdate.id }) // Rechazado - orderStatusToUpdate.id
          } catch (error) {
            return error
          }
        } else if (orderStatusToUpdate.code === 'CREADA') {
          // actualizo el estado de la orden a creada Y No afecta inventario pero si la intencion de compra

          let orderDetailInstances = null
          try {
            orderDetailInstances = await order.orderDetails.find()
          } catch (error) {
            throw error
          }

          // valido
          if (!orderDetailInstances) {
            throw new Error(`La orden con id ${order.id}, no existe detalles`)
          }

          for (const detailInOrder of orderDetailInstances) {
            // obtengo el producto asociado al detalle
            let productInstance
            try {
              productInstance = await detailInOrder.product.get()
            } catch (error) {
              throw error
            }
            // actualizo el producto
            try {
              await productInstance.updateAttributes({ intent: productInstance.intent - detailInOrder.quantity })
            } catch (error) {
              throw error
            }
          }

          try {
            await order.updateAttributes({ orderStatusId: orderStatusToUpdate.id }) // Creada
          } catch (error) {
            return error
          }
        } else {
          // El estado continua con el mismo estado y no afecta inventario ni intencion
          try {
            await order.updateAttributes({ orderStatusId: orderStatusToUpdate.id }) // Pendiente
          } catch (error) {
            return error
          }
        }
      } else {
        // Caso en que la orden no se genera en zona virtual y no se pueda consultar el estado
        let paymentStatus
        try {
          paymentStatus = await OrderStatus.findOne(
            { where: { code: 'CREADA' } }
          )
        } catch (error) {
          return next(error)
        }

        // No afecta intencion de compra ni inventario, sigue igual
        try {
          await order.updateAttributes({ orderStatusId: paymentStatus.id }) // Creada
        } catch (error) {
          return error
        }
      }

      return true
    }))

    // Parametros con estados pagos pendientes
    console.log(codesOrderStaus)
    // Id de pagos pendientes
    console.log('Id de pagos pendientes: ', orderStatusIds)
    // Ordenes con pagos pendientes
    console.log('Ordenes con pagos pendientes: ', ordersToValidate.length)
    return res.status(200).send(ordersToValidate)
  })

  app.put('/api/birthday', async (req, res, next) => {
    req.setTimeout(0)

    // obtengo todos los usuarios
    const { MyUser } = app.models
    let users = []
    try {
      users = await MyUser.find()
    } catch (error) {
      return next(error)
    }

    await Promise.all(users.map(async user => {
      if (user.birth) {
        if (moment(user.birth).format('MM-DD') === moment().format('MM-DD')) {
          let url = {}
          try {
            if (user.brandId === 1) {
              url.url = 'https://bmwmotorradshop.com.co'
            } else if (user.brandId === 2) {
              url.url = 'https://bmwshop.com.co'
            } else if (user.brandId === 3) {
              url.url = 'https://minishop.com.co'
            }
          } catch (error) {
            throw error
          }

          const parametersEmailIncadea = {
            user: user,
            url: url
          }
          const htmlIncadea = generateHtmlByEmailtemplate('birthday', parametersEmailIncadea)

          // send the email
          const mailerObject = new Mailer()
          try {
            await mailerObject.sendMail([user.email], htmlIncadea, 'Feliz cumple!')
          } catch (error) {
            throw error
          }
        } else if (moment(user.birth).format('MM-DD') === moment().add(8, 'days').format('MM-DD')) {
          const parametersEmailIncadea = {
            user: user
          }

          const htmlIncadea = generateHtmlByEmailtemplate('birthday-before', parametersEmailIncadea)
          // send the email
          const mailerObject = new Mailer()
          try {
            await mailerObject.sendMail([user.email], htmlIncadea, 'Pre cumple!')
          } catch (error) {
            throw error
          }
        }
      }
    }))

    const response = {
      processed: users.length
    }

    return res.status(200).send(response)
  })

  app.put('/api/order-rejected', async (req, res, next) => {
    req.setTimeout(0)

    // obtengo los codigos para consultar los estados
    const parameterName = 'CODIGOS_ESTADOS_ORDEN_RECHAZADAS'
    let codesOrderStaus
    try {
      codesOrderStaus = await getParameterValue(parameterName)
      codesOrderStaus = codesOrderStaus.split(',')
    } catch (error) {
      return next(error)
    }

    // obtengo los ids de los estados de la orden
    const { OrderStatus } = app.models
    let orderStatusIds
    try {
      orderStatusIds = await OrderStatus.find({ fields: { id: true }, where: { code: { inq: codesOrderStaus } } })
      orderStatusIds = orderStatusIds.map(item => item.id)
    } catch (error) {
      return next(error)
    }

    // Busco las ordenes con este estado
    const { Order } = app.models
    let ordersToValidate
    try {
      ordersToValidate = await Order.find({ where: { orderStatusId: { inq: orderStatusIds } } })
    } catch (error) {
      return next(error)
    }

    await Promise.all(ordersToValidate.map(async order => {
      // obtengo el estado de la orden
      let orderStatusFromOrder
      try {
        orderStatusFromOrder = await order.orderStatus.get()
      } catch (error) {
        return error
      }

      // valido
      if (!orderStatusFromOrder) {
        return new Error(`La orden ${order.id}, no cuenta con estado`)
      }

      let paymentsOrder
      try {
        paymentsOrder = await order.payments.find()
      } catch (error) {
        return error
      }

      // valido
      if (!paymentsOrder || paymentsOrder.length === 0) {
        return new Error(`La orden ${order.id}, no tiene pagos iniciados`)
      }

      const payments = paymentsOrder[paymentsOrder.length - 1]

      let parametersVerificarPago = {
        str_id_pago: payments.uuid,
        int_id_tienda: idTiendaZonaVirtual,
        str_id_clave: claveZonaVirtual
      }

      // Verifico el pago
      let response
      try {
        response = await integrationZonaPago.verificarPago(parametersVerificarPago)
      } catch (error) {
        throw error
      }

      // valido
      if (!response) {
        return new Error('No se puede obtener Respuesta de zona virtual.')
      }

      if (response.Contador_Pagos !== 0) {
        // obtengo los estados de las ordenes para validar
        let orderStatusesToValidate = []
        try {
          orderStatusesToValidate = await OrderStatus.find({ where: { paymentPlatformCode: { neq: null } } })
        } catch (error) {
          throw error
        }

        const estadoPago = response.res_pagos_v3[response.res_pagos_v3.length - 1].int_estado_pago
        const transactionCode = response.res_pagos_v3[response.res_pagos_v3.length - 1].str_codigo_transaccion

        // obtengo el estado para actualizar la orden
        let orderStatusToUpdate
        for (const orderStatus of orderStatusesToValidate) {
          const codeStatuses = orderStatus.paymentPlatformCode.split('|')
          if (codeStatuses.includes(estadoPago.toString())) {
            orderStatusToUpdate = orderStatus
            break
          }
        }

        // valido
        if (!orderStatusToUpdate) {
          return new Error(`El estado con codigo ${response.res_pagos_v3[response.res_pagos_v3.length - 1].int_estado_pago}, no existe`)
        }

        if (orderStatusToUpdate.code === 'PAGO_APROBADO') {
          let orderDetails = []
          try {
            orderDetails = await order.orderDetails.find()
          } catch (error) {
            throw error
          }

          // obtengo el usuario de la orden
          let userInstance
          try {
            userInstance = await order.user.get()
          } catch (error) {
            throw error
          }

          // obtengo la direccion de la orden
          let addressInstance
          try {
            addressInstance = await order.address.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!addressInstance) {
            throw new Error('La dirección de la orden, no existe.')
          }

          // Obtengo la ciudad de la dirección
          let cityInstance
          try {
            cityInstance = await addressInstance.city.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!cityInstance) {
            throw new Error('La ciudad de la direccion no existe.')
          }

          // obtengo el estado del pago verificado
          let idClientePagoVerificado = response.res_pagos_v3[response.res_pagos_v3.length - 1].str_id_cliente
          let valorPagoVerificado = response.res_pagos_v3[response.res_pagos_v3.length - 1].dbl_valor_pagado

          // valido
          if (order.total !== valorPagoVerificado) {
            throw new Error('El total a pagar de la orden no es igual al del la confirmado')
          }

          if (userInstance.identification !== idClientePagoVerificado) {
            throw new Error('La identificación del usuario no es igual a la del pago confirmado')
          }

          if (orderStatusToUpdate.code !== 'PAGO_APROBADO') {
            throw new Error('La orden no fue aprobada')
          }

          const productInstances = []
          for (const orderDetailInstance of orderDetails) {
            let productInstance
            try {
              productInstance = await orderDetailInstance.product.get()
              productInstance.quantity = orderDetailInstance.quantity
            } catch (error) {
              throw error
            }

            // obtengo la image
            let imageInstance = []
            try {
              imageInstance = await productInstance.imageProducts.find()
            } catch (error) {
              throw error
            }

            let skuVariations = []
            try {
              skuVariations = await productInstance.skuVariations.find()
            } catch (error) {
              throw error
            }

            let skuChildrenVariations
            try {
              skuChildrenVariations = await productInstance.skuChildren.get()
            } catch (error) {
              throw error
            }

            productInstance.isLifeStyle = false
            if (skuVariations.length > 0) {
              productInstance.isLifeStyle = true
              productInstance.color = skuVariations[0] ? skuVariations[0].color : skuChildrenVariations.color
              productInstance.size = skuVariations[0] ? skuVariations[0].size : skuChildrenVariations.size
            }

            if (imageInstance.length < 1) {
              productInstance.imageUrl = 'https://autogermana.s3.amazonaws.com/no%20-foto.png'
            } else {
              productInstance.imageUrl = imageInstance[0].image
            }
            productInstances.push(productInstance)
          }

          let codeCoupon
          try {
            codeCoupon = await order.codeCoupon.get()
          } catch (error) {
            throw error
          }

          const productsToIncadea = productInstances.map(product => (
            {
              id: product.id,
              sku: product.sku,
              name: product.name,
              storeId: order.storeId,
              storeName: 'ECOMM-BO',
              quantity: product.quantity,
              priceWithTax: order.codeCouponId ? codeCoupon.isPercentage ? product.priceWithTax - ((product.priceWithTax * codeCoupon.value) / 100) : product.priceWithTax : product.priceWithTax,
              priceWithoutTax: order.codeCouponId ? codeCoupon.isPercentage ? product.priceWithoutTax - ((product.priceWithoutTax * codeCoupon.value) / 100) : product.priceWithoutTax : product.priceWithoutTax,
              imageUrl: product.imageUrl,
              price: product.priceWithTax - (product.priceWithTax - product.priceWithoutTax),
              color: product.color,
              size: product.size,
              isLifeStyle: product.isLifeStyle
            })
          )

          // Precio del servicio tcc
          productsToIncadea.push({
            id: 1,
            sku: '280505001',
            name: 'Envio Ecommerce',
            storeId: 1,
            storeName: 'ECOMM-BO',
            quantity: 1,
            priceWithTax: order.priceDelivery,
            priceWithoutTax: order.priceDelivery,
            imageUrl: 'tcc.png'
          })

          if (order.codeCouponId) {
            if (!codeCoupon.isPercentage) {
              productsToIncadea.push({
                id: 1,
                sku: '280505001',
                name: 'Coupon de descuento',
                storeId: 1,
                storeName: 'ECOMM-BO',
                quantity: 1,
                priceWithTax: codeCoupon.value * -1,
                priceWithoutTax: codeCoupon.value * -1,
                imageUrl: 'zv.png'
              })
            }
          }

          const incadeOrderObj = {
            id: order.id,
            docType: 0,
            identification: userInstance.identification,
            firstName: userInstance.firstName,
            lastName: userInstance.lastName,
            city: cityInstance.name,
            address: addressInstance.value,
            phone: addressInstance.phone,
            email: userInstance.email,
            total: order.total,
            producto: productsToIncadea
          }

          // Envio orden a incadea
          console.log('Confirmacion de pago solo si no tiene antes de generar incadea')
          console.log(order)

          let incadeaOrder
          if (order.incadeaOrderId === '0' && order.delivery === '0') {
            console.log('--------------Entro aqui---------------------')
            try {
              incadeaOrder = await autogermanaIntegration.createdOrder(incadeOrderObj)
            } catch (error) {
              throw (error)
            }
            console.log(incadeaOrder)

            if (incadeaOrder) {
              // actualizo el estado de la orden a aprobado, dismunuyo la intencion de compra y el inventario
              try {
                await order.updateAttributes({ orderStatusId: orderStatusToUpdate.id, incadeaOrderId: incadeaOrder.respuesta_TSQL, sendDate: moment().tz('America/Bogota').format('YYYY-MM-DD'), transactionCode: transactionCode })
              } catch (error) {
                return error
              }
            }
          }

          // valido
          if (!order) {
            throw new Error(`La orden con id ${order.id}, no existe`)
          }

          // valido
          if (!orderDetails) {
            throw new Error(`La orden con id ${order.id}, no existe detalles`)
          }

          let userInstanceTcc = null
          try {
            userInstanceTcc = await order.user.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!userInstanceTcc) {
            throw new Error(`La orden con id ${order.id}, no le pertenece a un usuario`)
          }

          let brandInstance = null
          try {
            brandInstance = await order.brand.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!brandInstance) {
            throw new Error(`La orden con id ${order.id}, no pertenece a una marca`)
          }

          let cityAddressInatance = null
          try {
            cityAddressInatance = await addressInstance.city.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!cityAddressInatance) {
            throw new Error(`La orden con id ${order.id}, no tiene una ciudad`)
          }

          let stateAddressInstance = null
          try {
            stateAddressInstance = await cityAddressInatance.state.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!stateAddressInstance) {
            throw new Error(`La ciudad de la orden con id ${order.id}, no tiene un estado`)
          }

          let storeInstance = null
          try {
            storeInstance = await order.store.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!storeInstance) {
            throw new Error(`La orden con id ${order.id}, no tiene una tienda asociada`)
          }

          let cityStoreInstance = null
          try {
            cityStoreInstance = await storeInstance.city.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!cityStoreInstance) {
            throw new Error(`La tienda de la orden con id ${order.id}, no tiene una tienda ciudad asociada`)
          }

          let stateStoreInstance = null
          try {
            stateStoreInstance = await cityStoreInstance.state.get()
          } catch (error) {
            throw error
          }

          // valido
          if (!stateStoreInstance) {
            throw new Error(`La tienda de la orden con id ${order.id}, con la ciudad ${cityStoreInstance.name} no tiene un estado relacionado`)
          }

          const products = await Promise.all(orderDetails.map(async (item) => {
            let ProductInstanDetail = null
            try {
              ProductInstanDetail = await item.product.get()
            } catch (error) {
              throw error
            }

            const weightVolumeK = ProductInstanDetail.weightVolume / 1000.0
            // const weightVolumeK = (weightVolume / 1000.0).toFixed(2).replace(".", ",")

            let product = {
              tipounidad: 'TIPO_UND_PAQ',
              claseempaque: 'CLEM_MEDIANA',
              kilosreales: weightVolumeK, // PENDIENTE
              largo: 0,
              alto: 0,
              ancho: 0,
              pesovolumen: weightVolumeK,
              valormercancia: item.price,
              codigobarras: null,
              unidadesinternas: item.quantity // PENDIENTE
            }
            return product
          }))

          console.log(products)

          const productsVolumes = await Promise.all(orderDetails.map(async (item) => {
            let product = null
            try {
              product = await item.product.get()
            } catch (error) {
              throw error
            }
            return product
          }))

          const weightVolume = productsVolumes.map(item => item.weightVolume).reduce((pre, cur) => pre + cur, 0)

          const weightVolumeK = weightVolume / 1000.0

          let unidadDeNEgocio = null
          let cuentaAut = null
          if (weightVolumeK < 5.1 && order.total <= 3511208) {
            unidadDeNEgocio = 2
            cuentaAut = 5132001
          } else if (weightVolumeK >= 5.1 && weightVolumeK < 15.0) {
            unidadDeNEgocio = 1
            cuentaAut = 1759405
          } else {
            unidadDeNEgocio = 1
            cuentaAut = 1759405
          }

          const parameters = {
            despacho: {
              clave: passTcc,
              solicitudrecogida: {},
              unidadnegocio: unidadDeNEgocio,
              fechadespacho: moment().format('YYYY-MM-DD'),
              cuentaremitente: cuentaAut,
              tipoidentificacionremitente: 'NIT',
              identificacionremitente: 860509514,
              primernombreremitente: 'AUTOGERMANA',
              segundonombreremitente: null,
              primerapellidoremitente: null,
              razonsocialremitente: 'AUTOGERMANA',
              naturalezaremitente: 'N',
              direccionremitente: 'carrera 45 # 197-35',
              contactoremitente: null,
              emailremitente: 'johan.rios@autogermana.com.co',
              telefonoremitente: '3202572769',
              ciudadorigen: 11001000, // `${stateStoreInstance.code}${cityStoreInstance.code}000`,
              tipoidentificaciondestinatario: userInstanceTcc.docType,
              identificaciondestinatario: userInstanceTcc.identification,
              primernombredestinatario: userInstanceTcc.firstName,
              segundonombredestinatario: null,
              primerapellidodestinatario: userInstanceTcc.lastName,
              naturalezadestinatario: 'N',
              direcciondestinatario: addressInstance.value,
              contactodestinatario: 'CONTACTO DESTINO',
              telefonodestinatario: userInstanceTcc.phone,
              ciudaddestinatario: `${stateAddressInstance.code}${cityAddressInatance.code}000`,
              totalpeso: null,
              totalpesovolumen: null,
              totalvalormercancia: order.total - order.priceDelivery,
              observaciones: `Pedidos ${order.incadeaOrderId} por valor de ${order.total}`,
              // unidad: products,
              unidad: {
                tipounidad: 'TIPO_UND_PAQ',
                claseempaque: 'CLEM_MEDIANA',
                kilosreales: weightVolumeK < 1 ? 1 : weightVolumeK,
                largo: 0,
                alto: 0,
                ancho: 0,
                pesovolumen: weightVolumeK,
                valormercancia: order.total,
                codigobarras: null,
                unidadesinternas: 1
              },
              documentoreferencia: {
                tipodocumento: 'OC',
                numerodocumento: `OC-${order.id}`,
                fechadocumento: moment().format('YYYY-MM-DD')
              },
              generardocumentos: 'TRUE',
              tiposervicio: null,
              fuente: null
            }
          }

          // valido
          if (!parameters) {
            throw new Error('La peticion no contiene parametros')
          }

          // Ejecuto la integracion
          let responseTcc
          if (incadeaOrder && order.delivery === '0') {
            console.log('---- Confirmacion de pago Solo si no tiene --------------')
            console.log(order)
            try {
              responseTcc = await obtenerValorGrabarRemesa(parameters)
            } catch (error) {
              throw error
            }
            /* 
                        console.log('RespuestaTCC: ', responseTcc) */

            if (responseTcc.respuesta === '-1') {
              throw new Error(`Algo salio mal creando la remesa para el orden ${order.id}, en TCC.`)
            }

            // actualizo el estado de la orden a aprobado, dismunuyo la intencion de compra y el inventario
            try {
              // await order.updateAttributes({ orderStatusId: orderStatusToUpdate.id, incadeaOrderId: incadeaOrder.respuesta_TSQL, delivery: responseTcc.remesa, transactionCode: transactionCode })
              await order.updateAttributes({ delivery: responseTcc.remesa })
            } catch (error) {
              return error
            }

            if (incadeaOrder.respuesta_TSQL.split('-')[0] !== 'PVRE') {
              const parametersEmailIncadea = {
                user: userInstance,
                order: order
              }

              const eventName = (brandId) => {
                switch (brandId) {
                  case 1:
                    return 'autorespuesta_motorrad_3_incadea_error'

                  case 2:
                    return 'autorespuesta_mini_3_incadea_error'

                  case 3:
                    return 'autorespuesta_bmw_3_incadea_error'
                }
              }

              const data = {
                email: userInstance.email,
                eventName: eventName(userInstance.brandId),
                attributes: {
                  nCompra: order.uuid,
                  orderIncadeaID: order.incadeaOrderId
                }
              }

              await incadeaError(data)

              // const htmlIncadea = generateHtmlByEmailtemplate('incadea-error', parametersEmailIncadea)

              // // send the email
              // const mailerObject = new Mailer()
              // try {
              //   await mailerObject.sendMail([emailIncadeaError], htmlIncadea, 'Error creación pedido')
              // } catch (error) {
              //   throw error
              // }
            }

            productsToIncadea.splice(productsToIncadea.length - 1)
            if (codeCoupon) {
              if (!codeCoupon.isPercentage) {
                productsToIncadea.splice(productsToIncadea.length - 1)
              }
            }

            const { priceFormatter } = Util

            const parametersTcc = {
              user: userInstance,
              order: {
                ...order,
                delivery: order.delivery,
                id: order.id,
                subtotal: priceFormatter(order.subtotal),
                taxes: priceFormatter(order.taxes),
                priceDelivery: priceFormatter(order.priceDelivery),
                total: priceFormatter(order.total)
              },
              products: productsToIncadea.map(item => ({
                ...item,
                price: priceFormatter(item.price)
              })),
              address: addressInstance,
              city: cityInstance,
              discoun: { value: priceFormatter(codeCoupon ? codeCoupon.isPercentage ? (order.subtotal * codeCoupon.value / (100 - codeCoupon.value)) * -1 : codeCoupon.value : 0) }
            }

            const html = generateHtmlByEmailtemplate('order-succes', parametersTcc)

            // send the email
            const mailerObject = new Mailer()
            try {
              await mailerObject.sendMail([userInstance.email], html, 'Gracias por su compra!')
            } catch (error) {
              throw error
            }
          }

          // descuento el stock de los productos
          for (const detailInOrder of orderDetails) {
            // obtengo el producto asociado al detalle
            let productInstance
            try {
              productInstance = await detailInOrder.product.get()
            } catch (error) {
              throw error
            }

            // actualizo el producto
            try {
              await productInstance.updateAttributes({ stock: productInstance.stock - detailInOrder.quantity, intent: productInstance.intent - detailInOrder.quantity })
            } catch (error) {
              throw error
            }
          }
        }

        console.log(response.res_pagos_v3.length)
        console.log(response.res_pagos_v3[response.res_pagos_v3.length - 1])
        console.log(estadoPago)
      }

      console.log('order: ', order)
      console.log('payments: ', payments)
      console.log('response: ', response)
      console.log('***********************')
    }))

    // Parametros con estados pagos pendientes
    console.log(codesOrderStaus)
    // Id de pagos pendientes
    console.log('Id de pagos pendientes: ', orderStatusIds)
    // Ordenes con pagos pendientes
    console.log('Ordenes con pagos pendientes: ', ordersToValidate.length)
    return res.status(200).send(ordersToValidate)
  })
}
