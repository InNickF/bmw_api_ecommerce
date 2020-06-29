import getParameterValue from '../../server/functions/get-parameter-value'
import { generateHtmlByEmailtemplate } from '../../server/functions/generate-html-by-email-template'
import { Mailer } from '../../server/services/mailer'
const emailAutogermana = process.env.EMAIL_AUTOGERMANA
import { requestPqr, succesPqr } from '../../integrations/mail/index';


module.exports = function (Pqr) {
  const pqrParam = Pqr

  // Ver la lista de todos los productos
  pqrParam.createPqrs = async body => {
    const {
      PqrDetail,
      MyUser,
      City
    } = pqrParam.app.models

    // Consulto el usuario
    let userInstance = null
    try {
      if (body.userId) {
        userInstance = await MyUser.findOne({ where: { id: body.userId } })
      }
    } catch (error) {
      throw error
    }

    // valido
    if (!userInstance && body.userId) {
      throw new Error(`El usuario para orden ${body.orderId}, no existe`)
    }

    let pqrInstance
    try {
      if (body.userId) {
        body.docType = userInstance.docType
      } else {
        body.docType = "CC"
      }
      pqrInstance = await pqrParam.create(body)
    } catch (error) {
      throw error
    }

    // valido
    if (!pqrInstance) {
      throw new Error('No se pudo crear la solicitud ')
    }

    if (body.details) {
      const arrayPqrsDetails = await Promise.all(body.details.map(async product => {
        let brandInstance = null
        try {
          brandInstance = await PqrDetail.create({
            comment: body.commentary,
            orderDetailId: product.orderDetailId,
            reasonId: product.reasonId,
            pqrId: pqrInstance.id
          })
        } catch (error) {
          throw error
        }
        return brandInstance
      }))

      if (!arrayPqrsDetails) {
        throw new Error('No se pudieron crear los comentarios de las referencias')
      }
    }

    let brandInstance = null
    try {
      brandInstance = await pqrInstance.brand.get()
    } catch (error) {
      throw error
    }

    let cityInstance = null
    try {
      cityInstance = await City.findOne({ where: { id: body.cityId } })
    } catch (error) {
      throw error
    }

    // armo el objeto de parametros que voy a enviar para generar el html
    const parameters = {
      user: userInstance,
      brand: brandInstance,
      pqr: pqrInstance,
      city: cityInstance || 0,
      date: pqrInstance.createdAt.toISOString().replace('T', ' ').replace(/\..+/, '')
    }

    // genero el HTML
    const html = generateHtmlByEmailtemplate('pqrs-succes', parameters)

    const eventName2 = (brandId) => {
      switch (brandId) {
        case 1:
          return 'autorespuesta_motorrad_7_pqr_aprobada'

        case 2:
          return 'autorespuesta_mini_7_pqr_aprobada'

        case 3:
          return 'autorespuesta_bmw_7_pqr_aprobada'
      }
    }

    const data2 = {
      email: "soporteenlinea@autogermana.com.co",
      eventName: eventName2(userInstance ? userInstance.brandId : body.brandId),
      attributes: {
        name: userInstance ? userInstance.firstName : body.name,
        lastName: userInstance ? userInstance.lastName : " ",
        email: userInstance ? userInstance.email : body.email,
        identification: userInstance ? userInstance.identification : " ",
        phone: userInstance ? userInstance.phone : body.phone,
        nCompra: body.orderId ? body.orderId : " ",
        city: cityInstance.name,
        commentary: body.commentary
      }
    }

    await succesPqr(data2)


    const htmlAg = generateHtmlByEmailtemplate('pqrs-ag', parameters)

    const eventName = (brandId) => {
      switch (brandId) {
        case 1:
          return 'autorespuesta_motorrad_5_solicitud_pqr'

        case 2:
          return 'autorespuesta_mini_5_solicitud_pqr'

        case 3:
          return 'autorespuesta_bmw_5_solicitud_pqr'
      }
    }

    const data = {
      email: userInstance ? userInstance.email : body.email,
      eventName: eventName(userInstance ? userInstance.brandId : body.brandId),
      attributes: {
        name: userInstance ? userInstance.firstName : body.name,
        lastName: userInstance ? userInstance.lastName : " ",
        email: userInstance ? userInstance.email : body.email,
        identification: userInstance ? userInstance.identification : " ",
        phone: userInstance ? userInstance.phone : body.phone,
        nCompra: body.orderId ? body.orderId : " ",
        city: cityInstance.name,
        commentary: body.commentary
      }
    }

    await requestPqr(data)
    if (userInstance && userInstance.email != body.email) {
      const mailTwo = {
        email: body.email,
        eventName: eventName(userInstance ? userInstance.brandId : body.brandId),
        attributes: {
          name: userInstance ? userInstance.firstName : body.name,
          lastName: userInstance ? userInstance.lastName : " ",
          email: body.email,
          identification: userInstance ? userInstance.identification : " ",
          phone: userInstance ? userInstance.phone : body.phone,
          nCompra: body.orderId ? body.orderId : " ",
          city: cityInstance.name,
          commentary: body.commentary
        }
      }

      await requestPqr(mailTwo)
    }

    // obtengo el asunto
    // const parameterName = 'PETICIONES_QUEJAS_Y_RECLAMOS'
    // let subject
    // try {
    //   subject = await getParameterValue(parameterName)
    // } catch (error) {
    //   throw error
    // }

    // // send the email
    // const mailerObject = new Mailer()
    // try {
    //   await mailerObject.sendMail([userInstance.email, body.email], html, subject)
    // } catch (error) {
    //   throw error
    // }

    // const mailerObjectAg = new Mailer()
    // try {
    //   await mailerObjectAg.sendMail([emailAutogermana], htmlAg, subject)
    // } catch (error) {
    //   throw error
    // }

    // const result = {}
    // result.menssage = 'Pqrs Creado'
    // result.body = body
    // result.pqr = pqrInstance

    // return result
  }
  pqrParam.remoteMethod(
    'createPqrs', {
    accepts: {
      arg: 'body',
      type: 'Object',
      require: true,
      description: '{ orderId: 0, code: IMA528 }'
    },
    http: {
      verb: 'post',
      path: '/createPqrs'
    },
    returns: {
      arg: 'data',
      type: 'Object'
    }
  }
  )
}
