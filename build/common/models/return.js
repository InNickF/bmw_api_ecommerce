import { getMissinKeys, priceFormatter } from '../../server/utils'
import * as app from '../../server/server'
import getParameterValue from '../../server/functions/get-parameter-value'
import { generateHtmlByEmailtemplate } from '../../server/functions/generate-html-by-email-template'
import { Mailer } from '../../server/services/mailer'
const emailAutogermana = process.env.EMAIL_AUTOGERMANA
import { returnRequest } from '../../integrations/mail/index';

module.exports = function (Return) {
  const returnParam = Return

  returnParam.startReturn = async req => {
    const { body } = req
    // Obtengo las llaves faltantes
    const keys = ['email', 'name', 'orderId', 'sku', 'reason']
    const missingKeys = getMissinKeys(keys, body)

    // valido
    if (missingKeys.length > 0) {
      throw new Error(`Al body la faltan los atributos atributos ${missingKeys.toString()}`)
    }

    const { email, name, orderId, sku, reason, quantity, phone, reasonType, reasonId } = body

    // obtengo la orden
    const { Order } = app.models
    let orderInstance
    try {
      orderInstance = await Order.findOne({ where: { id: orderId } })
    } catch (error) {
      throw error
    }

    // valido
    if (!orderInstance) {
      throw new Error(`La orden con id ${orderId}, no existe.`)
    }

    // obtengo la marca de la orden
    const { brandId } = orderInstance

    // obtengo el usuario
    const { MyUser } = app.models
    let userInstance
    try {
      userInstance = await MyUser.findOne({ where: { email, brandId } })
    } catch (error) {
      throw error
    }

    // valido
    if (!userInstance) {
      throw new Error(`El usuario con email ${email}, no existe.`)
    }

    orderInstance = undefined

    // obtengo la orden para el usuario
    try {
      orderInstance = await Order.findOne({ where: { id: orderId, userId: userInstance.id } })
    } catch (error) {
      throw error
    }

    // valido
    if (!orderInstance) {
      throw new Error(`La orden con id ${orderId} y el usuario ${userInstance.id}, no existe.`)
    }

    // obtengo el producto
    const { Product } = app.models
    let productInstance
    try {
      productInstance = await Product.findOne({ where: { sku } })
    } catch (error) {
      throw error
    }

    // valido
    if (!productInstance) {
      throw new Error(`El producto con el sku ${sku}, no existe.`)
    }

    // obtengo la url de la imagen default
    let parameterName = 'NO_IMAGEN_URL'
    let urlDefault
    try {
      urlDefault = await getParameterValue(parameterName)
    } catch (error) {
      throw error
    }

    // obtengo la imagen del producto (esto es para el mail)
    try {
      let images = []
      images = await productInstance.imageProducts.find()
      productInstance.imageUrl = images.length > 0 ? images[0].image : urlDefault
    } catch (error) {
      throw error
    }

    // obtengo el detalle de la orden
    const { OrderDetail } = app.models
    let orderDetailInstance
    try {
      orderDetailInstance = await OrderDetail.findOne({ where: { orderId, productId: productInstance.id } })
    } catch (error) {
      throw error
    }

    // valido
    if (!orderDetailInstance) {
      throw new Error(`El producto con el sku ${sku}, no existe para la orden ${orderId}.`)
    }

    // armo el objeto para crearlo
    const returnObj = {
      reason: reason,
      email,
      name,
      quantity: 1,
      phone,
      reasonId: reasonId,
      orderId: orderInstance.id,
      productId: productInstance.id,
      userId: userInstance.id
    }

    // busco o creo la resolucion
    let returnResult
    try {
      returnResult = await returnParam.findOrCreate({
        where: {
          orderId: returnObj.orderId,
          productId: returnObj.productId,
          quantity: quantity,
          phone: phone,
          userId: returnObj.userId
        }
      }, returnObj)
    } catch (error) {
      throw error
    }

    const retunrInstance = returnResult[0]

    // busco el codigo para el estado necesario
    parameterName = 'ESTADO_ORDEN_SOLICITUD_DEVOLUCION'
    let orderStatusCode
    try {
      orderStatusCode = await getParameterValue(parameterName)
    } catch (error) {
      throw error
    }

    // obtengo el estado de la orden
    const { OrderStatus } = app.models
    let orderStatusInstance
    try {
      orderStatusInstance = await OrderStatus.findOne({ where: { code: orderStatusCode } })
    } catch (error) {
      throw error
    }

    // valido
    if (!orderStatusInstance) {
      throw new Error(`No existe el estado de la orden con el codigo ${orderStatusCode}`)
    }

    // actualizo la orden
    try {
      await orderInstance.updateAttributes({ orderStatusId: orderStatusInstance.id })
    } catch (error) {
      throw error
    }

    // armo el objeto de parametros que voy a enviar para generar el html
    const parameters = {
      user: userInstance,
      order: orderInstance,
      product: { ...productInstance, priceWithTax: priceFormatter(productInstance.priceWithTax) },
      reasonType: { name: reasonType },
      return: returnResult[0]
    }

    const eventName = (brandId) => {
      switch (brandId) {
        case 1:
          return 'autorespuesta_motorrad_4_cambio_o_devolucion'

        case 2:
          return 'autorespuesta_mini_4_cambio_o_devolucion'

        case 3:
          return 'autorespuesta_bmw_4_cambio_o_devolucion'
      }
    }

    const eventNameSupport = (brandId) => {
      switch (brandId) {
        case 1:
          return 'autorespuesta_motorrad_11_soporte'

        case 2:
          return 'autorespuesta_mini_11_soporte'

        case 3:
          return 'autorespuesta_bmw_11_soporte'
      }
    }

    const capitalize = (s) => {
      if (typeof s !== 'string') return ''
      return s.charAt(0).toUpperCase() + s.slice(1)
    }


    const data = {
      email: userInstance.email,
      eventName: eventName(userInstance.brandId),
      attributes: {
        name: capitalize(userInstance.firstName) + ' ' + capitalize(userInstance.lastName),
        event_items: [
          {
            image: productInstance.imageUrl,
            productName: productInstance.name.toUpperCase(),
            productQuantify: retunrInstance.quantity,
            productPrice: priceFormatter(productInstance.priceWithTax),
            nCompra: orderInstance.id,
            name: capitalize(userInstance.firstName) + ' ' + capitalize(userInstance.lastName),
            email: userInstance.email,
            reasonType: retunrInstance.reasonType,
            reason: reason
          }
        ]
      }
    }
    
    const dataSupport = {
      email: "soporteenlinea@autogermana.com.co",
      eventName: eventNameSupport(userInstance.brandId),
      attributes: {
        name: capitalize(userInstance.firstName),
        lastName: capitalize(userInstance.lastName),
        commentary: reason,
        email: userInstance.email,
        nCompra: orderInstance.id,
        productPrice: priceFormatter(productInstance.priceWithTax),
        productQuantify: retunrInstance.quantity,
        productName: productInstance.name.toUpperCase(),
      }
    }

    await returnRequest(data)
    await returnRequest(dataSupport)

    // genero el HTML
    // const html = generateHtmlByEmailtemplate('return-request', parameters)

    // // obtengo el asunto
    // parameterName = 'ASUNTO_SOLICITUD_DEVOLUCION'
    // let subject
    // try {
    //   subject = await getParameterValue(parameterName)
    // } catch (error) {
    //   throw error
    // }

    // // send the email
    // const mailerObject = new Mailer()
    // try {
    //   await mailerObject.sendMail([userInstance.email, emailAutogermana], html, subject)
    // } catch (error) {
    //   throw error
    // }

    return retunrInstance
  }

  returnParam.remoteMethod('startReturn', {
    accepts: {
      arg: 'req',
      type: 'object',
      http: {
        source: 'req'
      }
    },
    http: {
      verb: 'post',
      path: '/start-return'
    },
    returns: {
      arg: 'retunr',
      type: 'object',
      root: true
    }
  })
}
