
import { generateHtmlByEmailtemplate } from '../../server/functions/generate-html-by-email-template'
import { Mailer } from '../../server/services/mailer'
import moment from 'moment-timezone'
moment.tz('America/Bogota')

import { eventCancel, eventSucces } from '../../integrations/mail/index';

module.exports = function (Eventassistant) {
  const eventassistantParam = Eventassistant

  eventassistantParam.observe('after save', async (ctx, next) => {
    if (ctx.isNewInstance) {
      // Validar que el usuario este registrado

      let userInstance = null
      try {
        userInstance = await ctx.instance.user.get()
      } catch (error) {
        throw error
      }

      let eventInstance = null
      try {
        eventInstance = await ctx.instance.event.get()
      } catch (error) {
        throw error
      }

      const username = `${userInstance.firstName} ${userInstance.lastName}`
      try {
        await eventassistantParam.updateAll(
          {
            userId: userInstance.id,
            eventId: eventInstance.id
          },
          {
            username: username,
            brandId: userInstance.brandId
          }
        )
      } catch (error) {
        throw error
      }

      if (userInstance && eventInstance) {
        const parametersEmail = {
          user: userInstance,
          day: moment(eventInstance.startAt).tz('America/Bogota').format('D/MMMM/YYYY'),
          event: eventInstance,
          hour: moment(eventInstance.startAt).tz('America/Bogota').format('h:mm a'),
          url_map: 'https://www.google.com/maps?q=5,-74'
        }

        const eventName = (brandId) => {
          switch (brandId) {
            case 1:
              return 'autorespuesta_motorrad_2_evento_satisfactorio'

            case 2:
              return 'autorespuesta_mini_2_evento_satisfactorio'

            case 3:
              return 'autorespuesta_bmw_2_evento_satisfactorio'
          }
        }

        const data = {
          email: userInstance.email,
          eventName: eventName(userInstance.brandId),
          attributes: {
            name: userInstance.firstName,
            lastName: userInstance.lastName,
            eventName: eventInstance.name,
            day: moment(eventInstance.startAt).tz('America/Bogota').format('D/MMMM/YYYY'),
            hour: moment(eventInstance.startAt).tz('America/Bogota').format('h:mm a'),
            eventPlace: eventInstance.place
          }
        }

        await eventSucces(data)

        // const html = generateHtmlByEmailtemplate(
        //   'event-succes',
        //   parametersEmail
        // )

        // send the email
        // const mailerObject = new Mailer()
        // try {
        //   await mailerObject.sendMail(
        //     [userInstance.email],
        //     html,
        //     'Gracias por inscribirse!'
        //   )
        // } catch (error) {
        //   throw error
        // }
      }
    }
  })

  eventassistantParam.observe('before delete', async (ctx, next) => {
    let assistantEventInstance = null
    try {
      assistantEventInstance = await eventassistantParam.findById(ctx.where.id)
    } catch (error) {
      throw error
    }

    let eventInstance = null
    try {
      eventInstance = await assistantEventInstance.event.get()
    } catch (error) {
      throw error
    }

    let userInstance = null
    try {
      userInstance = await assistantEventInstance.user.get()
    } catch (error) {
      throw error
    }

    const eventName = (brandId) => {
      switch (brandId) {
        case 1:
          return 'autorespuesta_motorrad_1_evento_cancelado'

        case 2:
          return 'autorespuesta_mini_1_evento_cancelado'

        case 3:
          return 'autorespuesta_bmw_1_evento_cancelado'
      }
    }

    const data = {
      email: userInstance.email,
      eventName: eventName(userInstance.brandId),
      attributes: {
        name: userInstance.firstName,
        lastName: userInstance.lastName,
        eventName: eventInstance.name
      }
    }

    await eventCancel(data)
    //const html = generateHtmlByEmailtemplate('event-cancel', parametersEmail)

    // send the email
    // const mailerObject = new Mailer()
    // try {
    //   await mailerObject.sendMail(
    //     [userInstance.email],
    //     html,
    //     'Se ha cancelado la inscripción al evento!'
    //   )
    // } catch (error) {
    //   throw error
    // }
  })

  eventassistantParam.validatesPresenceOf('eventId', {
    message: {
      labels: 'La asistencia no esta asociada a un evento',
      field: 'The eventId is required'
    }
  })

  eventassistantParam.validatesPresenceOf('userId', {
    message: {
      labels: 'La asistencia no esta asociada a un usuario',
      field: 'The userId is required'
    }
  })
}
